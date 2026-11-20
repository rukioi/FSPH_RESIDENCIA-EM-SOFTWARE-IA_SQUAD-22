-- SCRUM-179: somente metadados. Nao le arquivos nem altera estruturas.
-- Execute primeiro. Caso relacoes ou colunas basicas estejam ausentes ou divergentes,
-- interrompa antes de executar inspect-s9-data.sql e encaminhe para reconciliacao.
SELECT 'relacoes' AS verificacao, esperado.nome, c.oid IS NOT NULL AS existe,
       c.relkind AS tipo_relacao, c.relrowsecurity AS rls_ativa
FROM (VALUES ('abastecimento'),('veiculo'),('motorista'),('abastecimento_comprovante'),('anexo')) AS esperado(nome)
LEFT JOIN pg_catalog.pg_class c ON c.oid=to_regclass('public.' || esperado.nome)
ORDER BY esperado.nome;

-- Os tipos abaixo sao o contrato minimo usado por inspect-s9-data.sql.
WITH esperadas(tabela,coluna,tipo,udt_nome,precisao,escala) AS (
  VALUES ('abastecimento','id','bigint','int8',NULL::integer,NULL::integer),
         ('abastecimento','veiculo_id','bigint','int8',NULL,NULL),
         ('abastecimento','motorista_id','bigint','int8',NULL,NULL),
         ('abastecimento','litragem','numeric','numeric',10,2),
         ('abastecimento','valor_total','numeric','numeric',10,2),
         ('abastecimento','quilometragem','integer','int4',NULL,NULL),
         ('abastecimento','data_abastecimento','date','date',NULL,NULL),
         ('veiculo','id','bigint','int8',NULL,NULL),
         ('veiculo','is_svo','boolean','bool',NULL,NULL),
         ('veiculo','tipo','USER-DEFINED','tipo_veiculo',NULL,NULL),
         ('motorista','id','bigint','int8',NULL,NULL)
)
SELECT 'colunas_minimas' AS verificacao,e.tabela,e.coluna,e.tipo AS tipo_esperado,
       c.data_type AS tipo_atual,c.udt_name AS tipo_interno,c.is_nullable AS aceita_null,
       c.numeric_precision AS precisao,c.numeric_scale AS escala,c.domain_name,
       CASE WHEN c.column_name IS NULL THEN 'AUSENTE'
            WHEN c.data_type=e.tipo AND c.udt_name=e.udt_nome AND c.domain_name IS NULL AND c.domain_schema IS NULL
             AND c.udt_schema=CASE WHEN e.udt_nome='tipo_veiculo' THEN 'public' ELSE 'pg_catalog' END
             AND (e.precisao IS NULL OR c.numeric_precision=e.precisao)
             AND (e.escala IS NULL OR c.numeric_scale=e.escala) THEN 'COMPATIVEL'
            ELSE 'DIVERGENTE' END AS resultado
FROM esperadas e LEFT JOIN information_schema.columns c ON c.table_schema='public'
  AND c.table_name=e.tabela AND c.column_name=e.coluna
ORDER BY e.tabela,e.coluna;

SELECT 'colunas' AS verificacao, c.table_name AS tabela, c.ordinal_position AS posicao,
       c.column_name AS coluna, c.data_type AS tipo, c.udt_schema, c.udt_name,
       c.character_maximum_length AS limite_caracteres, c.numeric_precision AS precisao_numerica,
       c.numeric_scale AS escala_numerica, c.is_nullable AS aceita_null,
       c.domain_schema, c.domain_name, (c.column_default IS NOT NULL) AS possui_padrao,
       CASE WHEN c.table_name='abastecimento' AND c.column_name IN ('motorista_id','quilometragem')
            THEN 'nullable na proposta PR 63, sujeito a aprovacao e integracao' END AS observacao
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name IN ('abastecimento','veiculo','motorista','abastecimento_comprovante','anexo')
ORDER BY c.table_name,c.ordinal_position;

SELECT 'constraints' AS verificacao, c.conrelid::regclass::text AS tabela, c.conname AS nome,
       c.contype AS tipo, c.convalidated AS validada, pg_catalog.pg_get_constraintdef(c.oid,false) AS definicao
FROM pg_catalog.pg_constraint c
WHERE c.conrelid IN (to_regclass('public.abastecimento'),to_regclass('public.veiculo'),
                     to_regclass('public.motorista'),to_regclass('public.abastecimento_comprovante'),to_regclass('public.anexo'))
ORDER BY tabela,nome;

SELECT 'indices' AS verificacao, t.relname AS tabela, i.relname AS nome,
       x.indisunique AS unico, x.indisvalid AS valido, x.indisready AS pronto,
       pg_catalog.pg_get_indexdef(i.oid) AS definicao, pg_catalog.pg_get_expr(x.indpred,x.indrelid) AS predicado
FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
JOIN pg_catalog.pg_class t ON t.oid=x.indrelid
WHERE x.indrelid IN (to_regclass('public.abastecimento'),to_regclass('public.veiculo'),
                     to_regclass('public.motorista'),to_regclass('public.abastecimento_comprovante'),to_regclass('public.anexo'))
ORDER BY tabela,nome;
