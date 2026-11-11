-- Caixa individual: eventos e leituras confirmam junto da operação responsável.
CREATE TABLE public.notificacao (
  id bigserial PRIMARY KEY,
  usuario_id bigint NOT NULL REFERENCES public.usuario(id) ON DELETE CASCADE,
  chave text NOT NULL,
  titulo varchar(200) NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('informacao','atencao','urgente','sucesso')),
  criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  lida_em timestamptz,
  UNIQUE (usuario_id, chave)
);
CREATE INDEX notificacao_caixa_idx ON public.notificacao (usuario_id, criado_em DESC, id DESC);
CREATE INDEX notificacao_nao_lida_idx ON public.notificacao (usuario_id) WHERE lida_em IS NULL;
-- Somente o backend acessa a caixa. O dono mantém acesso; nenhum cliente Data API ganha grants.
REVOKE ALL ON public.notificacao FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.notificacao_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE public.notificacao ENABLE ROW LEVEL SECURITY;
