-- SCRUM-219 (SCRUM-237/238): estruturas aditivas para escala, indisponibilidade,
-- matriz CNH × classe veicular e transição profissional auditável de motoristas.
-- Nenhuma linha é criada, inferida ou migrada. Não altera status_motorista,
-- motorista.status, usuario.ativo, alocação, dashboard nem regras de CNH/SVO.
-- Regras de jornada, prioridade entre escala e ausência e conteúdo da matriz
-- aguardam pactuação com a FSPH; estas tabelas só registram fatos informados.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Sem extensões: o backup da SCRUM-204 copia só public/fsph_test_harness. A igualdade
-- por motorista usa int8range de um ponto, com operadores GiST nativos de range.

-- Período explícito [inicio, fim) informado por responsável; sem horário padrão.
-- EM_ESCALA = jornada conhecida; FORA_DE_ESCALA = ausência de jornada conhecida.
-- Lacuna entre registros VIGENTES é dado ausente: não significa folga nem disponibilidade.
CREATE TABLE public.escala_motorista (
  id bigserial PRIMARY KEY,
  motorista_id bigint NOT NULL REFERENCES public.motorista(id),
  inicio timestamp with time zone NOT NULL,
  fim timestamp with time zone NOT NULL,
  situacao text NOT NULL CHECK (situacao IN ('EM_ESCALA', 'FORA_DE_ESCALA')),
  estado text NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'CANCELADA')),
  autor_id bigint NOT NULL REFERENCES public.usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  cancelado_por_id bigint REFERENCES public.usuario(id),
  cancelado_em timestamp with time zone,
  motivo_cancelamento text,
  CONSTRAINT escala_motorista_intervalo_check CHECK (isfinite(inicio) AND isfinite(fim) AND inicio < fim),
  CONSTRAINT escala_motorista_cancelamento_check CHECK (
    (estado = 'VIGENTE' AND cancelado_por_id IS NULL AND cancelado_em IS NULL AND motivo_cancelamento IS NULL)
    OR (estado = 'CANCELADA' AND cancelado_por_id IS NOT NULL AND cancelado_em IS NOT NULL
      AND cancelado_em >= criado_em AND motivo_cancelamento IS NOT NULL
      AND char_length(btrim(motivo_cancelamento)) BETWEEN 1 AND 500)),
  CONSTRAINT escala_motorista_sem_sobreposicao EXCLUDE USING gist
    (int8range(motorista_id, motorista_id, '[]') WITH =, tstzrange(inicio, fim, '[)') WITH &&)
    WHERE (estado = 'VIGENTE')
);
CREATE INDEX escala_motorista_motorista_idx ON public.escala_motorista (motorista_id, inicio, id);

-- Ausência informada. Tipos reaproveitam FOLGA/AFASTADO do contrato atual; não
-- há campo livre para evitar dados médicos. fim NULL = término não informado.
CREATE TABLE public.indisponibilidade_motorista (
  id bigserial PRIMARY KEY,
  motorista_id bigint NOT NULL REFERENCES public.motorista(id),
  tipo text NOT NULL CHECK (tipo IN ('FOLGA', 'AFASTADO')),
  inicio timestamp with time zone NOT NULL,
  fim timestamp with time zone,
  estado text NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'CANCELADA')),
  autor_id bigint NOT NULL REFERENCES public.usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  cancelado_por_id bigint REFERENCES public.usuario(id),
  cancelado_em timestamp with time zone,
  motivo_cancelamento text,
  CONSTRAINT indisponibilidade_motorista_intervalo_check CHECK (isfinite(inicio)
    AND (fim IS NULL OR (isfinite(fim) AND inicio < fim))),
  CONSTRAINT indisponibilidade_motorista_cancelamento_check CHECK (
    (estado = 'VIGENTE' AND cancelado_por_id IS NULL AND cancelado_em IS NULL AND motivo_cancelamento IS NULL)
    OR (estado = 'CANCELADA' AND cancelado_por_id IS NOT NULL AND cancelado_em IS NOT NULL
      AND cancelado_em >= criado_em AND motivo_cancelamento IS NOT NULL
      AND char_length(btrim(motivo_cancelamento)) BETWEEN 1 AND 500)),
  CONSTRAINT indisponibilidade_motorista_sem_sobreposicao EXCLUDE USING gist
    (int8range(motorista_id, motorista_id, '[]') WITH =, tstzrange(inicio, fim, '[)') WITH &&)
    WHERE (estado = 'VIGENTE')
);
CREATE INDEX indisponibilidade_motorista_motorista_idx ON public.indisponibilidade_motorista (motorista_id, inicio, id);

