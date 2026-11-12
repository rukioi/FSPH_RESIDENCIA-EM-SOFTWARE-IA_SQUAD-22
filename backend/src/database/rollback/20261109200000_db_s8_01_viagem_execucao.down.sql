-- Reversão MANUAL de 20261109200000_db_s8_01_viagem_execucao.sql (SCRUM-166).
-- Fica fora de supabase/migrations: nenhum runner aplica este arquivo.
-- Executar somente com autorização explícita, em transação única, por exemplo:
--   psql --single-transaction -v ON_ERROR_STOP=1 -f <este arquivo>
-- Revert de código no Git não executa este arquivo.
--
-- Recusa a reversão se o modelo novo já guardar informação que o esquema anterior
-- não consegue representar (evidências, correções, validação com autor ou avisos
-- vinculados a viagem). Nesse caso, preserve o banco e trate a reversão como
-- incidente: não há DOWN destrutivo automático.
-- Única perda aceita: viagem.criado_em das viagens criadas após a migration,
-- campo inexistente no esquema anterior.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.viagem_evidencia)
     OR EXISTS (SELECT 1 FROM public.viagem_correcao)
     OR EXISTS (SELECT 1 FROM public.viagem
                WHERE validada_por_id IS NOT NULL OR validada_em IS NOT NULL)
     OR EXISTS (SELECT 1 FROM public.notificacao
                WHERE tipo IS NOT NULL OR viagem_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'DB-S8-01: reversão recusada; há dados gravados no modelo novo.'
      USING ERRCODE = 'P0001';
  END IF;
END
$$;

DROP INDEX public.notificacao_viagem_idx;
ALTER TABLE public.notificacao
  DROP CONSTRAINT notificacao_demanda_check,
  DROP CONSTRAINT notificacao_tipo_check,
  DROP CONSTRAINT notificacao_viagem_fk,
  DROP COLUMN viagem_id,
  DROP COLUMN tipo;

DROP TABLE public.viagem_correcao;
DROP TABLE public.viagem_evidencia;

DROP INDEX public.viagem_status_periodo_idx;
DROP INDEX public.viagem_motorista_status_idx;

ALTER TABLE public.viagem
  DROP CONSTRAINT viagem_validacao_check,
  DROP CONSTRAINT viagem_execucao_status_check,
  DROP CONSTRAINT viagem_periodo_check,
  DROP CONSTRAINT viagem_km_final_check,
  DROP CONSTRAINT viagem_km_inicial_check,
  DROP CONSTRAINT viagem_dados_obrigatorios_check,
  DROP CONSTRAINT viagem_validada_por_fk,
  DROP COLUMN validada_em,
  DROP COLUMN validada_por_id,
  DROP COLUMN criado_em;
