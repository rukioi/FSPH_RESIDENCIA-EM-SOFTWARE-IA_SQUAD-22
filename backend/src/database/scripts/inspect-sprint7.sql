-- Preflight de catálogo SOMENTE LEITURA. Não repara histórico nem aprova rollout.
WITH esperadas(table_name,column_name,data_type,character_maximum_length,is_nullable) AS (
  VALUES ('solicitacao_viagem','codigo','character varying',20,'NO'),
         ('solicitacao_viagem','origem','character varying',255,'NO'),
         ('solicitacao_viagem','destino','character varying',255,'NO'),
         ('log_atividade','descricao','text',NULL,'NO')
), atuais AS (
  SELECT table_name,column_name,data_type,character_maximum_length,is_nullable,column_default,domain_name,domain_schema,ordinal_position
  FROM information_schema.columns
  WHERE table_schema='public' AND
   ((table_name='solicitacao_viagem' AND column_name IN ('id','codigo','finalidade','status','data_hora_saida','data_hora_retorno_previsto','solicitante_id','motorista_id','veiculo_id','motivo_rejeicao','origem','destino')) OR
    (table_name='log_atividade' AND column_name IN ('solicitacao_viagem_id','data_hora','usuario_id','acao','descricao')))
)
SELECT 'colunas' AS verificacao,COALESCE(a.table_name,e.table_name) AS table_name,
 COALESCE(a.column_name,e.column_name) AS column_name,a.data_type,a.character_maximum_length,a.is_nullable,a.column_default,a.domain_name,a.domain_schema,
 e.data_type AS tipo_esperado,e.character_maximum_length AS limite_esperado,e.is_nullable AS nulabilidade_esperada,
 CASE WHEN e.column_name IS NULL THEN NULL WHEN a.column_name IS NULL THEN 'AUSENTE'
      WHEN a.data_type=e.data_type AND a.character_maximum_length IS NOT DISTINCT FROM e.character_maximum_length
       AND a.is_nullable=e.is_nullable AND a.domain_name IS NULL AND a.domain_schema IS NULL THEN 'EQUIVALENTE' ELSE 'DIVERGENTE' END AS compatibilidade
FROM atuais a FULL JOIN esperadas e ON a.table_name=e.table_name AND a.column_name=e.column_name
ORDER BY table_name,a.ordinal_position NULLS LAST,column_name;

SELECT 'estados' AS verificacao, e.enumlabel, e.enumsortorder
FROM pg_catalog.pg_enum e JOIN pg_catalog.pg_type t ON t.oid=e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' AND t.typname='status_solicitacao' ORDER BY e.enumsortorder;

SELECT 'constraints' AS verificacao, c.conrelid::regclass::text AS tabela,c.conname,c.contype,c.convalidated,
 pg_catalog.pg_get_constraintdef(c.oid,false) AS definicao
FROM pg_catalog.pg_constraint c
WHERE c.conrelid IN (to_regclass('public.solicitacao_viagem'),to_regclass('public.log_atividade'))
ORDER BY tabela,c.conname;

SELECT 'indices' AS verificacao, t.relname AS tabela, i.relname AS nome,x.indisvalid,x.indisready,
 pg_catalog.pg_get_indexdef(i.oid) AS definicao,pg_catalog.pg_get_expr(x.indpred,x.indrelid) AS predicado
FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
JOIN pg_catalog.pg_class t ON t.oid=x.indrelid
WHERE x.indrelid IN (to_regclass('public.solicitacao_viagem'),to_regclass('public.log_atividade'))
ORDER BY tabela,nome;

SELECT 'historico' AS verificacao,
 to_regclass('supabase_migrations.schema_migrations')::text AS historico_supabase,
 to_regclass('fsph_test_harness.migrations')::text AS historico_isolado;
