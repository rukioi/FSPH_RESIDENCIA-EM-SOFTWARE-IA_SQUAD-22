-- BE-S6-02: campos de vínculo e fornecedor de locação.
-- NÃO executar sem validação da estrutura do banco pela equipe.

ALTER TABLE veiculo
  ADD COLUMN IF NOT EXISTS vinculo VARCHAR(10) NOT NULL DEFAULT 'PROPRIO',
  ADD COLUMN IF NOT EXISTS fornecedor_locacao VARCHAR(255);

-- Adiciona a restrição sem validar imediatamente os registros antigos.
-- Evita erro caso a restrição já exista.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'veiculo_vinculo_check'
      AND conrelid = 'veiculo'::regclass
  ) THEN
    ALTER TABLE veiculo
      ADD CONSTRAINT veiculo_vinculo_check
      CHECK (vinculo IN ('PROPRIO', 'LOCADO')) NOT VALID;
  END IF;
END
$$;

-- Executar a validação separadamente, após aprovação da equipe:
-- ALTER TABLE veiculo VALIDATE CONSTRAINT veiculo_vinculo_check;