-- SCRUM-232 / BE-S10-02-A. Aplicar como uma única transação pelo runner.
ALTER TABLE public.manutencao_veiculo_historico
  ADD COLUMN anterior_cancelada_em timestamptz,
  ADD COLUMN posterior_cancelada_em timestamptz,
  ALTER COLUMN anterior_iniciada_em DROP NOT NULL,
  DROP CONSTRAINT manutencao_veiculo_historico_evento_check,
  DROP CONSTRAINT manutencao_veiculo_historico_estado_check,
  DROP CONSTRAINT manutencao_veiculo_historico_instantes_check,
  ADD CONSTRAINT manutencao_veiculo_historico_evento_check CHECK (
    (evento = 'CONCLUSAO' AND status_anterior = 'EM_ANDAMENTO' AND status_posterior = 'CONCLUIDA')
    OR (evento = 'CORRECAO_DATAS' AND status_anterior = 'CONCLUIDA' AND status_posterior = 'CONCLUIDA')
    OR (evento = 'REABERTURA' AND status_anterior = 'CONCLUIDA'
        AND status_posterior IN ('AGENDADA', 'EM_ANDAMENTO'))
    OR (evento = 'CANCELAMENTO' AND status_anterior = 'AGENDADA' AND status_posterior = 'CANCELADA')
    OR (evento = 'REATIVACAO' AND status_anterior = 'CANCELADA'
        AND status_posterior IN ('AGENDADA', 'EM_ANDAMENTO'))
  ),
  ADD CONSTRAINT manutencao_veiculo_historico_estado_check CHECK (
    (anterior_iniciada_em IS NOT NULL) = (status_anterior IN ('EM_ANDAMENTO', 'CONCLUIDA'))
    AND (anterior_concluida_em IS NOT NULL) = (status_anterior = 'CONCLUIDA')
    AND (anterior_cancelada_em IS NOT NULL) = (status_anterior = 'CANCELADA')
    AND (posterior_iniciada_em IS NOT NULL) = (status_posterior IN ('EM_ANDAMENTO', 'CONCLUIDA'))
    AND (posterior_concluida_em IS NOT NULL) = (status_posterior = 'CONCLUIDA')
    AND (posterior_cancelada_em IS NOT NULL) = (status_posterior = 'CANCELADA')
  ),
  ADD CONSTRAINT manutencao_veiculo_historico_instantes_check CHECK (
    isfinite(registrado_em)
    AND (anterior_iniciada_em IS NULL OR isfinite(anterior_iniciada_em))
    AND (anterior_concluida_em IS NULL
      OR (isfinite(anterior_concluida_em) AND anterior_concluida_em >= anterior_iniciada_em))
    AND (anterior_cancelada_em IS NULL OR isfinite(anterior_cancelada_em))
    AND (posterior_iniciada_em IS NULL OR isfinite(posterior_iniciada_em))
    AND (posterior_concluida_em IS NULL
      OR (isfinite(posterior_concluida_em) AND posterior_concluida_em >= posterior_iniciada_em))
    AND (posterior_cancelada_em IS NULL OR isfinite(posterior_cancelada_em))
  );
