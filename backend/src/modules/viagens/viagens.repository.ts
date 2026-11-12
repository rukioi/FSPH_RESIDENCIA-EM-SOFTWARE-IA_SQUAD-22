import type postgres from 'postgres';
import { inserirVersaoEvidencia } from './viagens.evidencias.repository.js';
import type { evidenciaArquivoSchema } from './viagens.evidencias.schemas.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { sql } from '../../database/connection.js';
import type { z } from 'zod';
import type { consultaMinhasViagens, viagemMotorista } from './viagens.schemas.js';

/** Consulta somente viagens institucionais vinculadas ao usuário atual. */
export async function consultarMinhasViagens(usuarioId: string, filtros: z.infer<typeof consultaMinhasViagens>) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const rows = await tx<z.infer<typeof viagemMotorista>[]>`SELECT v.id::text, s.id::text AS "solicitacaoId", s.codigo,
      s.origem, s.destino, v.status, v.km_inicial AS "kmInicial", v.km_final AS "kmFinal"
      FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id
      JOIN public.motorista m ON m.id=v.motorista_id WHERE m.usuario_id=${usuarioId}
      AND (${filtros.status ?? null}::text IS NULL OR v.status::text=${filtros.status ?? null})
      ORDER BY v.id DESC LIMIT ${filtros.limit} OFFSET ${(filtros.page-1)*filtros.limit}`;
    const [count] = await tx`SELECT count(*)::text AS total FROM public.viagem v
      JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id JOIN public.motorista m ON m.id=v.motorista_id
      WHERE m.usuario_id=${usuarioId} AND (${filtros.status ?? null}::text IS NULL OR v.status::text=${filtros.status ?? null})`;
    const total = Number(count.total);
    if (!Number.isSafeInteger(total)) throw new Error('Contagem fora do intervalo suportado.');
    return { rows, total };
  });
}

/** Cria uma única viagem por solicitação na transação de agendamento. */
export async function criarViagemAgendada(tx: postgres.TransactionSql, solicitacaoId: string, motoristaId: string, veiculoId: string): Promise<void> {
  const rows = await tx`INSERT INTO public.viagem (solicitacao_id,motorista_id,veiculo_id,status)
    VALUES (${solicitacaoId},${motoristaId},${veiculoId},'AGENDADA')
    ON CONFLICT (solicitacao_id) DO NOTHING RETURNING id`;
  if (!rows.length) throw new ErroHttp(409,'VIAGEM_EXISTENTE','Já existe viagem para esta solicitação.');
}

/** Retorna a viagem existente sem recriar pedidos legados nao comprovados. */
export async function obterViagemPorSolicitacao(solicitacaoId:string):Promise<string> {
  return sql.begin('isolation level read committed',async tx=>{
    const [pedido]=await tx`SELECT id FROM public.solicitacao_viagem WHERE id=${solicitacaoId} FOR UPDATE`;
    if(!pedido)throw new ErroHttp(404,'NAO_ENCONTRADO','Solicitacao nao encontrada.');
    const [viagem]=await tx`SELECT id::text FROM public.viagem WHERE solicitacao_id=${solicitacaoId}`;
    if(!viagem)throw new ErroHttp(409,'VIAGEM_NAO_DISPONIVEL','Solicitacao sem viagem exige analise manual.');
    return viagem.id;
  });
}

