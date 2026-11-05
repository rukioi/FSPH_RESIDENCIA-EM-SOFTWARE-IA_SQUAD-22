-- Preflight de catálogo SOMENTE LEITURA. Não repara histórico nem aprova rollout.
SELECT 'colunas' AS verificacao, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND
 ((table_name='solicitacao_viagem' AND column_name IN ('id','codigo','finalidade','status','data_hora_saida','data_hora_retorno_previsto','solicitante_id','motorista_id','veiculo_id','motivo_rejeicao')) OR
  (table_name='log_atividade' AND column_name IN ('solicitacao_viagem_id','data_hora','usuario_id','acao')))
ORDER BY table_name,ordinal_position;

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
