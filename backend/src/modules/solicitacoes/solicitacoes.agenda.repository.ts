import type postgres from 'postgres';
import type { z } from 'zod';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import { verificarDisponibilidade,bloquearRecursosDaTroca,consultarRecursosDisponiveis,type IntervaloReserva } from '../alocacao/alocacao.repository.js';
import type { consultarAgendaSchema,consultarDisponibilidadeSchema,reagendarSolicitacaoSchema,itemAgenda,agendamentoSolicitacao } from './solicitacoes.schemas.js';

async function normalizarPeriodo(tx:postgres.TransactionSql, periodo:{inicio:string;fim:string}):Promise<IntervaloReserva> {
  const [row] = await tx<IntervaloReserva[]>`SELECT
    to_char((${periodo.inicio}::timestamptz AT TIME ZONE 'America/Maceio'),'YYYY-MM-DD"T"HH24:MI:SS.US') AS inicio,
    to_char((${periodo.fim}::timestamptz AT TIME ZONE 'America/Maceio'),'YYYY-MM-DD"T"HH24:MI:SS.US') AS fim`;
  return row;
}

/** Lê reservas AGENDADA intersectando o período, com página e total no mesmo snapshot. */
export async function consultarAgenda(filtros:z.infer<typeof consultarAgendaSchema>):Promise<{data:z.infer<typeof itemAgenda>[];total:number}> {
  return sql.begin('isolation level repeatable read read only',async tx => {
    const intervalo=await normalizarPeriodo(tx,filtros);
    const data=await tx<z.infer<typeof itemAgenda>[]>`SELECT s.id::text,s.codigo,'#'||s.codigo AS "codigoExibicao",s.status,
      s.origem,s.destino,s.finalidade,s.qtd_passageiros AS "qtdPassageiros",
      CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object('id',m.id::text,'nome',m.nome) END AS motorista,
      CASE WHEN v.id IS NULL THEN NULL ELSE json_build_object('id',v.id::text,'placa',v.placa,'modelo',v.modelo) END AS veiculo,
      to_char(s.data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraSaida",
      to_char(s.data_hora_retorno_previsto,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraRetornoPrevisto"
      FROM public.solicitacao_viagem s LEFT JOIN public.motorista m ON m.id=s.motorista_id
      LEFT JOIN public.veiculo v ON v.id=s.veiculo_id
      WHERE s.status='AGENDADA' AND s.data_hora_saida<${intervalo.fim}::timestamp
        AND (s.data_hora_retorno_previsto IS NULL OR s.data_hora_retorno_previsto>${intervalo.inicio}::timestamp)
      ORDER BY s.data_hora_saida,s.id LIMIT ${filtros.limit} OFFSET ${(filtros.page-1)*filtros.limit}`;
    const [count]=await tx`SELECT count(*)::text AS total FROM public.solicitacao_viagem s
      WHERE s.status='AGENDADA' AND s.data_hora_saida<${intervalo.fim}::timestamp
        AND (s.data_hora_retorno_previsto IS NULL OR s.data_hora_retorno_previsto>${intervalo.inicio}::timestamp)`;
    const total=Number(count.total);
    if (!Number.isSafeInteger(total)) throw new Error('Contagem fora do intervalo suportado.');
    return {data,total};
  });
}

/** Lista recursos disponíveis no snapshot, sem prometer reserva ou expor dados pessoais extras. */
export async function consultarDisponibilidade(filtros:z.infer<typeof consultarDisponibilidadeSchema>) {
  return sql.begin('isolation level repeatable read read only',async tx => {
    const recursos=await consultarRecursosDisponiveis(tx,await normalizarPeriodo(tx,filtros));
    return {motoristas:recursos.filter(r=>r.tipo==='motorista').map(r=>({id:r.id,nome:r.nome})),
      veiculos:recursos.filter(r=>r.tipo==='veiculo').map(r=>({id:r.id,placa:r.placa,modelo:r.modelo}))};
  });
}

/** Troca a reserva atomicamente, bloqueando recursos antigos/novos em ordem global. */
export async function reagendarSolicitacao(id:string,atorId:string,dados:z.infer<typeof reagendarSolicitacaoSchema>) {
  return sql.begin('isolation level read committed',async tx => {
    const [pedido]=await tx`SELECT status,motorista_id::text,veiculo_id::text FROM public.solicitacao_viagem WHERE id=${id} FOR UPDATE`;
    if (!pedido) throw new ErroHttp(404,'NAO_ENCONTRADO','Solicitação não encontrada.');
    if (pedido.status!=='AGENDADA') throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','Somente solicitações agendadas podem ser reagendadas.');
    const intervalo=await normalizarPeriodo(tx,{inicio:dados.dataHoraSaida,fim:dados.dataHoraRetornoPrevisto});
    await bloquearRecursosDaTroca(tx,[pedido.motorista_id,dados.motoristaId],[pedido.veiculo_id,dados.veiculoId]);
    const disponibilidade=await verificarDisponibilidade(tx,dados.motoristaId,dados.veiculoId,intervalo,id);
    if (disponibilidade==='referencia_inexistente') throw new ErroHttp(404,'REFERENCIA_INEXISTENTE','Motorista ou veículo não encontrado.');
    if (disponibilidade==='recurso_inelegivel') throw new ErroHttp(409,'RECURSO_INDISPONIVEL','Motorista ou veículo não está disponível.');
    if (disponibilidade==='conflito_alocacao') throw new ErroHttp(409,'CONFLITO_ALOCACAO','Motorista ou veículo possui uma alocação conflitante.');
    const [row]=await tx<z.infer<typeof agendamentoSolicitacao>[]>`UPDATE public.solicitacao_viagem
      SET data_hora_saida=${intervalo.inicio}::timestamp,data_hora_retorno_previsto=${intervalo.fim}::timestamp,
        motorista_id=${dados.motoristaId},veiculo_id=${dados.veiculoId}
      WHERE id=${id} AND status='AGENDADA'
        AND ${intervalo.inicio}::timestamp>(clock_timestamp() AT TIME ZONE 'America/Maceio')
      RETURNING id::text,status,motorista_id::text AS "motoristaId",veiculo_id::text AS "veiculoId",
        to_char(data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraSaida",
        to_char(data_hora_retorno_previsto,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraRetornoPrevisto"`;
    if (!row) throw new ErroHttp(400,'SAIDA_INVALIDA','A saída deve estar no futuro.');
    await registrarAtividades(tx,atorId,[{operacao:'solicitacao_viagem_reagendada',recursoId:id}]);
    return row;
  });
}
