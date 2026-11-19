-- SCRUM-192: base compartilhada para SCRUM-194/193/196.
-- Somente estruturas novas. Não migra bytes, altera CNHs nem inventa histórico.
-- Alertas RF46 aguardam calendário, fuso e deduplicação aprovados; legado intacto.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Armazenamento privado transacional no PostgreSQL, como nos uploads existentes.
-- Uma linha pertence a exatamente um registro. Hash igual NÃO concede acesso
-- nem funde anexos pertencentes a registros diferentes. Não há URL pública.
CREATE TABLE public.anexo (
  id bigserial PRIMARY KEY,
  chave uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  nome text NOT NULL,
  tipo text NOT NULL,
  tamanho integer NOT NULL,
  sha256 text NOT NULL,
  dados bytea NOT NULL,
  autor_id bigint NOT NULL REFERENCES public.usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  solicitacao_viagem_id bigint REFERENCES public.solicitacao_viagem(id),
  solicitacao_obito_id bigint REFERENCES public.solicitacao_obito(id),
  viagem_id bigint REFERENCES public.viagem(id),
  ordem_coleta_id bigint REFERENCES public.ordem_coleta(id),
  abastecimento_id bigint REFERENCES public.abastecimento(id),
  veiculo_id bigint REFERENCES public.veiculo(id),
  motorista_id bigint REFERENCES public.motorista(id),
  documento_veiculo_id bigint REFERENCES public.documento_veiculo(id),
  CONSTRAINT anexo_registro_check CHECK (num_nonnulls(solicitacao_viagem_id,
    solicitacao_obito_id, viagem_id, ordem_coleta_id, abastecimento_id,
    veiculo_id, motorista_id, documento_veiculo_id) = 1),
  CONSTRAINT anexo_nome_check CHECK (char_length(btrim(nome)) BETWEEN 1 AND 255
    AND nome !~ '[[:cntrl:]/]' AND position(chr(92) in nome) = 0 AND nome NOT IN ('.', '..')),
  CONSTRAINT anexo_tamanho_check CHECK (tamanho BETWEEN 1 AND 5242880 AND tamanho = octet_length(dados)),
  CONSTRAINT anexo_hash_check CHECK (sha256 = encode(sha256(dados), 'hex')),
  CONSTRAINT anexo_assinatura_check CHECK (
    (tipo = 'application/pdf' AND substring(dados FROM 1 FOR 5) = decode('255044462d', 'hex'))
    OR (tipo = 'image/png' AND substring(dados FROM 1 FOR 8) = decode('89504e470d0a1a0a', 'hex'))
    OR (tipo = 'image/jpeg' AND substring(dados FROM 1 FOR 3) = decode('ffd8ff', 'hex'))),
  CONSTRAINT anexo_documento_key UNIQUE (id, documento_veiculo_id),
  CONSTRAINT anexo_motorista_key UNIQUE (id, motorista_id)
);

CREATE INDEX anexo_solicitacao_viagem_idx ON public.anexo (solicitacao_viagem_id, criado_em DESC, id DESC) WHERE solicitacao_viagem_id IS NOT NULL;
CREATE INDEX anexo_solicitacao_obito_idx ON public.anexo (solicitacao_obito_id, criado_em DESC, id DESC) WHERE solicitacao_obito_id IS NOT NULL;
CREATE INDEX anexo_viagem_idx ON public.anexo (viagem_id, criado_em DESC, id DESC) WHERE viagem_id IS NOT NULL;
CREATE INDEX anexo_ordem_idx ON public.anexo (ordem_coleta_id, criado_em DESC, id DESC) WHERE ordem_coleta_id IS NOT NULL;
CREATE INDEX anexo_abastecimento_idx ON public.anexo (abastecimento_id, criado_em DESC, id DESC) WHERE abastecimento_id IS NOT NULL;
CREATE INDEX anexo_veiculo_idx ON public.anexo (veiculo_id, criado_em DESC, id DESC) WHERE veiculo_id IS NOT NULL;
CREATE INDEX anexo_motorista_idx ON public.anexo (motorista_id, criado_em DESC, id DESC) WHERE motorista_id IS NOT NULL;
CREATE INDEX anexo_documento_idx ON public.anexo (documento_veiculo_id, criado_em DESC, id DESC) WHERE documento_veiculo_id IS NOT NULL;

