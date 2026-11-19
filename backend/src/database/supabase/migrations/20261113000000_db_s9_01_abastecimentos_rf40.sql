-- SCRUM-185 / RF40: motorista e km são opcionais; não inferir autoria de registros antigos.
-- Aplicação transacional: dado legado incompatível recusa o incremento sem corrigi-lo/apagá-lo.
ALTER TABLE public.abastecimento
  ALTER COLUMN motorista_id DROP NOT NULL,
  ALTER COLUMN quilometragem DROP NOT NULL,
  ADD COLUMN criado_por_id bigint REFERENCES public.usuario(id),
  ADD CONSTRAINT abastecimento_litragem_positiva CHECK (litragem > 0 AND litragem <> 'NaN'::numeric),
  ADD CONSTRAINT abastecimento_valor_positivo CHECK (valor_total > 0 AND valor_total <> 'NaN'::numeric),
  ADD CONSTRAINT abastecimento_quilometragem_valida CHECK (quilometragem IS NULL OR quilometragem >= 0);

CREATE INDEX idx_abastecimento_veiculo_data
  ON public.abastecimento (veiculo_id, data_abastecimento DESC, id DESC);
CREATE INDEX idx_abastecimento_data
  ON public.abastecimento (data_abastecimento DESC, id DESC);

-- A FK existente aceita toda a frota, incluindo is_svo. Não alterar odômetros/viagens.
-- Comprovante mantém seu vínculo privado existente; o contrato compartilhado depende da SCRUM-194.
