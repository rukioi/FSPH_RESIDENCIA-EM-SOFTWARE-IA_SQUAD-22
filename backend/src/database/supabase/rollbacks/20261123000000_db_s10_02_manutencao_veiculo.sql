-- SCRUM-231 / DB-S10-02-B. Executar como script autônomo.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.manutencao_veiculo, public.manutencao_veiculo_historico IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.manutencao_veiculo_historico)
    OR EXISTS (SELECT 1 FROM public.manutencao_veiculo) THEN
    RAISE EXCEPTION 'Rollback SCRUM-231 recusado: preserve as ocorrências e o histórico de manutenção.';
  END IF;
END $$;

-- DROP TABLE remove também as sequências bigserial vinculadas às colunas.
DROP TABLE public.manutencao_veiculo_historico;
DROP TABLE public.manutencao_veiculo;
DROP TYPE public.status_manutencao_veiculo;
DROP TYPE public.tipo_manutencao_veiculo;
COMMIT;