-- Matriz proposta, vazia. Não é consultada por alocação até a FSPH definir a classe
-- veicular verificável e a política de categorias/combinações. Ausência de linha =
-- desconhecido; permitido=false = vedação conhecida. Vigência em datas civis [inicio, fim).
CREATE TABLE public.habilitacao_categoria_veiculo (
  id bigserial PRIMARY KEY,
  -- Cast explícito: IN sobre varchar muda de forma no dump/restore da SCRUM-204.
  categoria_cnh varchar(5) NOT NULL CHECK (categoria_cnh::text IN ('A', 'B', 'C', 'D', 'E')),
  classe_veicular text NOT NULL CHECK (char_length(btrim(classe_veicular)) BETWEEN 1 AND 100),
  permitido boolean NOT NULL,
  fonte_normativa text NOT NULL CHECK (char_length(btrim(fonte_normativa)) BETWEEN 1 AND 500),
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  autor_id bigint NOT NULL REFERENCES public.usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT habilitacao_categoria_veiculo_vigencia_check CHECK (isfinite(vigencia_inicio)
    AND (vigencia_fim IS NULL OR (isfinite(vigencia_fim) AND vigencia_inicio < vigencia_fim))),
  -- Sobreposição de vigências depende da política da FSPH; aqui só se impede duplicidade.
  CONSTRAINT habilitacao_categoria_veiculo_vigencia_key UNIQUE (categoria_cnh, classe_veicular, vigencia_inicio)
);

-- SCRUM-238: inativação/reativação profissional append-only. Não altera
-- usuario.ativo nem motorista.status. Sem backfill: motorista sem linha nunca foi
-- inativado por este fluxo; a primeira transição é obrigatoriamente INATIVACAO.
CREATE TABLE public.motorista_transicao_profissional (
  id bigserial PRIMARY KEY,
  motorista_id bigint NOT NULL REFERENCES public.motorista(id),
  versao integer NOT NULL CHECK (versao >= 1),
  versao_anterior integer,
  acao text NOT NULL CHECK (acao IN ('INATIVACAO', 'REATIVACAO')),
  motivo text NOT NULL CHECK (char_length(btrim(motivo)) BETWEEN 1 AND 1000),
  autor_id bigint NOT NULL REFERENCES public.usuario(id),
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT motorista_transicao_profissional_versao_key UNIQUE (motorista_id, versao),
  CONSTRAINT motorista_transicao_profissional_sequencia_check CHECK (
    (versao = 1 AND versao_anterior IS NULL)
    OR (versao > 1 AND versao_anterior IS NOT NULL AND versao_anterior = versao - 1)),
  CONSTRAINT motorista_transicao_profissional_alternancia_check CHECK ((acao = 'INATIVACAO') = (versao % 2 = 1)),
  CONSTRAINT motorista_transicao_profissional_anterior_fk FOREIGN KEY (motorista_id, versao_anterior)
    REFERENCES public.motorista_transicao_profissional (motorista_id, versao)
);

ALTER TABLE public.escala_motorista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indisponibilidade_motorista ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habilitacao_categoria_veiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.motorista_transicao_profissional ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.escala_motorista, public.indisponibilidade_motorista,
  public.habilitacao_categoria_veiculo, public.motorista_transicao_profissional FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.escala_motorista_id_seq, public.indisponibilidade_motorista_id_seq,
  public.habilitacao_categoria_veiculo_id_seq, public.motorista_transicao_profissional_id_seq FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.escala_motorista, public.indisponibilidade_motorista,
  public.habilitacao_categoria_veiculo, public.motorista_transicao_profissional FROM postgres, service_role;
-- Únicas alterações permitidas ao backend: cancelar período e encerrar vigência.
GRANT UPDATE (estado, cancelado_por_id, cancelado_em, motivo_cancelamento)
  ON public.escala_motorista, public.indisponibilidade_motorista TO postgres, service_role;
GRANT UPDATE (vigencia_fim) ON public.habilitacao_categoria_veiculo TO postgres, service_role;
-- RLS sem policies nega Data API. Autorização por perfil pertence às APIs futuras
-- (SCRUM-220/221). Papel runtime remoto deve ser confirmado antes do rollout.
