-- SCRUM-231 / DB-S10-02-B. Aplicar como uma única transação.
CREATE TYPE public.tipo_manutencao_veiculo AS ENUM ('PREVENTIVA', 'CORRETIVA');
CREATE TYPE public.status_manutencao_veiculo AS ENUM (
  'AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'
);

CREATE TABLE public.manutencao_veiculo (
  id bigserial PRIMARY KEY,
  veiculo_id bigint NOT NULL REFERENCES public.veiculo(id) ON DELETE RESTRICT,
  tipo public.tipo_manutencao_veiculo NOT NULL,
  descricao text NOT NULL CHECK (char_length(btrim(descricao)) BETWEEN 1 AND 2000),
  -- Datas civis inclusivas, persistidas como meia-noite em America/Maceio.
  entrada_em timestamptz NOT NULL,
  conclusao_prevista_em timestamptz NOT NULL,
  iniciada_em timestamptz,
  concluida_em timestamptz,
  cancelada_em timestamptz,
  quilometragem integer NOT NULL CHECK (quilometragem >= 0),
  custo numeric CHECK (custo IS NULL OR (custo >= 0 AND custo < 'Infinity'::numeric)),
  prestador text CHECK (char_length(btrim(prestador)) BETWEEN 1 AND 255),
  observacoes text CHECK (char_length(btrim(observacoes)) BETWEEN 1 AND 2000),
  status public.status_manutencao_veiculo NOT NULL,
  criado_por_id bigint NOT NULL REFERENCES public.usuario(id) ON DELETE RESTRICT,
  atualizado_por_id bigint NOT NULL REFERENCES public.usuario(id) ON DELETE RESTRICT,
  criado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT manutencao_veiculo_dias_check CHECK (
    CASE WHEN isfinite(entrada_em) AND isfinite(conclusao_prevista_em) THEN
      (entrada_em AT TIME ZONE 'America/Maceio')::time = TIME '00:00'
      AND (conclusao_prevista_em AT TIME ZONE 'America/Maceio')::time = TIME '00:00'
      AND conclusao_prevista_em >= entrada_em
    ELSE false END
  ),
  CONSTRAINT manutencao_veiculo_instantes_check CHECK (
    (iniciada_em IS NULL OR isfinite(iniciada_em))
    AND (concluida_em IS NULL OR (isfinite(concluida_em) AND concluida_em >= iniciada_em))
    AND (cancelada_em IS NULL OR isfinite(cancelada_em))
    AND isfinite(criado_em) AND isfinite(atualizado_em) AND atualizado_em >= criado_em
  ),
  CONSTRAINT manutencao_veiculo_estado_check CHECK (
    (status = 'AGENDADA' AND iniciada_em IS NULL AND concluida_em IS NULL AND cancelada_em IS NULL)
    OR (status = 'EM_ANDAMENTO' AND iniciada_em IS NOT NULL AND concluida_em IS NULL AND cancelada_em IS NULL)
    OR (status = 'CONCLUIDA' AND iniciada_em IS NOT NULL AND concluida_em IS NOT NULL AND cancelada_em IS NULL)
    OR (status = 'CANCELADA' AND iniciada_em IS NULL AND concluida_em IS NULL AND cancelada_em IS NOT NULL)
  )
);

