-- Somente leitura. Não executa DDL nem registra migrations como aplicadas.
-- Comparação conservadora com a forma canônica de PostgreSQL 17; veja o runbook.
WITH alvo AS (
  SELECT c.oid FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'solicitacao_viagem' AND c.relkind = 'r'
), coluna AS (
  SELECT a.*, pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS valor_default
  FROM pg_catalog.pg_attribute a JOIN alvo t ON t.oid = a.attrelid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attname = 'data_hora_retorno_previsto' AND NOT a.attisdropped
), restricao AS (
  SELECT c.* FROM pg_catalog.pg_constraint c JOIN alvo t ON t.oid = c.conrelid
  WHERE c.conname = 'solicitacao_viagem_retorno_previsto_check'
), evidencia AS (
  SELECT
    EXISTS (SELECT 1 FROM alvo) AS tabela_existe,
    EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a JOIN alvo t ON t.oid = a.attrelid
      WHERE a.attname = 'data_hora_saida' AND NOT a.attisdropped
        AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'timestamp without time zone'
        AND a.attnotnull) AS saida_compativel,
    EXISTS (SELECT 1 FROM coluna) AS coluna_existe,
    EXISTS (SELECT 1 FROM coluna WHERE
      pg_catalog.format_type(atttypid, atttypmod) = 'timestamp without time zone'
      AND NOT attnotnull AND valor_default IS NULL AND attidentity = '' AND attgenerated = '') AS coluna_compativel,
    (SELECT pg_catalog.format_type(atttypid, atttypmod) FROM coluna) AS tipo_coluna,
    EXISTS (SELECT 1 FROM restricao) AS constraint_existe,
    COALESCE((SELECT convalidated FROM restricao), false) AS constraint_validada,
    (SELECT pg_catalog.pg_get_constraintdef(oid, false) FROM restricao) AS definicao_constraint,
    EXISTS (SELECT 1 FROM restricao WHERE contype = 'c' AND convalidated
      AND NOT connoinherit AND conislocal
      AND pg_catalog.pg_get_expr(conbin, conrelid, false) =
        '((data_hora_retorno_previsto IS NULL) OR (data_hora_retorno_previsto > data_hora_saida))') AS constraint_equivalente
)
SELECT e.*, CASE
  WHEN NOT tabela_existe THEN 'TABELA_AUSENTE'
  WHEN NOT saida_compativel THEN 'DIVERGENTE'
  WHEN NOT coluna_existe AND NOT constraint_existe THEN 'AUSENTE'
  WHEN NOT coluna_compativel THEN 'DIVERGENTE'
  WHEN NOT constraint_existe THEN 'PARCIAL'
  WHEN constraint_equivalente THEN 'EQUIVALENTE'
  ELSE 'DIVERGENTE'
END AS estado
FROM evidencia e;
