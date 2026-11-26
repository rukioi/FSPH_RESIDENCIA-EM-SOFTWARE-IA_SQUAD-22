-- Reversão manual, em transação. Nunca apaga escala, ausência, matriz ou transição.
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.escala_motorista, public.indisponibilidade_motorista,
  public.habilitacao_categoria_veiculo, public.motorista_transicao_profissional IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.escala_motorista)
    OR EXISTS (SELECT 1 FROM public.indisponibilidade_motorista)
    OR EXISTS (SELECT 1 FROM public.habilitacao_categoria_veiculo)
    OR EXISTS (SELECT 1 FROM public.motorista_transicao_profissional) THEN
    RAISE EXCEPTION 'Rollback SCRUM-219 recusado: preserve escalas, ausências, matriz e transições antes de reverter.';
  END IF;
END $$;
DROP TABLE public.motorista_transicao_profissional;
DROP TABLE public.habilitacao_categoria_veiculo;
DROP TABLE public.indisponibilidade_motorista;
DROP TABLE public.escala_motorista;
