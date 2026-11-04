-- SCRUM-139: adiciona retorno previsto para agendamento de transporte.
-- Alteracao aplicada manualmente no Supabase em 04/11/2026.
ALTER TABLE public.solicitacao_viagem ADD COLUMN IF NOT EXISTS data_hora_retorno_previsto timestamp without time zone;
ALTER TABLE public.solicitacao_viagem ADD CONSTRAINT solicitacao_viagem_retorno_previsto_check CHECK (data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto > data_hora_saida);
