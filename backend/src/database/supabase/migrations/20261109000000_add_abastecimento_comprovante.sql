ALTER TABLE public.abastecimento ADD COLUMN tanque_completo boolean NOT NULL DEFAULT false;

CREATE TABLE public.abastecimento_comprovante (
  abastecimento_id bigint PRIMARY KEY REFERENCES public.abastecimento(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL,
  dados bytea NOT NULL,
  CONSTRAINT abastecimento_comprovante_nome_check CHECK (length(nome) BETWEEN 1 AND 255),
  CONSTRAINT abastecimento_comprovante_tipo_check CHECK (tipo IN ('image/jpeg', 'image/png')),
  CONSTRAINT abastecimento_comprovante_tamanho_check CHECK (octet_length(dados) BETWEEN 1 AND 1048576)
);
ALTER TABLE public.abastecimento_comprovante ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.abastecimento_comprovante FROM PUBLIC, anon, authenticated;
