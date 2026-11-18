import type postgres from 'postgres';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { alertasDocumentais, filtroAlertasDocumentais } from './documentos.gestao.schemas.js';

/** Classifica cada validade pelo limiar vigente, no calendário civil institucional. */
export function vencimentosRf46(tx: postgres.TransactionSql, referencia?: string) {
  return tx`
    WITH referencia AS (
      SELECT coalesce(${referencia ?? null}::text::date,
        (transaction_timestamp() AT TIME ZONE 'America/Maceio')::date) AS hoje
    ), documentos AS (
      SELECT d.id, 'DOCUMENTO_VEICULO'::text AS tipo, d.veiculo_id AS registro_id,
        d.tipo_documento AS descricao, v.placa AS responsavel, d.data_vencimento AS validade
      FROM public.documento_veiculo d
      LEFT JOIN public.veiculo v ON v.id = d.veiculo_id
      UNION ALL
      SELECT m.id, 'CNH_MOTORISTA', m.id, 'CNH', m.nome, m.validade_cnh
      FROM public.motorista m
    )
    SELECT id, tipo, registro_id, descricao, responsavel, validade, validade - hoje AS dias_restantes,
      CASE
        WHEN validade < hoje THEN 'VENCIDO'
        WHEN validade = hoje THEN 'HOJE'
        WHEN hoje >= validade - 7 THEN 'SEMANA'
        ELSE 'MES'
      END AS fase
    FROM documentos CROSS JOIN referencia
    WHERE hoje >= (validade - interval '1 month')::date`;
}

/** Publica a fase atual, com página e total consistentes e sem expor número de CNH. */
export async function listarAlertasDocumentais(params: URLSearchParams) {
  const invalido = () => new ErroHttp(400, 'DADOS_INVALIDOS', 'Use tipo, page e limit válidos.');
  for (const chave of params.keys()) {
    if (params.getAll(chave).length !== 1) throw invalido();
    if ((chave === 'page' || chave === 'limit') && !/^[1-9]\d*$/.test(params.get(chave)!)) throw invalido();
  }
  const filtro = filtroAlertasDocumentais.safeParse(Object.fromEntries(params));
  if (!filtro.success) throw invalido();
  const { tipo, page, limit } = filtro.data;
  return sql.begin('isolation level repeatable read read only', async tx => {
    const coorte = vencimentosRf46(tx);
    const where = tx`WHERE (${tipo ?? null}::text IS NULL OR tipo = ${tipo ?? null})`;
    const rows = await tx`SELECT id::text, tipo, registro_id::text AS "registroId", descricao,
        responsavel, to_char(validade,'YYYY-MM-DD') AS "dataValidade", dias_restantes AS "diasRestantes", fase
      FROM (${coorte}) alertas ${where}
      ORDER BY validade, tipo, id LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    const [total] = await tx`SELECT count(*)::int AS quantidade FROM (${coorte}) alertas ${where}`;
    return alertasDocumentais.parse({ data: rows, meta: { page, limit, total: total.quantidade } });
  });
}