/** Sincroniza viagem agendada existente; preserva pedidos legados sem viagem. */
export async function sincronizarViagemAgendada(tx: postgres.TransactionSql, solicitacaoId: string,
  recursosAnteriores: { motoristaId: string | null; veiculoId: string | null },
  recursosNovos: { motoristaId: string; veiculoId: string }): Promise<void> {
  const [viagem] = await tx`SELECT id::text,status,motorista_id::text,veiculo_id::text FROM public.viagem
    WHERE solicitacao_id=${solicitacaoId} FOR UPDATE`;
  if (!viagem) return;
  if (viagem.status !== 'AGENDADA' || viagem.motorista_id !== recursosAnteriores.motoristaId || viagem.veiculo_id !== recursosAnteriores.veiculoId) {
    throw new ErroHttp(409,'VIAGEM_INCOMPATIVEL','A viagem vinculada não pode ser reagendada.');
  }
  if (viagem.motorista_id!==recursosNovos.motoristaId) {
    const chave='viagem:'+viagem.id+':atribuicao:'+viagem.motorista_id;
    await tx`UPDATE public.notificacao SET titulo='Atribui\u00e7\u00e3o encerrada' WHERE viagem_id=${viagem.id} AND tipo='ATRIBUICAO' AND chave=${chave}`;
  }
  await tx`UPDATE public.viagem SET motorista_id=${recursosNovos.motoristaId},veiculo_id=${recursosNovos.veiculoId} WHERE solicitacao_id=${solicitacaoId}`;
}

/** Executa a viagem e a solicitação sob locks compatíveis com o agendamento. */
export async function executarViagem(id:string, usuarioId:string, acao:'iniciar'|'concluir', km:number, foto:z.infer<typeof evidenciaArquivoSchema>) {
  return sql.begin('isolation level read committed', async tx => {
    const [referencia] = await tx`SELECT v.solicitacao_id::text FROM public.viagem v JOIN public.motorista m ON m.id=v.motorista_id WHERE v.id=${id} AND m.usuario_id=${usuarioId}`;
    if (!referencia) throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
    const [pedido] = await tx`SELECT status,motorista_id::text,veiculo_id::text FROM public.solicitacao_viagem WHERE id=${referencia.solicitacao_id} FOR UPDATE`;
    if (!pedido || !pedido.motorista_id || !pedido.veiculo_id) throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','Solicitação sem recursos válidos.');
    const [motorista] = await tx`SELECT id FROM public.motorista WHERE id=${pedido.motorista_id} AND usuario_id=${usuarioId} FOR UPDATE`;
    const [veiculo] = await tx`SELECT quilometragem_atual FROM public.veiculo WHERE id=${pedido.veiculo_id} FOR UPDATE`;
    const [viagem] = await tx`SELECT status,motorista_id::text,veiculo_id::text,km_inicial FROM public.viagem WHERE id=${id} AND solicitacao_id=${referencia.solicitacao_id} FOR UPDATE`;
    if (!motorista || !veiculo || !viagem || viagem.motorista_id!==pedido.motorista_id || viagem.veiculo_id!==pedido.veiculo_id) throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','Recursos da viagem incompatíveis.');
    if (acao==='iniciar' ? viagem.status!=='AGENDADA' || !['AGENDADA','PRONTA_PARA_INICIAR'].includes(pedido.status) : viagem.status!=='EM_TRANSPORTE' || pedido.status!=='EM_ANDAMENTO') throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','A viagem não está no estado esperado.');
    if ((veiculo.quilometragem_atual != null && km < veiculo.quilometragem_atual) || (acao==='concluir' && (viagem.km_inicial==null || km < viagem.km_inicial))) throw new ErroHttp(400,'QUILOMETRAGEM_INVALIDA','Quilometragem inferior à registrada.');
    if (acao==='iniciar') {
      const [ocupado] = await tx`SELECT EXISTS (SELECT 1 FROM public.ordem_coleta WHERE status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE') AND (motorista_id=${pedido.motorista_id} OR veiculo_id=${pedido.veiculo_id})) OR EXISTS (SELECT 1 FROM public.solicitacao_viagem WHERE id<>${referencia.solicitacao_id} AND status='EM_ANDAMENTO' AND (motorista_id=${pedido.motorista_id} OR veiculo_id=${pedido.veiculo_id})) AS conflito`;
      if (ocupado.conflito) throw new ErroHttp(409,'CONFLITO_ALOCACAO','Recurso em uso por outra operação.');
    }
    const [row] = acao==='iniciar' ? await tx`UPDATE public.viagem SET status='EM_TRANSPORTE',km_inicial=${km},data_inicio=clock_timestamp() AT TIME ZONE 'America/Maceio' WHERE id=${id} RETURNING id::text,status,km_inicial AS "kmInicial",km_final AS "kmFinal",to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataInicio",NULL::text AS "dataFim"` : await tx`UPDATE public.viagem SET status='CONCLUIDA',km_final=${km},data_fim=clock_timestamp() AT TIME ZONE 'America/Maceio' WHERE id=${id} RETURNING id::text,status,km_inicial AS "kmInicial",km_final AS "kmFinal",to_char(data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataInicio",to_char(data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataFim"`;
    await tx`UPDATE public.solicitacao_viagem SET status=${acao==='iniciar'?'EM_ANDAMENTO':'CONCLUIDA'}::public.status_solicitacao WHERE id=${referencia.solicitacao_id}`;
    if (acao==='concluir') await tx`UPDATE public.veiculo SET quilometragem_atual=${km} WHERE id=${pedido.veiculo_id}`;
    await inserirVersaoEvidencia(tx,id,usuarioId,{...foto,momento:acao==='iniciar'?'INICIAL':'FINAL'});
    await registrarAtividades(tx,usuarioId,[{operacao:acao==='iniciar'?'solicitacao_viagem_iniciada':'solicitacao_viagem_concluida',recursoId:referencia.solicitacao_id}]);
    return row;
  });
}

