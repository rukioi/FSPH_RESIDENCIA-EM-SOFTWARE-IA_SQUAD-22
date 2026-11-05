import type {z} from 'zod';
import {sql} from '../../database/connection.js';
import {ErroHttp} from '../../shared/http/errors.js';
import type {detalheSolicitacao,itemHistorico} from './solicitacoes.schemas.js';

/** Retorna somente um pedido acessível; ausência e acesso indevido são indistinguíveis. */
export async function consultarDetalhes(id:string,solicitanteId:string|null):Promise<z.infer<typeof detalheSolicitacao>> {
  const [row]=await sql<z.infer<typeof detalheSolicitacao>[]>`SELECT s.id::text,s.codigo,'#'||s.codigo AS "codigoExibicao",
    CASE WHEN s.solicitante_id IS NULL THEN NULL ELSE json_build_object('id',s.solicitante_id::text,'nome',u.nome) END AS solicitante,
    s.origem,s.destino,s.finalidade,s.status,s.qtd_passageiros AS "qtdPassageiros",s.motivo_rejeicao AS "motivoRejeicao",
    to_char(s.data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraSaida",
    to_char(s.data_hora_retorno_previsto,'YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS "dataHoraRetornoPrevisto",
    CASE WHEN m.id IS NULL THEN NULL ELSE json_build_object('id',m.id::text,'nome',m.nome) END AS motorista,
    CASE WHEN v.id IS NULL THEN NULL ELSE json_build_object('id',v.id::text,'placa',v.placa,'modelo',v.modelo) END AS veiculo
    FROM public.solicitacao_viagem s LEFT JOIN public.usuario u ON u.id=s.solicitante_id
    LEFT JOIN public.motorista m ON m.id=s.motorista_id LEFT JOIN public.veiculo v ON v.id=s.veiculo_id
    WHERE s.id=${id} AND (${solicitanteId}::bigint IS NULL OR s.solicitante_id=${solicitanteId}::bigint)`;
  if(!row)throw new ErroHttp(404,'NAO_ENCONTRADO','Solicitação não encontrada.');
  return row;
}

/** Lê apenas vínculos estruturados, autorizando pedido, página e total no mesmo snapshot. */
export async function consultarHistorico(id:string,solicitanteId:string|null,page:number,limit:number):Promise<{data:z.infer<typeof itemHistorico>[];total:number}> {
  return sql.begin('isolation level repeatable read read only',async tx=>{
    const [pedido]=await tx`SELECT id FROM public.solicitacao_viagem
      WHERE id=${id} AND (${solicitanteId}::bigint IS NULL OR solicitante_id=${solicitanteId}::bigint)`;
    if(!pedido)throw new ErroHttp(404,'NAO_ENCONTRADO','Solicitação não encontrada.');
    const data=await tx<z.infer<typeof itemHistorico>[]>`SELECT l.id::text,l.descricao,
      to_char(l.data_hora,'YYYY-MM-DD"T"HH24:MI:SS.US') AS "dataHora",
      CASE WHEN ${solicitanteId===null} AND u.id IS NOT NULL THEN json_build_object('id',u.id::text,'nome',u.nome) ELSE NULL END AS responsavel
      FROM public.log_atividade l JOIN public.solicitacao_viagem s ON s.id=l.solicitacao_viagem_id
      LEFT JOIN public.usuario u ON u.id=l.usuario_id
      WHERE l.solicitacao_viagem_id=${id} AND (${solicitanteId}::bigint IS NULL OR s.solicitante_id=${solicitanteId}::bigint)
      ORDER BY l.data_hora ASC NULLS LAST,l.id ASC LIMIT ${limit} OFFSET ${(page-1)*limit}`;
    const [count]=await tx`SELECT count(*)::text AS total FROM public.log_atividade l
      JOIN public.solicitacao_viagem s ON s.id=l.solicitacao_viagem_id
      WHERE l.solicitacao_viagem_id=${id} AND (${solicitanteId}::bigint IS NULL OR s.solicitante_id=${solicitanteId}::bigint)`;
    const total=Number(count.total);
    if(!Number.isSafeInteger(total))throw new Error('Contagem fora do intervalo suportado.');
    return {data,total};
  });
}
