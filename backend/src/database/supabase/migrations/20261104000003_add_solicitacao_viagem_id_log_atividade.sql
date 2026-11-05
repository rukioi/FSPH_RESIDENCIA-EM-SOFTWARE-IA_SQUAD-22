-- SCRUM-157: vincula registros de auditoria a solicitacoes de transporte.
-- Alteracao aplicada manualmente no Supabase em 04/11/2026.
ALTER TABLE public.log_atividade ADD COLUMN IF NOT EXISTS solicitacao_viagem_id BIGINT REFERENCES public.solicitacao_viagem(id);
CREATE INDEX IF NOT EXISTS idx_log_atividade_solicitacao_viagem_id ON public.log_atividade (solicitacao_viagem_id);
