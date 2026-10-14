BEGIN;

CREATE TABLE chamados (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE viagens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agendada_em timestamptz NOT NULL
);

CREATE TABLE veiculos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL
);

CREATE TABLE motoristas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  status text NOT NULL
);

CREATE INDEX chamados_pendentes_criado_em_idx ON chamados (criado_em)
  WHERE status = 'PENDENTE';
CREATE INDEX viagens_agendada_em_idx ON viagens (agendada_em);

COMMIT;