-- Captura somente estados e datas operacionais afetados por cada evento.
CREATE TABLE public.manutencao_veiculo_historico (
  id bigserial PRIMARY KEY,
  manutencao_id bigint NOT NULL REFERENCES public.manutencao_veiculo(id) ON DELETE RESTRICT,
  evento text NOT NULL,
  status_anterior public.status_manutencao_veiculo NOT NULL,
  status_posterior public.status_manutencao_veiculo NOT NULL,
  anterior_entrada_em timestamptz NOT NULL,
  anterior_conclusao_prevista_em timestamptz NOT NULL,
  anterior_iniciada_em timestamptz NOT NULL,
  anterior_concluida_em timestamptz,
  posterior_entrada_em timestamptz NOT NULL,
  posterior_conclusao_prevista_em timestamptz NOT NULL,
  posterior_iniciada_em timestamptz,
  posterior_concluida_em timestamptz,
  autor_id bigint NOT NULL REFERENCES public.usuario(id) ON DELETE RESTRICT,
  registrado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT manutencao_veiculo_historico_evento_check CHECK (
    (evento = 'CONCLUSAO' AND status_anterior = 'EM_ANDAMENTO' AND status_posterior = 'CONCLUIDA')
    OR (evento = 'CORRECAO_DATAS' AND status_anterior = 'CONCLUIDA' AND status_posterior = 'CONCLUIDA')
    OR (evento = 'REABERTURA' AND status_anterior = 'CONCLUIDA'
        AND status_posterior IN ('AGENDADA', 'EM_ANDAMENTO'))
  ),
  CONSTRAINT manutencao_veiculo_historico_estado_check CHECK (
    (anterior_concluida_em IS NOT NULL) = (status_anterior = 'CONCLUIDA')
    AND (posterior_iniciada_em IS NOT NULL) = (status_posterior IN ('EM_ANDAMENTO', 'CONCLUIDA'))
    AND (posterior_concluida_em IS NOT NULL) = (status_posterior = 'CONCLUIDA')
  ),
  CONSTRAINT manutencao_veiculo_historico_dias_check CHECK (
    (CASE WHEN isfinite(anterior_entrada_em) AND isfinite(anterior_conclusao_prevista_em) THEN
      (anterior_entrada_em AT TIME ZONE 'America/Maceio')::time = TIME '00:00'
      AND (anterior_conclusao_prevista_em AT TIME ZONE 'America/Maceio')::time = TIME '00:00'
      AND anterior_conclusao_prevista_em >= anterior_entrada_em
    ELSE false END)
    AND (CASE WHEN isfinite(posterior_entrada_em) AND isfinite(posterior_conclusao_prevista_em) THEN
      (posterior_entrada_em AT TIME ZONE 'America/Maceio')::time = TIME '00:00'
      AND (posterior_conclusao_prevista_em AT TIME ZONE 'America/Maceio')::time = TIME '00:00'
      AND posterior_conclusao_prevista_em >= posterior_entrada_em
    ELSE false END)
  ),
  CONSTRAINT manutencao_veiculo_historico_instantes_check CHECK (
    isfinite(anterior_iniciada_em) AND isfinite(registrado_em)
    AND (anterior_concluida_em IS NULL
      OR (isfinite(anterior_concluida_em) AND anterior_concluida_em >= anterior_iniciada_em))
    AND (posterior_iniciada_em IS NULL OR isfinite(posterior_iniciada_em))
    AND (posterior_concluida_em IS NULL
      OR (isfinite(posterior_concluida_em) AND posterior_concluida_em >= posterior_iniciada_em))
  )
);

CREATE INDEX manutencao_veiculo_por_veiculo_idx
  ON public.manutencao_veiculo (veiculo_id, entrada_em DESC, id DESC);
CREATE INDEX manutencao_veiculo_bloqueios_idx
  ON public.manutencao_veiculo (veiculo_id, status, entrada_em)
  INCLUDE (conclusao_prevista_em, iniciada_em)
  WHERE status IN ('AGENDADA', 'EM_ANDAMENTO');
CREATE INDEX manutencao_veiculo_periodo_idx
  ON public.manutencao_veiculo (entrada_em DESC, id DESC);
CREATE INDEX manutencao_veiculo_status_previsao_idx
  ON public.manutencao_veiculo (status, conclusao_prevista_em, id);
CREATE INDEX manutencao_veiculo_historico_ocorrencia_idx
  ON public.manutencao_veiculo_historico (manutencao_id, registrado_em DESC, id DESC);

ALTER TABLE public.manutencao_veiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manutencao_veiculo_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.manutencao_veiculo, public.manutencao_veiculo_historico
  FROM PUBLIC, anon, authenticated, postgres, service_role;
REVOKE ALL ON SEQUENCE public.manutencao_veiculo_id_seq, public.manutencao_veiculo_historico_id_seq
  FROM PUBLIC, anon, authenticated, postgres, service_role;
-- Grants explícitos para o papel postgres do harness. Seu acesso com RLS depende de BYPASSRLS.
-- Ownership, superusuário e herança podem alterar o acesso efetivo. Confirmar o runtime remoto.
GRANT SELECT, INSERT, UPDATE ON TABLE public.manutencao_veiculo TO postgres;
GRANT SELECT, INSERT ON TABLE public.manutencao_veiculo_historico TO postgres;
GRANT USAGE ON SEQUENCE public.manutencao_veiculo_id_seq, public.manutencao_veiculo_historico_id_seq
  TO postgres;
