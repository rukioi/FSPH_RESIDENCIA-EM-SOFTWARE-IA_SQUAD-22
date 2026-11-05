-- SCRUM-137: campo finalidade da solicitação de transporte
-- Alteração já aplicada manualmente no Supabase em 04/11/2026.
ALTER TABLE public.solicitacao_viagem ADD COLUMN IF NOT EXISTS finalidade TEXT;
