-- SCRUM-232 / BE-S10-02-A. Executar como script autônomo.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.manutencao_veiculo_historico IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.manutencao_veiculo_historico
    WHERE evento IN ('CANCELAMENTO', 'REATIVACAO')
      OR anterior_cancelada_em IS NOT NULL
      OR posterior_cancelada_em IS NOT NULL
      OR anterior_iniciada_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Rollback SCRUM-232 recusado: preserve o histórico de cancelamento e reativação.';
  END IF;
END $$;

ALTER TABLE public.manutencao_veiculo_historico
  DROP CONSTRAINT manutencao_veiculo_historico_evento_check,
  DROP CONSTRAINT manutencao_veiculo_historico_estado_check,
  DROP CONSTRAINT manutencao_veiculo_historico_instantes_check,
  DROP COLUMN anterior_cancelada_em,
  DROP COLUMN posterior_cancelada_em,
  ALTER COLUMN anterior_iniciada_em SET NOT NULL,
  ADD CONSTRAINT manutencao_veiculo_historico_evento_check CHECK (
    (evento = 'CONCLUSAO' AND status_anterior = 'EM_ANDAMENTO' AND status_posterior = 'CONCLUIDA')
    OR (evento = 'CORRECAO_DATAS' AND status_anterior = 'CONCLUIDA' AND status_posterior = 'CONCLUIDA')
    OR (evento = 'REABERTURA' AND status_anterior = 'CONCLUIDA'
        AND status_posterior IN ('AGENDADA', 'EM_ANDAMENTO'))
  ),
  ADD CONSTRAINT manutencao_veiculo_historico_estado_check CHECK (
    (anterior_concluida_em IS NOT NULL) = (status_anterior = 'CONCLUIDA')
    AND (posterior_iniciada_em IS NOT NULL) = (status_posterior IN ('EM_ANDAMENTO', 'CONCLUIDA'))
    AND (posterior_concluida_em IS NOT NULL) = (status_posterior = 'CONCLUIDA')
  ),
  ADD CONSTRAINT manutencao_veiculo_historico_instantes_check CHECK (
    isfinite(anterior_iniciada_em) AND isfinite(registrado_em)
    AND (anterior_concluida_em IS NULL
      OR (isfinite(anterior_concluida_em) AND anterior_concluida_em >= anterior_iniciada_em))
    AND (posterior_iniciada_em IS NULL OR isfinite(posterior_iniciada_em))
    AND (posterior_concluida_em IS NULL
      OR (isfinite(posterior_concluida_em) AND posterior_concluida_em >= posterior_iniciada_em))
  );

COMMIT;
