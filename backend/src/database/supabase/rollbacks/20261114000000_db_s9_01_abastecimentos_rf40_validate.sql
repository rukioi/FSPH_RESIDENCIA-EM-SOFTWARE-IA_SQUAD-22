-- Reverte somente o estado de validação; constraints continuam impondo regras novas.
-- PostgreSQL não oferece UNVALIDATE. Recriar NOT VALID usa lock de metadados breve;
-- não apaga nem normaliza linhas legadas que possam não satisfazer as constraints.
ALTER TABLE public.abastecimento
  DROP CONSTRAINT abastecimento_criado_por_id_fkey,
  DROP CONSTRAINT abastecimento_litragem_positiva,
  DROP CONSTRAINT abastecimento_valor_positivo,
  DROP CONSTRAINT abastecimento_quilometragem_valida,
  ADD CONSTRAINT abastecimento_criado_por_id_fkey FOREIGN KEY (criado_por_id) REFERENCES public.usuario(id) NOT VALID,
  ADD CONSTRAINT abastecimento_litragem_positiva CHECK (litragem > 0 AND litragem <> 'NaN'::numeric) NOT VALID,
  ADD CONSTRAINT abastecimento_valor_positivo CHECK (valor_total > 0 AND valor_total <> 'NaN'::numeric) NOT VALID,
  ADD CONSTRAINT abastecimento_quilometragem_valida CHECK (quilometragem IS NULL OR quilometragem >= 0) NOT VALID;