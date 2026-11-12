-- SCRUM-166 / DB-S8-01: viagem operacional, quilometragem, evidências,
-- validação/correção e avisos ao motorista. Evolução ADITIVA: baseline e
-- migrations anteriores permanecem inalteradas; nenhuma entidade de viagem nova.
-- A tabela existente public.viagem (FK única para solicitacao_viagem e enum
-- status_viagem AGENDADA/EM_TRANSPORTE/CONCLUIDA/CANCELADA) é a viagem operacional.
--
-- Não aplicar automaticamente em banco compartilhado. Antes do rollout, executar
-- o preflight somente leitura backend/src/database/scripts/inspect-db-s8-01.sql.
-- Reversão manual e condicionada: backend/src/database/rollback/
-- 20261109200000_db_s8_01_viagem_execucao.down.sql. Ver
-- docs/database/sprint8-viagem-execucao.md.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. Viagem: instante de criação e validação final do Gestor (RN11).
-- Registros anteriores permanecem NULL: o histórico não é reclassificado.
ALTER TABLE public.viagem
  ADD COLUMN criado_em timestamp with time zone,
  ADD COLUMN validada_por_id bigint,
  ADD COLUMN validada_em timestamp with time zone;

-- O default vale somente para NOVAS viagens.
ALTER TABLE public.viagem
  ALTER COLUMN criado_em SET DEFAULT clock_timestamp();

ALTER TABLE public.viagem
  ADD CONSTRAINT viagem_validada_por_fk
    FOREIGN KEY (validada_por_id) REFERENCES public.usuario(id);

-- Regras de integridade de execução. NOT VALID: valem para toda inserção/alteração
-- a partir desta migration, sem reprovar nem reescrever linhas legadas. A validação
-- integral (VALIDATE CONSTRAINT) só ocorre após o preflight/reconciliação.
ALTER TABLE public.viagem
  ADD CONSTRAINT viagem_dados_obrigatorios_check
    CHECK (
      solicitacao_id IS NOT NULL
      AND veiculo_id IS NOT NULL
      AND motorista_id IS NOT NULL
      AND status IS NOT NULL
    ) NOT VALID,
  ADD CONSTRAINT viagem_km_inicial_check
    CHECK (km_inicial IS NULL OR km_inicial >= 0) NOT VALID,
  ADD CONSTRAINT viagem_km_final_check
    CHECK (km_final IS NULL OR (km_inicial IS NOT NULL AND km_final >= km_inicial)) NOT VALID,
  ADD CONSTRAINT viagem_periodo_check
    CHECK (data_fim IS NULL OR (data_inicio IS NOT NULL AND data_fim >= data_inicio)) NOT VALID,
  ADD CONSTRAINT viagem_execucao_status_check
    CHECK (
      (status IS DISTINCT FROM 'EM_TRANSPORTE'
        OR (data_inicio IS NOT NULL AND km_inicial IS NOT NULL))
      AND (status IS DISTINCT FROM 'CONCLUIDA'
        OR (data_inicio IS NOT NULL AND km_inicial IS NOT NULL
            AND data_fim IS NOT NULL AND km_final IS NOT NULL))
    ) NOT VALID,
  ADD CONSTRAINT viagem_validacao_check
    CHECK (
      (validada_por_gestor IS NOT TRUE
        AND validada_por_id IS NULL AND validada_em IS NULL)
      OR (validada_por_gestor IS TRUE
        AND validada_por_id IS NOT NULL AND validada_em IS NOT NULL
        AND status IS NOT DISTINCT FROM 'CONCLUIDA')
    ) NOT VALID;

-- Consultas por motorista/status/período de execução e fila do Gestor.
-- O período agendado continua indexado em solicitacao_viagem (data_hora_saida).
CREATE INDEX viagem_motorista_status_idx
  ON public.viagem (motorista_id, status, data_inicio DESC);
CREATE INDEX viagem_status_periodo_idx
  ON public.viagem (status, data_inicio DESC);

