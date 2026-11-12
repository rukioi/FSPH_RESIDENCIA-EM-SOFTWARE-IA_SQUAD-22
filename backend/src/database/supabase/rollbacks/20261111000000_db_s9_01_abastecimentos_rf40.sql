-- Executar somente em transação, após aprovação do responsável pelo ambiente.
-- A prova automática usa exclusivamente o harness isolado e desfaz a transação inteira.
-- Bloqueia gravações antes da verificação e mantém a proteção até o fim da transação.
LOCK TABLE public.abastecimento IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.abastecimento
    WHERE motorista_id IS NULL OR quilometragem IS NULL OR criado_por_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Rollback SCRUM-185 recusado: preserve os registros RF40 e sua autoria antes de reverter.';
  END IF;
END $$;

ALTER TABLE public.abastecimento
  ALTER COLUMN motorista_id SET NOT NULL,
  ALTER COLUMN quilometragem SET NOT NULL,
  DROP CONSTRAINT abastecimento_litragem_positiva,
  DROP CONSTRAINT abastecimento_valor_positivo,
  DROP CONSTRAINT abastecimento_quilometragem_valida,
  DROP COLUMN criado_por_id;
DROP INDEX public.idx_abastecimento_veiculo_data;
DROP INDEX public.idx_abastecimento_data;
