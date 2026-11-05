-- SCRUM-163/164: indices justificados por EXPLAIN real em PostgreSQL isolado.
-- Historico anterior imutavel. Nao aplicar automaticamente em banco compartilhado.
-- Em base populada, usar o rollout concorrente/reconciliacao documentado em
-- docs/database/sprint7-indices.md; CREATE INDEX CONCURRENTLY nao cabe neste runner transacional.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE INDEX solicitacao_viagem_autor_id_idx
  ON public.solicitacao_viagem (solicitante_id, id DESC);
CREATE INDEX solicitacao_viagem_saida_status_idx
  ON public.solicitacao_viagem (data_hora_saida, status, id);
CREATE INDEX solicitacao_viagem_motorista_reserva_idx
  ON public.solicitacao_viagem (motorista_id, data_hora_saida)
  INCLUDE (data_hora_retorno_previsto)
  WHERE status IN ('AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO');
CREATE INDEX solicitacao_viagem_veiculo_reserva_idx
  ON public.solicitacao_viagem (veiculo_id, data_hora_saida)
  INCLUDE (data_hora_retorno_previsto)
  WHERE status IN ('AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO');
CREATE INDEX solicitacao_viagem_fila_pendente_idx
  ON public.solicitacao_viagem (criado_em, id)
  WHERE status = 'PENDENTE';