/** Valida viagem concluída uma única vez e audita na transação do responsável. */
export async function validarViagem(id:string, usuarioId:string) {
  return sql.begin('isolation level read committed', async tx => {
    const [referencia]=await tx`SELECT solicitacao_id::text FROM public.viagem WHERE id=${id}`;
    if(!referencia) throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
    if(!referencia.solicitacao_id) throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','Viagem sem solicitação vinculada.');
    const [pedido]=await tx`SELECT id FROM public.solicitacao_viagem WHERE id=${referencia.solicitacao_id} FOR UPDATE`;
    if(!pedido) throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','Solicitação vinculada indisponível.');
    const [viagem]=await tx`SELECT status,validada_por_gestor FROM public.viagem WHERE id=${id} AND solicitacao_id=${referencia.solicitacao_id} FOR UPDATE`;
    if(!viagem) throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
    if(viagem.status!=='CONCLUIDA'||viagem.validada_por_gestor===true) throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','A viagem precisa estar concluída e não validada.');
    const [row]=await tx`UPDATE public.viagem SET validada_por_gestor=true,validada_por_id=${usuarioId},validada_em=clock_timestamp()
      WHERE id=${id} AND status='CONCLUIDA' AND validada_por_gestor IS NOT TRUE
      RETURNING id::text,status,validada_por_id::text AS "validadaPorId",to_char(validada_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS "validadaEm"`;
    if(!row) throw new ErroHttp(409,'ESTADO_INCOMPATIVEL','A viagem não pode ser validada.');
    await registrarAtividades(tx,usuarioId,[{operacao:'solicitacao_viagem_validada',recursoId:referencia.solicitacao_id}]);
    return row;
  });
}