-- Versões registradas pela API na transação do cadastro/edição. Não atribui autor
-- ou instante fictício aos dados antigos. CNH continua no cadastro de motorista.
CREATE TABLE public.documento_historico (
  id bigserial PRIMARY KEY,
  documento_veiculo_id bigint REFERENCES public.documento_veiculo(id),
  motorista_id bigint REFERENCES public.motorista(id),
  versao integer NOT NULL CHECK (versao >= 1),
  tipo_documento varchar(50),
  data_vencimento date NOT NULL,
  status_regular boolean,
  numero_cnh varchar(20),
  categoria_cnh varchar(5),
  anexo_id bigint,
  autor_id bigint NOT NULL REFERENCES public.usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT documento_historico_registro_check CHECK (num_nonnulls(documento_veiculo_id, motorista_id) = 1),
  CONSTRAINT documento_historico_dados_check CHECK (
    (documento_veiculo_id IS NOT NULL AND tipo_documento IS NOT NULL AND btrim(tipo_documento) <> ''
      AND numero_cnh IS NULL AND categoria_cnh IS NULL)
    OR (motorista_id IS NOT NULL AND tipo_documento IS NULL AND status_regular IS NULL
      AND numero_cnh IS NOT NULL AND btrim(numero_cnh) <> ''
      AND categoria_cnh IS NOT NULL AND btrim(categoria_cnh) <> '')),
  CONSTRAINT documento_historico_documento_versao_key UNIQUE (documento_veiculo_id, versao),
  CONSTRAINT documento_historico_motorista_versao_key UNIQUE (motorista_id, versao),
  CONSTRAINT documento_historico_anexo_documento_fk FOREIGN KEY (anexo_id, documento_veiculo_id)
    REFERENCES public.anexo(id, documento_veiculo_id),
  CONSTRAINT documento_historico_anexo_motorista_fk FOREIGN KEY (anexo_id, motorista_id)
    REFERENCES public.anexo(id, motorista_id)
);
CREATE INDEX documento_historico_vencimento_idx ON public.documento_historico (data_vencimento, id);
CREATE INDEX documento_veiculo_vencimento_idx ON public.documento_veiculo (data_vencimento, id);
CREATE INDEX motorista_validade_cnh_idx ON public.motorista (validade_cnh, id);

-- RF48: nota append-only; não altera status/decisão nos módulos responsáveis.
CREATE TABLE public.anotacao (
  id bigserial PRIMARY KEY,
  solicitacao_viagem_id bigint REFERENCES public.solicitacao_viagem(id),
  solicitacao_obito_id bigint REFERENCES public.solicitacao_obito(id),
  viagem_id bigint REFERENCES public.viagem(id),
  ordem_coleta_id bigint REFERENCES public.ordem_coleta(id),
  veiculo_id bigint REFERENCES public.veiculo(id),
  texto text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 2000),
  autor_id bigint NOT NULL REFERENCES public.usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT anotacao_registro_check CHECK (num_nonnulls(solicitacao_viagem_id,
    solicitacao_obito_id, viagem_id, ordem_coleta_id, veiculo_id) = 1)
);
CREATE INDEX anotacao_solicitacao_viagem_idx ON public.anotacao (solicitacao_viagem_id, criado_em DESC, id DESC) WHERE solicitacao_viagem_id IS NOT NULL;
CREATE INDEX anotacao_solicitacao_obito_idx ON public.anotacao (solicitacao_obito_id, criado_em DESC, id DESC) WHERE solicitacao_obito_id IS NOT NULL;
CREATE INDEX anotacao_viagem_idx ON public.anotacao (viagem_id, criado_em DESC, id DESC) WHERE viagem_id IS NOT NULL;
CREATE INDEX anotacao_ordem_idx ON public.anotacao (ordem_coleta_id, criado_em DESC, id DESC) WHERE ordem_coleta_id IS NOT NULL;
CREATE INDEX anotacao_veiculo_idx ON public.anotacao (veiculo_id, criado_em DESC, id DESC) WHERE veiculo_id IS NOT NULL;

ALTER TABLE public.anexo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anotacao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.anexo, public.documento_historico, public.anotacao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.anexo_id_seq, public.documento_historico_id_seq, public.anotacao_id_seq FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.anexo, public.documento_historico, public.anotacao FROM postgres, service_role;
-- RLS sem policies nega Data API. Autorização por registro pertence às APIs
-- SCRUM-194/193/196. Papel runtime remoto deve ser confirmado antes do rollout.
