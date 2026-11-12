-- Reversão manual, em transação. Nunca apaga evidências/histórico/notas existentes.
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.anexo, public.documento_historico, public.anotacao IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.anexo)
    OR EXISTS (SELECT 1 FROM public.documento_historico)
    OR EXISTS (SELECT 1 FROM public.anotacao) THEN
    RAISE EXCEPTION 'Rollback SCRUM-192 recusado: preserve anexos, histórico e anotações antes de reverter.';
  END IF;
END $$;
DROP TABLE public.documento_historico;
DROP TABLE public.anotacao;
DROP TABLE public.anexo;
DROP INDEX public.documento_veiculo_vencimento_idx;
DROP INDEX public.motorista_validade_cnh_idx;