-- 2. Evidências fotográficas do odômetro (RN10), fora da tabela viagem: a viagem
-- mantém os grants amplos auditados da baseline e não pode receber bytes.
-- Substituição cria nova versão; a anterior permanece como histórico.
CREATE TABLE public.viagem_evidencia (
  id bigserial PRIMARY KEY,
  viagem_id bigint NOT NULL,
  momento text NOT NULL,
  versao integer NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  dados bytea NOT NULL,
  enviado_por_id bigint NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT viagem_evidencia_viagem_fk
    FOREIGN KEY (viagem_id) REFERENCES public.viagem(id),
  CONSTRAINT viagem_evidencia_autor_fk
    FOREIGN KEY (enviado_por_id) REFERENCES public.usuario(id),
  CONSTRAINT viagem_evidencia_versao_key UNIQUE (viagem_id, momento, versao),
  CONSTRAINT viagem_evidencia_momento_check CHECK (momento IN ('INICIAL', 'FINAL')),
  CONSTRAINT viagem_evidencia_versao_check CHECK (versao >= 1),
  CONSTRAINT viagem_evidencia_nome_check CHECK (char_length(nome) BETWEEN 1 AND 255),
  CONSTRAINT viagem_evidencia_tipo_check CHECK (tipo IN ('image/jpeg', 'image/png')),
  CONSTRAINT viagem_evidencia_tamanho_check CHECK (octet_length(dados) BETWEEN 1 AND 1048576)
);

-- 3. Correção/justificativa versionada (RF46), ligada ao autor. Guarda valores
-- anteriores e resultantes; a viagem recebe os resultantes na mesma transação.
CREATE TABLE public.viagem_correcao (
  id bigserial PRIMARY KEY,
  viagem_id bigint NOT NULL,
  versao integer NOT NULL,
  km_inicial_anterior integer,
  km_final_anterior integer,
  km_inicial integer,
  km_final integer,
  justificativa text NOT NULL,
  autor_id bigint NOT NULL,
  criado_em timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT viagem_correcao_viagem_fk
    FOREIGN KEY (viagem_id) REFERENCES public.viagem(id),
  CONSTRAINT viagem_correcao_autor_fk
    FOREIGN KEY (autor_id) REFERENCES public.usuario(id),
  CONSTRAINT viagem_correcao_versao_key UNIQUE (viagem_id, versao),
  CONSTRAINT viagem_correcao_versao_check CHECK (versao >= 1),
  CONSTRAINT viagem_correcao_km_check CHECK (
    (km_inicial IS NULL OR km_inicial >= 0)
    AND (km_final IS NULL OR (km_inicial IS NOT NULL AND km_final >= km_inicial))
  ),
  CONSTRAINT viagem_correcao_justificativa_check
    CHECK (char_length(btrim(justificativa)) BETWEEN 1 AND 2000)
);

-- Somente o backend acessa evidências e correções: RLS ligada, sem grants para
-- clientes Data API. Histórico append-only para os papéis de aplicação.
ALTER TABLE public.viagem_evidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viagem_correcao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.viagem_evidencia, public.viagem_correcao
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.viagem_evidencia_id_seq, public.viagem_correcao_id_seq
  FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.viagem_evidencia, public.viagem_correcao
  FROM postgres, service_role;

-- 4. Avisos in-app ao motorista (RF64): destinatário (usuario_id), demanda
-- (viagem_id), tipo, instante (criado_em) e leitura (lida_em). A chave estável
-- carrega demanda e tipo; UNIQUE (usuario_id, chave) impede envio duplicado.
-- Avisos existentes ficam com tipo/viagem NULL e continuam válidos.
ALTER TABLE public.notificacao
  ADD COLUMN tipo text,
  ADD COLUMN viagem_id bigint;

ALTER TABLE public.notificacao
  ADD CONSTRAINT notificacao_viagem_fk
    FOREIGN KEY (viagem_id) REFERENCES public.viagem(id),
  ADD CONSTRAINT notificacao_tipo_check
    CHECK (tipo IS NULL OR tipo IN ('ATRIBUICAO', 'LEMBRETE')),
  ADD CONSTRAINT notificacao_demanda_check
    CHECK (
      tipo IS NULL
      OR (viagem_id IS NOT NULL
        AND chave LIKE 'viagem:' || viagem_id::text || ':' || lower(tipo) || ':%')
    );

CREATE INDEX notificacao_viagem_idx
  ON public.notificacao (viagem_id)
  WHERE viagem_id IS NOT NULL;

-- Lembretes: a janela temporal não está confirmada; nenhum scheduler, gatilho ou
-- regra de envio é criado aqui. O gerador oficial de schema não suporta triggers.
