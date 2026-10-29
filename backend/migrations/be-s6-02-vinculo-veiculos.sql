-- BE-S6-02: campos de vínculo e fornecedor de locação.
-- NÃO executar sem validação da estrutura do banco pela equipe.

ALTER TABLE veiculo
  ADD COLUMN IF NOT EXISTS vinculo VARCHAR(10) NOT NULL DEFAULT 'PROPRIO',
  ADD COLUMN IF NOT EXISTS fornecedor_locacao VARCHAR(255);

ALTER TABLE veiculo
  ADD CONSTRAINT veiculo_vinculo_check
  CHECK (vinculo IN ('PROPRIO', 'LOCADO'));
