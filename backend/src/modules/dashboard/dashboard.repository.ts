import type {z} from 'zod';
import {ErroHttp} from '../../shared/http/errors.js';
import {sql} from '../../database/connection.js';
import {consultarRecursosDisponiveis} from '../alocacao/alocacao.repository.js';
import type {ConsultaDashboard,periodoDashboard} from './dashboard.indicadores.schemas.js';

/** Usa um único snapshot; o período é da saída local, não do instante civil desconhecido dos logs. */
export async function consultarIndicadores(query:ConsultaDashboard,comResumo:boolean){
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const [intervalo]=await tx<{inicio:string;fim:string;valido:boolean}[]>`WITH janela AS (
      SELECT CASE WHEN ${query.periodo}='personalizado' THEN ${query.inicio??null}::text::timestamptz AT TIME ZONE 'America/Maceio'
        ELSE date_trunc('day',transaction_timestamp() AT TIME ZONE 'America/Maceio')-
          CASE ${query.periodo} WHEN '7d' THEN interval '6 days' WHEN '30d' THEN interval '29 days' ELSE interval '0 days' END END AS inicio,
        CASE WHEN ${query.periodo}='personalizado' THEN ${query.fim??null}::text::timestamptz AT TIME ZONE 'America/Maceio'
        ELSE date_trunc('day',transaction_timestamp() AT TIME ZONE 'America/Maceio')+interval '1 day' END AS fim)
      SELECT to_char(inicio,'YYYY-MM-DD"T"HH24:MI:SS.US') AS inicio,to_char(fim,'YYYY-MM-DD"T"HH24:MI:SS.US') AS fim,fim>inicio AND fim-inicio<=interval '31 days' AS valido FROM janela`;
    if(!intervalo.valido)throw new ErroHttp(400,'DADOS_INVALIDOS','Informe um intervalo válido de até 31 dias.');
    const periodo:z.infer<typeof periodoDashboard>={periodo:query.periodo,inicio:intervalo.inicio+'-03:00',fim:intervalo.fim+'-03:00',criterio:'dataHoraSaida',fuso:'America/Maceio'};
    const veiculosPorStatus=await tx<{status:string|null;total:number}[]>`SELECT status,count(*)::int AS total FROM public.veiculo GROUP BY status ORDER BY status NULLS LAST`;
    const solicitacoesPorStatus=await tx<{status:string|null;total:number}[]>`SELECT status,count(*)::int AS total FROM public.solicitacao_viagem
      WHERE data_hora_saida>=${intervalo.inicio}::text::timestamp AND data_hora_saida<${intervalo.fim}::text::timestamp GROUP BY status ORDER BY status NULLS LAST`;
    const graficos={veiculosPorStatus,solicitacoesPorStatus,periodo};
    if(!comResumo)return {graficos};
    const [cadastroMotoristas]=await tx`SELECT EXISTS(SELECT 1 FROM public.motorista) AS existente`;
    const [fila]=await tx`SELECT count(*)::int AS total FROM public.solicitacao_viagem WHERE status='PENDENTE'`;
    const filaAguardandoAnalise=await tx`SELECT id::text,codigo,'#'||codigo AS "codigoExibicao",origem,destino,
      to_char(criado_em,'YYYY-MM-DD"T"HH24:MI:SS.US') AS "criadoEm",'ANALISAR' AS acao FROM public.solicitacao_viagem
      WHERE status='PENDENTE' ORDER BY criado_em ASC NULLS LAST,id ASC LIMIT 5`;
    // Projeção legada explícita: evita acrescentar finalidade ou metadados internos via SELECT *.
    const proximasViagens=await tx`SELECT id::text,codigo,solicitante_id::text,origem,destino,
      to_char(data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS data_hora_saida,qtd_passageiros,status,motivo_rejeicao,
      to_char(criado_em,'YYYY-MM-DD"T"HH24:MI:SS.US') AS criado_em,veiculo_id::text,motorista_id::text
      FROM public.solicitacao_viagem WHERE status IN ('AGENDADA','PRONTA_PARA_INICIAR')
      AND data_hora_saida>=${intervalo.inicio}::text::timestamp AND data_hora_saida<${intervalo.fim}::text::timestamp
      ORDER BY data_hora_saida,id LIMIT 5`;
    const recursos=await consultarRecursosDisponiveis(tx,intervalo);
    const livres=recursos.filter(r=>r.tipo==='veiculo').map(r=>r.id);
    // Sem autorização para incorporar frota marcada SVO ao recorte administrativo.
    const [veiculos]=await tx`SELECT count(*)::int AS total FROM public.veiculo WHERE is_svo=false AND id=ANY(${livres}::bigint[])`;
    const atividadeRecente=await tx`SELECT l.id::text,l.solicitacao_viagem_id::text AS "solicitacaoId",s.codigo,l.descricao,
      to_char(l.data_hora,'YYYY-MM-DD"T"HH24:MI:SS.US') AS "dataHora",l.usuario_id::text AS "responsavelId"
      FROM public.log_atividade l JOIN public.solicitacao_viagem s ON s.id=l.solicitacao_viagem_id
      WHERE s.data_hora_saida>=${intervalo.inicio}::text::timestamp AND s.data_hora_saida<${intervalo.fim}::text::timestamp
      ORDER BY l.data_hora DESC NULLS LAST,l.id DESC LIMIT 10`;
    const decisoesRecentes=await tx`SELECT l.id::text,l.solicitacao_viagem_id::text AS "solicitacaoId",s.codigo,l.descricao,
      to_char(l.data_hora,'YYYY-MM-DD"T"HH24:MI:SS.US') AS "dataHora",l.usuario_id::text AS "responsavelId"
      FROM public.log_atividade l JOIN public.solicitacao_viagem s ON s.id=l.solicitacao_viagem_id
      WHERE s.data_hora_saida>=${intervalo.inicio}::text::timestamp AND s.data_hora_saida<${intervalo.fim}::text::timestamp
      AND l.descricao IN ('Aprovou a solicitação de transporte ID '||s.id,'Reprovou a solicitação de transporte ID '||s.id)
      ORDER BY l.data_hora DESC NULLS LAST,l.id DESC LIMIT 5`;
    return {graficos,resumo:{...graficos,proximasViagens,motoristasDisponiveis:cadastroMotoristas.existente?null:0,
      motoristasDisponiveisMotivo:cadastroMotoristas.existente?'Disponibilidade indeterminada: faltam jornada/escala confiáveis e regras de elegibilidade por CNH para todo o intervalo.':null,
      indicadores:{periodo,pendentes:fila.total,aprovadas:solicitacoesPorStatus.find(r=>r.status==='APROVADA')?.total??0,
        reprovadas:solicitacoesPorStatus.find(r=>r.status==='REPROVADA')?.total??0,veiculosDisponiveis:veiculos.total,
        filaAguardandoAnalise,atividadeRecente,decisoesRecentes,
        indicadoresIndisponiveis:[
          {indicador:'IND-02',estado:'indisponivel',motivo:'Execução de viagens fora do Épico 03.'},
          {indicador:'IND-08',estado:'indisponivel',motivo:'Execução de viagens fora do Épico 03.'},
          {indicador:'IND-09',estado:'indisponivel',motivo:'Documentos fora do Épico 03.'},
        ]}}};
  });
}