/** Lista viagens institucionais e contagem no mesmo snapshot. */
export async function listarViagens(f: {page:number;limit:number;status?:string;motoristaId?:string;inicio?:string;fim?:string;pendenteValidacao?:boolean}) {
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const dados=await tx`SELECT v.id::text,s.id::text AS "solicitacaoId",s.codigo,s.origem,s.destino,s.finalidade,s.qtd_passageiros AS "qtdPassageiros",v.status,v.km_inicial AS "kmInicial",v.km_final AS "kmFinal",
      to_char(s.data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraSaida",to_char(s.data_hora_retorno_previsto,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraRetornoPrevisto",
      to_char(v.data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataInicio",to_char(v.data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataFim",
      CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object('id',m.id::text,'nome',m.nome) END AS motorista,
      CASE WHEN ve.id IS NULL THEN NULL ELSE json_build_object('id',ve.id::text,'placa',ve.placa,'modelo',ve.modelo) END AS veiculo,
      v.validada_por_gestor AS "validadaPorGestor",to_char(v.validada_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS "validadaEm"
      FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id LEFT JOIN public.motorista m ON m.id=v.motorista_id LEFT JOIN public.veiculo ve ON ve.id=v.veiculo_id
      WHERE (${f.status??null}::text IS NULL OR v.status::text=${f.status??null})
        AND (${f.pendenteValidacao??false}::boolean IS FALSE OR (v.status='CONCLUIDA' AND v.validada_por_gestor IS NOT TRUE))
        AND (${f.motoristaId??null}::bigint IS NULL OR v.motorista_id=${f.motoristaId??null}::bigint)
        AND (${f.inicio??null}::text IS NULL OR v.data_inicio >= (${f.inicio??null}::text::timestamptz AT TIME ZONE 'America/Maceio'))
        AND (${f.fim??null}::text IS NULL OR v.data_inicio < (${f.fim??null}::text::timestamptz AT TIME ZONE 'America/Maceio'))
      ORDER BY v.id DESC LIMIT ${f.limit} OFFSET ${(f.page-1)*f.limit}`;
    const [n]=await tx`SELECT count(*)::text AS total FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id
      WHERE (${f.status??null}::text IS NULL OR v.status::text=${f.status??null})
        AND (${f.pendenteValidacao??false}::boolean IS FALSE OR (v.status='CONCLUIDA' AND v.validada_por_gestor IS NOT TRUE))
        AND (${f.motoristaId??null}::bigint IS NULL OR v.motorista_id=${f.motoristaId??null}::bigint)
        AND (${f.inicio??null}::text IS NULL OR v.data_inicio >= (${f.inicio??null}::text::timestamptz AT TIME ZONE 'America/Maceio'))
        AND (${f.fim??null}::text IS NULL OR v.data_inicio < (${f.fim??null}::text::timestamptz AT TIME ZONE 'America/Maceio'))`;
    const total=Number(n.total);if(!Number.isSafeInteger(total))throw new Error('Contagem fora do intervalo suportado.');return {dados,total};
  });
}
/** Lê detalhes somente no escopo permitido. */
export async function detalharViagem(id:string,usuarioId:string|null) {
  const [v]=await sql`SELECT v.id::text,s.id::text AS "solicitacaoId",s.codigo,s.origem,s.destino,s.finalidade,s.qtd_passageiros AS "qtdPassageiros",v.status,v.km_inicial AS "kmInicial",v.km_final AS "kmFinal",
    to_char(s.data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraSaida",to_char(s.data_hora_retorno_previsto,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraRetornoPrevisto",
    to_char(v.data_inicio,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataInicio",to_char(v.data_fim,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataFim",
    CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object('id',m.id::text,'nome',m.nome) END AS motorista,
    CASE WHEN ve.id IS NULL THEN NULL ELSE json_build_object('id',ve.id::text,'placa',ve.placa,'modelo',ve.modelo) END AS veiculo,
    v.validada_por_gestor AS "validadaPorGestor",to_char(v.validada_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS "validadaEm"
    FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id LEFT JOIN public.motorista m ON m.id=v.motorista_id LEFT JOIN public.veiculo ve ON ve.id=v.veiculo_id
    WHERE v.id=${id} AND (${usuarioId}::bigint IS NULL OR m.usuario_id=${usuarioId}::bigint)`;
  if(!v)throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');return v;
}
/** Lista eventos reais vinculados à solicitação da viagem autorizada. */
export async function historicoViagem(id:string,usuarioId:string|null,page:number,limit:number) {
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const [v]=await tx`SELECT v.solicitacao_id::text FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id LEFT JOIN public.motorista m ON m.id=v.motorista_id WHERE v.id=${id} AND (${usuarioId}::bigint IS NULL OR m.usuario_id=${usuarioId}::bigint)`;
    if(!v)throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
    const eventos=await tx`SELECT id::text,descricao,to_char(data_hora,'YYYY-MM-DD"T"HH24:MI:SS.US') AS "dataHora" FROM public.log_atividade
      WHERE solicitacao_viagem_id=${v.solicitacao_id} AND (tipo_evento IN ('solicitacao_viagem_iniciada','solicitacao_viagem_concluida') OR (${usuarioId}::bigint IS NULL AND tipo_evento IN ('solicitacao_viagem_validada','solicitacao_viagem_quilometragem_corrigida')))
      ORDER BY data_hora ASC NULLS LAST,id ASC LIMIT ${limit} OFFSET ${(page-1)*limit}`;
    const [n]=await tx`SELECT count(*)::text AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${v.solicitacao_id} AND (tipo_evento IN ('solicitacao_viagem_iniciada','solicitacao_viagem_concluida') OR (${usuarioId}::bigint IS NULL AND tipo_evento IN ('solicitacao_viagem_validada','solicitacao_viagem_quilometragem_corrigida')))`;
    const total=Number(n.total);if(!Number.isSafeInteger(total))throw new Error('Contagem fora do intervalo suportado.');return {eventos,total};
  });
}

