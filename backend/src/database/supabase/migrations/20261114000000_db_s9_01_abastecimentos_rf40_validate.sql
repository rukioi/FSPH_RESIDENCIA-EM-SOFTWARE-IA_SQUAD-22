-- SCRUM-179: valida constraints RF40 em migration própria, após o DDL rápido NOT VALID.
-- O runner executa cada migration em transação separada; VALIDATE permite DML concorrente.
ALTER TABLE public.abastecimento VALIDATE CONSTRAINT abastecimento_criado_por_id_fkey;
ALTER TABLE public.abastecimento VALIDATE CONSTRAINT abastecimento_litragem_positiva;
ALTER TABLE public.abastecimento VALIDATE CONSTRAINT abastecimento_valor_positivo;
ALTER TABLE public.abastecimento VALIDATE CONSTRAINT abastecimento_quilometragem_valida;