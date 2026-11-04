-- SCRUM-138: adiciona APROVADA ao status das solicitacoes de transporte.
-- Alteracao ja aplicada manualmente no Supabase em 04/11/2026.
ALTER TYPE public.status_solicitacao ADD VALUE IF NOT EXISTS 'APROVADA' AFTER 'PENDENTE';
