-- SCRUM-162 / DB-S7-01: evolução aditiva do atendimento e da triagem SVO.
-- A baseline permanece inalterada; aplicar somente pelo fluxo de migrations.
-- Dados legados NÃO são classificados automaticamente como confirmados:
-- ter uma ordem criada pelo código anterior não comprova triagem SVO.

CREATE TYPE public.status_triagem_svo AS ENUM (
  'AGUARDANDO_TRIAGEM',
  'CONFIRMADA_SVO',
  'ENCAMINHADA_IML'
);

ALTER TABLE public.solicitacao_obito
  ADD COLUMN status_triagem public.status_triagem_svo,
  ADD COLUMN canal_atendimento character varying(20),
  ADD COLUMN ponto_referencia character varying(255),
  ADD COLUMN triagem_observacoes text,
  ADD COLUMN triado_por_id bigint,
  ADD COLUMN triado_em timestamp without time zone;

-- Os defaults valem para NOVAS ocorrências, não classificam registros antigos.
ALTER TABLE public.solicitacao_obito
  ALTER COLUMN status_triagem
    SET DEFAULT 'AGUARDANDO_TRIAGEM'::public.status_triagem_svo,
  ALTER COLUMN canal_atendimento SET DEFAULT 'TELEFONE';

ALTER TABLE public.solicitacao_obito
  ADD CONSTRAINT solicitacao_obito_triador_fk
    FOREIGN KEY (triado_por_id) REFERENCES public.usuario(id),
  ADD CONSTRAINT solicitacao_obito_canal_check
    CHECK (canal_atendimento IS NULL OR canal_atendimento = 'TELEFONE'),
  ADD CONSTRAINT solicitacao_obito_triagem_decisao_check
    CHECK (
      status_triagem IS NULL
      OR (
        status_triagem = 'AGUARDANDO_TRIAGEM'
        AND triado_por_id IS NULL AND triado_em IS NULL
      )
      OR (
        status_triagem IN ('CONFIRMADA_SVO', 'ENCAMINHADA_IML')
        AND triado_por_id IS NOT NULL AND triado_em IS NOT NULL
      )
    );

-- Sem DEFAULT: a quantidade por ordem deve ser fornecida explicitamente;
-- os registros antigos permanecem NULL até conciliação.
ALTER TABLE public.ordem_coleta
  ADD COLUMN quantidade_corpos smallint,
  ADD CONSTRAINT ordem_coleta_quantidade_corpos_check
    CHECK (quantidade_corpos BETWEEN 1 AND 4);

CREATE INDEX solicitacao_obito_triagem_criado_idx
  ON public.solicitacao_obito (status_triagem, criado_em DESC);

CREATE INDEX ordem_coleta_veiculo_status_idx
  ON public.ordem_coleta (veiculo_id, status)
  WHERE veiculo_id IS NOT NULL;

-- A UNIQUE existente em ordem_coleta(solicitacao_obito_id) é preservada.
-- Lotação agregada 4/4 e criação de ordem somente após triagem:
-- implementar transações/locks no módulo SVO (SCRUM-131 e SCRUM-147),
-- após definição da cardinalidade na SCRUM-129. O gerador oficial de
-- schema não suporta triggers e não devem ser introduzidos aqui.
-- Novo perfil Equipe SVO e CPF/nascimento dependem de validação de RBAC/LGPD.
