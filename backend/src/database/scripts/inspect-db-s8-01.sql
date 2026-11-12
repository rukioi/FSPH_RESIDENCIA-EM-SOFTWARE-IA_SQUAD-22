-- Preflight SOMENTE LEITURA de DB-S8-01 (SCRUM-166). Executar antes e depois da
-- migration 20261109200000. Retorna contagens e metadados, sem dado pessoal.
-- Não repara histórico, não valida constraints e não aprova rollout sozinho.
-- Contagem > 0 em viagens_legadas impede VALIDATE CONSTRAINT até reconciliação.
SELECT 'viagens_legadas' AS verificacao,
  count(*)::int AS total,
  count(*) FILTER (WHERE NOT (v.solicitacao_id IS NOT NULL AND v.veiculo_id IS NOT NULL
    AND v.motorista_id IS NOT NULL AND v.status IS NOT NULL))::int AS sem_dados_obrigatorios,
  count(*) FILTER (WHERE v.km_inicial < 0)::int AS km_inicial_negativo,
  count(*) FILTER (WHERE v.km_final IS NOT NULL
    AND (v.km_inicial IS NULL OR v.km_final < v.km_inicial))::int AS km_final_invalido,
  count(*) FILTER (WHERE v.data_fim IS NOT NULL
    AND (v.data_inicio IS NULL OR v.data_fim < v.data_inicio))::int AS periodo_invalido,
  count(*) FILTER (WHERE (v.status::text = 'EM_TRANSPORTE' AND (v.data_inicio IS NULL OR v.km_inicial IS NULL))
    OR (v.status::text = 'CONCLUIDA' AND (v.data_inicio IS NULL OR v.km_inicial IS NULL
      OR v.data_fim IS NULL OR v.km_final IS NULL)))::int AS execucao_incompleta,
  count(*) FILTER (WHERE
    (v.validada_por_gestor IS TRUE AND (to_jsonb(v) ->> 'validada_por_id' IS NULL
      OR to_jsonb(v) ->> 'validada_em' IS NULL OR v.status::text IS DISTINCT FROM 'CONCLUIDA'))
    OR (v.validada_por_gestor IS NOT TRUE AND (to_jsonb(v) ->> 'validada_por_id' IS NOT NULL
      OR to_jsonb(v) ->> 'validada_em' IS NOT NULL)))::int AS validacao_inconsistente
FROM public.viagem v;

SELECT 'associacao' AS verificacao,
  count(*)::int AS total,
  count(*) FILTER (WHERE s.status::text IN ('PENDENTE', 'APROVADA', 'REPROVADA'))::int AS solicitacao_nao_agendada,
  count(*) FILTER (WHERE v.motorista_id IS DISTINCT FROM s.motorista_id
    OR v.veiculo_id IS DISTINCT FROM s.veiculo_id)::int AS recursos_divergentes
FROM public.viagem v
JOIN public.solicitacao_viagem s ON s.id = v.solicitacao_id;

SELECT 'constraints' AS verificacao, c.conrelid::regclass::text AS tabela, c.conname, c.contype, c.convalidated
FROM pg_catalog.pg_constraint c
WHERE c.conrelid IN (to_regclass('public.viagem'), to_regclass('public.notificacao'),
  to_regclass('public.viagem_evidencia'), to_regclass('public.viagem_correcao'))
ORDER BY tabela, c.conname;

SELECT 'protecao' AS verificacao, t.nome, c.oid IS NOT NULL AS existe, c.relrowsecurity AS rls,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon', c.oid, 'SELECT') END AS anon_select,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('authenticated', c.oid, 'SELECT') END AS authenticated_select
FROM (VALUES ('viagem_evidencia'), ('viagem_correcao'), ('notificacao')) AS t(nome)
LEFT JOIN pg_catalog.pg_class c ON c.oid = to_regclass('public.' || t.nome)
ORDER BY t.nome;