/** Consulta apenas metadados das versões associadas a uma viagem autorizada. */
export async function listarEvidencias(id:string,usuarioId:string|null,page:number,limit:number) {
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const [viagem]=await tx`SELECT v.id FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id LEFT JOIN public.motorista m ON m.id=v.motorista_id WHERE v.id=${id} AND (${usuarioId}::bigint IS NULL OR m.usuario_id=${usuarioId}::bigint)`;
    if(!viagem)throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
    const dados=await tx`SELECT id::text,momento,versao,nome,tipo,enviado_por_id::text AS "enviadoPorId",to_char(criado_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS "criadoEm" FROM public.viagem_evidencia WHERE viagem_id=${id} ORDER BY criado_em ASC,id ASC LIMIT ${limit} OFFSET ${(page-1)*limit}`;
    const [count]=await tx`SELECT count(*)::text AS total FROM public.viagem_evidencia WHERE viagem_id=${id}`;
    const total=Number(count.total);if(!Number.isSafeInteger(total))throw new Error('Contagem fora do intervalo suportado.');return {dados,total};
  });
}
/** Busca bytes apenas se o destinatário puder acessar a viagem vinculada. */
export async function baixarEvidencia(id:string,usuarioId:string|null) {
  const [row]=await sql`SELECT e.tipo,e.dados FROM public.viagem_evidencia e JOIN public.viagem v ON v.id=e.viagem_id JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id LEFT JOIN public.motorista m ON m.id=v.motorista_id WHERE e.id=${id} AND (${usuarioId}::bigint IS NULL OR m.usuario_id=${usuarioId}::bigint)`;
  if(!row)throw new ErroHttp(404,'NAO_ENCONTRADO','Evidência não encontrada.');return row;
}

/** Consulta as versões persistidas da correção para a gestão. */
export async function listarCorrecoes(id:string,page:number,limit:number) {
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const [v]=await tx`SELECT v.id FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE v.id=${id}`;
    if(!v)throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
    const dados=await tx`SELECT id::text,versao,km_inicial_anterior AS "kmInicialAnterior",km_final_anterior AS "kmFinalAnterior",km_inicial AS "kmInicial",km_final AS "kmFinal",justificativa,autor_id::text AS "autorId",to_char(criado_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS "criadoEm" FROM public.viagem_correcao WHERE viagem_id=${id} ORDER BY versao ASC LIMIT ${limit} OFFSET ${(page-1)*limit}`;
    const [count]=await tx`SELECT count(*)::text AS total FROM public.viagem_correcao WHERE viagem_id=${id}`;
    const total=Number(count.total);if(!Number.isSafeInteger(total))throw new Error('Contagem fora do intervalo suportado.');return {dados,total};
  });
}
