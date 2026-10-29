-- BE-S6-02: armazenamento de arquivos dos documentos.
-- Executar somente após autorização da equipe.

ALTER TABLE documento_veiculo
ADD COLUMN IF NOT EXISTS arquivo_dados BYTEA,
ADD COLUMN IF NOT EXISTS arquivo_nome VARCHAR(255),
ADD COLUMN IF NOT EXISTS arquivo_tipo VARCHAR(100);