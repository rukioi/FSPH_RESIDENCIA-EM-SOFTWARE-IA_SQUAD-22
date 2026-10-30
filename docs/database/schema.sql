-- Gerado de metadados PostgreSQL: T1 (#27). Não editar manualmente.
-- Grants amplos e RLS desativada reproduzem o estado anterior.
-- NÃO é configuração segura para nova publicação ou aplicação em banco existente.
SET search_path = public, pg_catalog;
CREATE TYPE public."perfil_usuario" AS ENUM ('ADM', 'GESTOR_FROTA', 'SOLICITANTE_INTERNO', 'MOTORISTA', 'ATENDENTE_SVO');
ALTER TYPE public."perfil_usuario" OWNER TO "postgres";
CREATE TYPE public."status_motorista" AS ENUM ('DISPONIVEL', 'EM_VIAGEM', 'FOLGA', 'AFASTADO');
ALTER TYPE public."status_motorista" OWNER TO "postgres";
CREATE TYPE public."status_ordem_coleta" AS ENUM ('PENDENTE_ALOCACAO', 'EM_DESLOCAMENTO', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA');
ALTER TYPE public."status_ordem_coleta" OWNER TO "postgres";
CREATE TYPE public."status_solicitacao" AS ENUM ('PENDENTE', 'AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO', 'CONCLUIDA', 'REPROVADA');
ALTER TYPE public."status_solicitacao" OWNER TO "postgres";
CREATE TYPE public."status_veiculo" AS ENUM ('DISPONIVEL', 'EM_VIAGEM', 'EM_MANUTENCAO', 'INDISPONIVEL');
ALTER TYPE public."status_veiculo" OWNER TO "postgres";
CREATE TYPE public."status_viagem" AS ENUM ('AGENDADA', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA');
ALTER TYPE public."status_viagem" OWNER TO "postgres";
CREATE TYPE public."tipo_veiculo" AS ENUM ('PASSEIO', 'VAN', 'AMBULANCIA', 'RABECÃO_SVO');
ALTER TYPE public."tipo_veiculo" OWNER TO "postgres";
CREATE SEQUENCE public."abastecimento_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."abastecimento_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."documento_veiculo_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."documento_veiculo_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."log_atividade_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."log_atividade_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."motorista_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."motorista_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."ordem_coleta_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."ordem_coleta_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."solicitacao_obito_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."solicitacao_obito_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."solicitacao_viagem_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."solicitacao_viagem_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."usuario_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."usuario_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."veiculo_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."veiculo_id_seq" OWNER TO "postgres";
CREATE SEQUENCE public."viagem_id_seq" AS bigint INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;
ALTER SEQUENCE public."viagem_id_seq" OWNER TO "postgres";
CREATE TABLE public."abastecimento" (
  "id" bigint DEFAULT nextval('abastecimento_id_seq'::regclass) NOT NULL,
  "veiculo_id" bigint NOT NULL,
  "motorista_id" bigint NOT NULL,
  "litragem" numeric(10,2) NOT NULL,
  "valor_total" numeric(10,2) NOT NULL,
  "quilometragem" integer NOT NULL,
  "data_abastecimento" date NOT NULL,
  "criado_em" timestamp without time zone DEFAULT now(),
  "posto" character varying(255)
);
ALTER TABLE public."abastecimento" OWNER TO "postgres";
CREATE TABLE public."documento_veiculo" (
  "id" bigint DEFAULT nextval('documento_veiculo_id_seq'::regclass) NOT NULL,
  "veiculo_id" bigint,
  "tipo_documento" character varying(50) NOT NULL,
  "data_vencimento" date NOT NULL,
  "status_regular" boolean DEFAULT true,
  "arquivo_dados" bytea,
  "arquivo_nome" character varying(255),
  "arquivo_tipo" character varying(100)
);
ALTER TABLE public."documento_veiculo" OWNER TO "postgres";
CREATE TABLE public."log_atividade" (
  "id" bigint DEFAULT nextval('log_atividade_id_seq'::regclass) NOT NULL,
  "usuario_id" bigint,
  "descricao" text NOT NULL,
  "data_hora" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public."log_atividade" OWNER TO "postgres";
CREATE TABLE public."motorista" (
  "id" bigint DEFAULT nextval('motorista_id_seq'::regclass) NOT NULL,
  "usuario_id" bigint,
  "nome" character varying(150) NOT NULL,
  "cnh" character varying(20) NOT NULL,
  "categoria_cnh" character varying(5) NOT NULL,
  "validade_cnh" date NOT NULL,
  "status" status_motorista DEFAULT 'DISPONIVEL'::status_motorista,
  "criado_em" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "cpf" character varying(14),
  "telefone" character varying(20)
);
ALTER TABLE public."motorista" OWNER TO "postgres";
CREATE TABLE public."ordem_coleta" (
  "id" bigint DEFAULT nextval('ordem_coleta_id_seq'::regclass) NOT NULL,
  "solicitacao_obito_id" bigint,
  "veiculo_id" bigint,
  "motorista_id" bigint,
  "km_inicial" integer,
  "km_final" integer,
  "foto_odometro_inicio" character varying(255),
  "foto_odometro_fim" character varying(255),
  "data_inicio" timestamp without time zone,
  "data_fim" timestamp without time zone,
  "validada_por_svo" boolean DEFAULT false,
  "status" status_ordem_coleta DEFAULT 'PENDENTE_ALOCACAO'::status_ordem_coleta
);
ALTER TABLE public."ordem_coleta" OWNER TO "postgres";
CREATE TABLE public."solicitacao_obito" (
  "id" bigint DEFAULT nextval('solicitacao_obito_id_seq'::regclass) NOT NULL,
  "codigo" character varying(20) NOT NULL,
  "atendente_id" bigint,
  "nome_falecido" character varying(150),
  "local_falecimento" character varying(255) NOT NULL,
  "endereco_remocao" character varying(255) NOT NULL,
  "solicitante_nome" character varying(150) NOT NULL,
  "solicitante_parentesco" character varying(50),
  "solicitante_telefone" character varying(20),
  "observacoes_medicas" text,
  "criado_em" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public."solicitacao_obito" OWNER TO "postgres";
CREATE TABLE public."solicitacao_viagem" (
  "id" bigint DEFAULT nextval('solicitacao_viagem_id_seq'::regclass) NOT NULL,
  "codigo" character varying(20) NOT NULL,
  "solicitante_id" bigint,
  "origem" character varying(255) NOT NULL,
  "destino" character varying(255) NOT NULL,
  "data_hora_saida" timestamp without time zone NOT NULL,
  "qtd_passageiros" integer DEFAULT 1,
  "status" status_solicitacao DEFAULT 'PENDENTE'::status_solicitacao,
  "motivo_rejeicao" text,
  "criado_em" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "veiculo_id" bigint,
  "motorista_id" bigint
);
ALTER TABLE public."solicitacao_viagem" OWNER TO "postgres";
CREATE TABLE public."usuario" (
  "id" bigint DEFAULT nextval('usuario_id_seq'::regclass) NOT NULL,
  "nome" character varying(150) NOT NULL,
  "email" character varying(150) NOT NULL,
  "senha_hash" character varying(255) NOT NULL,
  "perfil" perfil_usuario DEFAULT 'SOLICITANTE_INTERNO'::perfil_usuario NOT NULL,
  "ativo" boolean DEFAULT true,
  "criado_em" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public."usuario" OWNER TO "postgres";
CREATE TABLE public."veiculo" (
  "id" bigint DEFAULT nextval('veiculo_id_seq'::regclass) NOT NULL,
  "placa" character varying(10) NOT NULL,
  "modelo" character varying(100) NOT NULL,
  "marca" character varying(100) NOT NULL,
  "ano" integer NOT NULL,
  "tipo" tipo_veiculo NOT NULL,
  "capacidade_obitos" integer DEFAULT 0,
  "quilometragem_atual" integer DEFAULT 0,
  "status" status_veiculo DEFAULT 'DISPONIVEL'::status_veiculo,
  "is_svo" boolean DEFAULT false,
  "criado_em" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  "capacidade_passageiros" integer DEFAULT 5,
  "vinculo" character varying(10) DEFAULT 'PROPRIO'::character varying NOT NULL,
  "fornecedor_locacao" character varying(255)
);
ALTER TABLE public."veiculo" OWNER TO "postgres";
CREATE TABLE public."viagem" (
  "id" bigint DEFAULT nextval('viagem_id_seq'::regclass) NOT NULL,
  "solicitacao_id" bigint,
  "veiculo_id" bigint,
  "motorista_id" bigint,
  "km_inicial" integer,
  "km_final" integer,
  "foto_odometro_inicio" character varying(255),
  "foto_odometro_fim" character varying(255),
  "data_inicio" timestamp without time zone,
  "data_fim" timestamp without time zone,
  "validada_por_gestor" boolean DEFAULT false,
  "status" status_viagem DEFAULT 'AGENDADA'::status_viagem
);
ALTER TABLE public."viagem" OWNER TO "postgres";
ALTER SEQUENCE public."abastecimento_id_seq" OWNED BY public."abastecimento"."id";
ALTER SEQUENCE public."documento_veiculo_id_seq" OWNED BY public."documento_veiculo"."id";
ALTER SEQUENCE public."log_atividade_id_seq" OWNED BY public."log_atividade"."id";
ALTER SEQUENCE public."motorista_id_seq" OWNED BY public."motorista"."id";
ALTER SEQUENCE public."ordem_coleta_id_seq" OWNED BY public."ordem_coleta"."id";
ALTER SEQUENCE public."solicitacao_obito_id_seq" OWNED BY public."solicitacao_obito"."id";
ALTER SEQUENCE public."solicitacao_viagem_id_seq" OWNED BY public."solicitacao_viagem"."id";
ALTER SEQUENCE public."usuario_id_seq" OWNED BY public."usuario"."id";
ALTER SEQUENCE public."veiculo_id_seq" OWNED BY public."veiculo"."id";
ALTER SEQUENCE public."viagem_id_seq" OWNED BY public."viagem"."id";
ALTER TABLE public."abastecimento" ADD CONSTRAINT "abastecimento_pkey" PRIMARY KEY (id);
ALTER TABLE public."documento_veiculo" ADD CONSTRAINT "documento_veiculo_pkey" PRIMARY KEY (id);
ALTER TABLE public."log_atividade" ADD CONSTRAINT "log_atividade_pkey" PRIMARY KEY (id);
ALTER TABLE public."motorista" ADD CONSTRAINT "motorista_cnh_key" UNIQUE (cnh);
ALTER TABLE public."motorista" ADD CONSTRAINT "motorista_cpf_key" UNIQUE (cpf);
ALTER TABLE public."motorista" ADD CONSTRAINT "motorista_pkey" PRIMARY KEY (id);
ALTER TABLE public."motorista" ADD CONSTRAINT "motorista_usuario_id_key" UNIQUE (usuario_id);
ALTER TABLE public."ordem_coleta" ADD CONSTRAINT "ordem_coleta_pkey" PRIMARY KEY (id);
ALTER TABLE public."ordem_coleta" ADD CONSTRAINT "ordem_coleta_solicitacao_obito_id_key" UNIQUE (solicitacao_obito_id);
ALTER TABLE public."solicitacao_obito" ADD CONSTRAINT "solicitacao_obito_codigo_key" UNIQUE (codigo);
ALTER TABLE public."solicitacao_obito" ADD CONSTRAINT "solicitacao_obito_pkey" PRIMARY KEY (id);
ALTER TABLE public."solicitacao_viagem" ADD CONSTRAINT "solicitacao_viagem_codigo_key" UNIQUE (codigo);
ALTER TABLE public."solicitacao_viagem" ADD CONSTRAINT "solicitacao_viagem_pkey" PRIMARY KEY (id);
ALTER TABLE public."usuario" ADD CONSTRAINT "usuario_email_key" UNIQUE (email);
ALTER TABLE public."usuario" ADD CONSTRAINT "usuario_pkey" PRIMARY KEY (id);
ALTER TABLE public."veiculo" ADD CONSTRAINT "veiculo_pkey" PRIMARY KEY (id);
ALTER TABLE public."veiculo" ADD CONSTRAINT "veiculo_placa_key" UNIQUE (placa);
ALTER TABLE public."veiculo" ADD CONSTRAINT "veiculo_vinculo_check" CHECK (vinculo IN ('PROPRIO', 'LOCADO'));
ALTER TABLE public."viagem" ADD CONSTRAINT "viagem_pkey" PRIMARY KEY (id);
ALTER TABLE public."viagem" ADD CONSTRAINT "viagem_solicitacao_id_key" UNIQUE (solicitacao_id);
ALTER TABLE public."abastecimento" ADD CONSTRAINT "abastecimento_motorista_id_fkey" FOREIGN KEY (motorista_id) REFERENCES motorista(id);
ALTER TABLE public."abastecimento" ADD CONSTRAINT "abastecimento_veiculo_id_fkey" FOREIGN KEY (veiculo_id) REFERENCES veiculo(id);
ALTER TABLE public."documento_veiculo" ADD CONSTRAINT "documento_veiculo_veiculo_id_fkey" FOREIGN KEY (veiculo_id) REFERENCES veiculo(id);
ALTER TABLE public."log_atividade" ADD CONSTRAINT "fk_log_atividade_usuario" FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL;
ALTER TABLE public."log_atividade" ADD CONSTRAINT "log_atividade_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuario(id);
ALTER TABLE public."motorista" ADD CONSTRAINT "motorista_usuario_id_fkey" FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE;
ALTER TABLE public."ordem_coleta" ADD CONSTRAINT "ordem_coleta_motorista_id_fkey" FOREIGN KEY (motorista_id) REFERENCES motorista(id);
ALTER TABLE public."ordem_coleta" ADD CONSTRAINT "ordem_coleta_solicitacao_obito_id_fkey" FOREIGN KEY (solicitacao_obito_id) REFERENCES solicitacao_obito(id);
ALTER TABLE public."ordem_coleta" ADD CONSTRAINT "ordem_coleta_veiculo_id_fkey" FOREIGN KEY (veiculo_id) REFERENCES veiculo(id);
ALTER TABLE public."solicitacao_obito" ADD CONSTRAINT "solicitacao_obito_atendente_id_fkey" FOREIGN KEY (atendente_id) REFERENCES usuario(id);
ALTER TABLE public."solicitacao_viagem" ADD CONSTRAINT "fk_solicitacao_viagem_motorista" FOREIGN KEY (motorista_id) REFERENCES motorista(id) ON DELETE SET NULL;
ALTER TABLE public."solicitacao_viagem" ADD CONSTRAINT "fk_solicitacao_viagem_veiculo" FOREIGN KEY (veiculo_id) REFERENCES veiculo(id) ON DELETE SET NULL;
ALTER TABLE public."solicitacao_viagem" ADD CONSTRAINT "solicitacao_viagem_solicitante_id_fkey" FOREIGN KEY (solicitante_id) REFERENCES usuario(id);
ALTER TABLE public."viagem" ADD CONSTRAINT "viagem_motorista_id_fkey" FOREIGN KEY (motorista_id) REFERENCES motorista(id);
ALTER TABLE public."viagem" ADD CONSTRAINT "viagem_solicitacao_id_fkey" FOREIGN KEY (solicitacao_id) REFERENCES solicitacao_viagem(id);
ALTER TABLE public."viagem" ADD CONSTRAINT "viagem_veiculo_id_fkey" FOREIGN KEY (veiculo_id) REFERENCES veiculo(id);
ALTER TABLE public."abastecimento" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."abastecimento" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."abastecimento" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."abastecimento" TO "anon";
GRANT SELECT ON TABLE public."abastecimento" TO "anon";
GRANT UPDATE ON TABLE public."abastecimento" TO "anon";
GRANT DELETE ON TABLE public."abastecimento" TO "anon";
GRANT TRUNCATE ON TABLE public."abastecimento" TO "anon";
GRANT REFERENCES ON TABLE public."abastecimento" TO "anon";
GRANT TRIGGER ON TABLE public."abastecimento" TO "anon";
GRANT MAINTAIN ON TABLE public."abastecimento" TO "anon";
GRANT INSERT ON TABLE public."abastecimento" TO "authenticated";
GRANT SELECT ON TABLE public."abastecimento" TO "authenticated";
GRANT UPDATE ON TABLE public."abastecimento" TO "authenticated";
GRANT DELETE ON TABLE public."abastecimento" TO "authenticated";
GRANT TRUNCATE ON TABLE public."abastecimento" TO "authenticated";
GRANT REFERENCES ON TABLE public."abastecimento" TO "authenticated";
GRANT TRIGGER ON TABLE public."abastecimento" TO "authenticated";
GRANT MAINTAIN ON TABLE public."abastecimento" TO "authenticated";
GRANT INSERT ON TABLE public."abastecimento" TO "postgres";
GRANT SELECT ON TABLE public."abastecimento" TO "postgres";
GRANT UPDATE ON TABLE public."abastecimento" TO "postgres";
GRANT DELETE ON TABLE public."abastecimento" TO "postgres";
GRANT TRUNCATE ON TABLE public."abastecimento" TO "postgres";
GRANT REFERENCES ON TABLE public."abastecimento" TO "postgres";
GRANT TRIGGER ON TABLE public."abastecimento" TO "postgres";
GRANT MAINTAIN ON TABLE public."abastecimento" TO "postgres";
GRANT INSERT ON TABLE public."abastecimento" TO "service_role";
GRANT SELECT ON TABLE public."abastecimento" TO "service_role";
GRANT UPDATE ON TABLE public."abastecimento" TO "service_role";
GRANT DELETE ON TABLE public."abastecimento" TO "service_role";
GRANT TRUNCATE ON TABLE public."abastecimento" TO "service_role";
GRANT REFERENCES ON TABLE public."abastecimento" TO "service_role";
GRANT TRIGGER ON TABLE public."abastecimento" TO "service_role";
GRANT MAINTAIN ON TABLE public."abastecimento" TO "service_role";
ALTER TABLE public."documento_veiculo" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."documento_veiculo" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."documento_veiculo" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."documento_veiculo" TO "anon";
GRANT SELECT ON TABLE public."documento_veiculo" TO "anon";
GRANT UPDATE ON TABLE public."documento_veiculo" TO "anon";
GRANT DELETE ON TABLE public."documento_veiculo" TO "anon";
GRANT TRUNCATE ON TABLE public."documento_veiculo" TO "anon";
GRANT REFERENCES ON TABLE public."documento_veiculo" TO "anon";
GRANT TRIGGER ON TABLE public."documento_veiculo" TO "anon";
GRANT MAINTAIN ON TABLE public."documento_veiculo" TO "anon";
GRANT INSERT ON TABLE public."documento_veiculo" TO "authenticated";
GRANT SELECT ON TABLE public."documento_veiculo" TO "authenticated";
GRANT UPDATE ON TABLE public."documento_veiculo" TO "authenticated";
GRANT DELETE ON TABLE public."documento_veiculo" TO "authenticated";
GRANT TRUNCATE ON TABLE public."documento_veiculo" TO "authenticated";
GRANT REFERENCES ON TABLE public."documento_veiculo" TO "authenticated";
GRANT TRIGGER ON TABLE public."documento_veiculo" TO "authenticated";
GRANT MAINTAIN ON TABLE public."documento_veiculo" TO "authenticated";
GRANT INSERT ON TABLE public."documento_veiculo" TO "postgres";
GRANT SELECT ON TABLE public."documento_veiculo" TO "postgres";
GRANT UPDATE ON TABLE public."documento_veiculo" TO "postgres";
GRANT DELETE ON TABLE public."documento_veiculo" TO "postgres";
GRANT TRUNCATE ON TABLE public."documento_veiculo" TO "postgres";
GRANT REFERENCES ON TABLE public."documento_veiculo" TO "postgres";
GRANT TRIGGER ON TABLE public."documento_veiculo" TO "postgres";
GRANT MAINTAIN ON TABLE public."documento_veiculo" TO "postgres";
GRANT INSERT ON TABLE public."documento_veiculo" TO "service_role";
GRANT SELECT ON TABLE public."documento_veiculo" TO "service_role";
GRANT UPDATE ON TABLE public."documento_veiculo" TO "service_role";
GRANT DELETE ON TABLE public."documento_veiculo" TO "service_role";
GRANT TRUNCATE ON TABLE public."documento_veiculo" TO "service_role";
GRANT REFERENCES ON TABLE public."documento_veiculo" TO "service_role";
GRANT TRIGGER ON TABLE public."documento_veiculo" TO "service_role";
GRANT MAINTAIN ON TABLE public."documento_veiculo" TO "service_role";
ALTER TABLE public."log_atividade" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."log_atividade" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."log_atividade" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."log_atividade" TO "anon";
GRANT SELECT ON TABLE public."log_atividade" TO "anon";
GRANT UPDATE ON TABLE public."log_atividade" TO "anon";
GRANT DELETE ON TABLE public."log_atividade" TO "anon";
GRANT TRUNCATE ON TABLE public."log_atividade" TO "anon";
GRANT REFERENCES ON TABLE public."log_atividade" TO "anon";
GRANT TRIGGER ON TABLE public."log_atividade" TO "anon";
GRANT MAINTAIN ON TABLE public."log_atividade" TO "anon";
GRANT INSERT ON TABLE public."log_atividade" TO "authenticated";
GRANT SELECT ON TABLE public."log_atividade" TO "authenticated";
GRANT UPDATE ON TABLE public."log_atividade" TO "authenticated";
GRANT DELETE ON TABLE public."log_atividade" TO "authenticated";
GRANT TRUNCATE ON TABLE public."log_atividade" TO "authenticated";
GRANT REFERENCES ON TABLE public."log_atividade" TO "authenticated";
GRANT TRIGGER ON TABLE public."log_atividade" TO "authenticated";
GRANT MAINTAIN ON TABLE public."log_atividade" TO "authenticated";
GRANT INSERT ON TABLE public."log_atividade" TO "postgres";
GRANT SELECT ON TABLE public."log_atividade" TO "postgres";
GRANT UPDATE ON TABLE public."log_atividade" TO "postgres";
GRANT DELETE ON TABLE public."log_atividade" TO "postgres";
GRANT TRUNCATE ON TABLE public."log_atividade" TO "postgres";
GRANT REFERENCES ON TABLE public."log_atividade" TO "postgres";
GRANT TRIGGER ON TABLE public."log_atividade" TO "postgres";
GRANT MAINTAIN ON TABLE public."log_atividade" TO "postgres";
GRANT INSERT ON TABLE public."log_atividade" TO "service_role";
GRANT SELECT ON TABLE public."log_atividade" TO "service_role";
GRANT UPDATE ON TABLE public."log_atividade" TO "service_role";
GRANT DELETE ON TABLE public."log_atividade" TO "service_role";
GRANT TRUNCATE ON TABLE public."log_atividade" TO "service_role";
GRANT REFERENCES ON TABLE public."log_atividade" TO "service_role";
GRANT TRIGGER ON TABLE public."log_atividade" TO "service_role";
GRANT MAINTAIN ON TABLE public."log_atividade" TO "service_role";
ALTER TABLE public."motorista" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."motorista" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."motorista" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."motorista" TO "anon";
GRANT SELECT ON TABLE public."motorista" TO "anon";
GRANT UPDATE ON TABLE public."motorista" TO "anon";
GRANT DELETE ON TABLE public."motorista" TO "anon";
GRANT TRUNCATE ON TABLE public."motorista" TO "anon";
GRANT REFERENCES ON TABLE public."motorista" TO "anon";
GRANT TRIGGER ON TABLE public."motorista" TO "anon";
GRANT MAINTAIN ON TABLE public."motorista" TO "anon";
GRANT INSERT ON TABLE public."motorista" TO "authenticated";
GRANT SELECT ON TABLE public."motorista" TO "authenticated";
GRANT UPDATE ON TABLE public."motorista" TO "authenticated";
GRANT DELETE ON TABLE public."motorista" TO "authenticated";
GRANT TRUNCATE ON TABLE public."motorista" TO "authenticated";
GRANT REFERENCES ON TABLE public."motorista" TO "authenticated";
GRANT TRIGGER ON TABLE public."motorista" TO "authenticated";
GRANT MAINTAIN ON TABLE public."motorista" TO "authenticated";
GRANT INSERT ON TABLE public."motorista" TO "postgres";
GRANT SELECT ON TABLE public."motorista" TO "postgres";
GRANT UPDATE ON TABLE public."motorista" TO "postgres";
GRANT DELETE ON TABLE public."motorista" TO "postgres";
GRANT TRUNCATE ON TABLE public."motorista" TO "postgres";
GRANT REFERENCES ON TABLE public."motorista" TO "postgres";
GRANT TRIGGER ON TABLE public."motorista" TO "postgres";
GRANT MAINTAIN ON TABLE public."motorista" TO "postgres";
GRANT INSERT ON TABLE public."motorista" TO "service_role";
GRANT SELECT ON TABLE public."motorista" TO "service_role";
GRANT UPDATE ON TABLE public."motorista" TO "service_role";
GRANT DELETE ON TABLE public."motorista" TO "service_role";
GRANT TRUNCATE ON TABLE public."motorista" TO "service_role";
GRANT REFERENCES ON TABLE public."motorista" TO "service_role";
GRANT TRIGGER ON TABLE public."motorista" TO "service_role";
GRANT MAINTAIN ON TABLE public."motorista" TO "service_role";
ALTER TABLE public."ordem_coleta" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."ordem_coleta" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."ordem_coleta" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."ordem_coleta" TO "anon";
GRANT SELECT ON TABLE public."ordem_coleta" TO "anon";
GRANT UPDATE ON TABLE public."ordem_coleta" TO "anon";
GRANT DELETE ON TABLE public."ordem_coleta" TO "anon";
GRANT TRUNCATE ON TABLE public."ordem_coleta" TO "anon";
GRANT REFERENCES ON TABLE public."ordem_coleta" TO "anon";
GRANT TRIGGER ON TABLE public."ordem_coleta" TO "anon";
GRANT MAINTAIN ON TABLE public."ordem_coleta" TO "anon";
GRANT INSERT ON TABLE public."ordem_coleta" TO "authenticated";
GRANT SELECT ON TABLE public."ordem_coleta" TO "authenticated";
GRANT UPDATE ON TABLE public."ordem_coleta" TO "authenticated";
GRANT DELETE ON TABLE public."ordem_coleta" TO "authenticated";
GRANT TRUNCATE ON TABLE public."ordem_coleta" TO "authenticated";
GRANT REFERENCES ON TABLE public."ordem_coleta" TO "authenticated";
GRANT TRIGGER ON TABLE public."ordem_coleta" TO "authenticated";
GRANT MAINTAIN ON TABLE public."ordem_coleta" TO "authenticated";
GRANT INSERT ON TABLE public."ordem_coleta" TO "postgres";
GRANT SELECT ON TABLE public."ordem_coleta" TO "postgres";
GRANT UPDATE ON TABLE public."ordem_coleta" TO "postgres";
GRANT DELETE ON TABLE public."ordem_coleta" TO "postgres";
GRANT TRUNCATE ON TABLE public."ordem_coleta" TO "postgres";
GRANT REFERENCES ON TABLE public."ordem_coleta" TO "postgres";
GRANT TRIGGER ON TABLE public."ordem_coleta" TO "postgres";
GRANT MAINTAIN ON TABLE public."ordem_coleta" TO "postgres";
GRANT INSERT ON TABLE public."ordem_coleta" TO "service_role";
GRANT SELECT ON TABLE public."ordem_coleta" TO "service_role";
GRANT UPDATE ON TABLE public."ordem_coleta" TO "service_role";
GRANT DELETE ON TABLE public."ordem_coleta" TO "service_role";
GRANT TRUNCATE ON TABLE public."ordem_coleta" TO "service_role";
GRANT REFERENCES ON TABLE public."ordem_coleta" TO "service_role";
GRANT TRIGGER ON TABLE public."ordem_coleta" TO "service_role";
GRANT MAINTAIN ON TABLE public."ordem_coleta" TO "service_role";
ALTER TABLE public."solicitacao_obito" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."solicitacao_obito" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."solicitacao_obito" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."solicitacao_obito" TO "anon";
GRANT SELECT ON TABLE public."solicitacao_obito" TO "anon";
GRANT UPDATE ON TABLE public."solicitacao_obito" TO "anon";
GRANT DELETE ON TABLE public."solicitacao_obito" TO "anon";
GRANT TRUNCATE ON TABLE public."solicitacao_obito" TO "anon";
GRANT REFERENCES ON TABLE public."solicitacao_obito" TO "anon";
GRANT TRIGGER ON TABLE public."solicitacao_obito" TO "anon";
GRANT MAINTAIN ON TABLE public."solicitacao_obito" TO "anon";
GRANT INSERT ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT SELECT ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT UPDATE ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT DELETE ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT TRUNCATE ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT REFERENCES ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT TRIGGER ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT MAINTAIN ON TABLE public."solicitacao_obito" TO "authenticated";
GRANT INSERT ON TABLE public."solicitacao_obito" TO "postgres";
GRANT SELECT ON TABLE public."solicitacao_obito" TO "postgres";
GRANT UPDATE ON TABLE public."solicitacao_obito" TO "postgres";
GRANT DELETE ON TABLE public."solicitacao_obito" TO "postgres";
GRANT TRUNCATE ON TABLE public."solicitacao_obito" TO "postgres";
GRANT REFERENCES ON TABLE public."solicitacao_obito" TO "postgres";
GRANT TRIGGER ON TABLE public."solicitacao_obito" TO "postgres";
GRANT MAINTAIN ON TABLE public."solicitacao_obito" TO "postgres";
GRANT INSERT ON TABLE public."solicitacao_obito" TO "service_role";
GRANT SELECT ON TABLE public."solicitacao_obito" TO "service_role";
GRANT UPDATE ON TABLE public."solicitacao_obito" TO "service_role";
GRANT DELETE ON TABLE public."solicitacao_obito" TO "service_role";
GRANT TRUNCATE ON TABLE public."solicitacao_obito" TO "service_role";
GRANT REFERENCES ON TABLE public."solicitacao_obito" TO "service_role";
GRANT TRIGGER ON TABLE public."solicitacao_obito" TO "service_role";
GRANT MAINTAIN ON TABLE public."solicitacao_obito" TO "service_role";
ALTER TABLE public."solicitacao_viagem" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."solicitacao_viagem" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."solicitacao_viagem" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."solicitacao_viagem" TO "anon";
GRANT SELECT ON TABLE public."solicitacao_viagem" TO "anon";
GRANT UPDATE ON TABLE public."solicitacao_viagem" TO "anon";
GRANT DELETE ON TABLE public."solicitacao_viagem" TO "anon";
GRANT TRUNCATE ON TABLE public."solicitacao_viagem" TO "anon";
GRANT REFERENCES ON TABLE public."solicitacao_viagem" TO "anon";
GRANT TRIGGER ON TABLE public."solicitacao_viagem" TO "anon";
GRANT MAINTAIN ON TABLE public."solicitacao_viagem" TO "anon";
GRANT INSERT ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT SELECT ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT UPDATE ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT DELETE ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT TRUNCATE ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT REFERENCES ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT TRIGGER ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT MAINTAIN ON TABLE public."solicitacao_viagem" TO "authenticated";
GRANT INSERT ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT SELECT ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT UPDATE ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT DELETE ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT TRUNCATE ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT REFERENCES ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT TRIGGER ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT MAINTAIN ON TABLE public."solicitacao_viagem" TO "postgres";
GRANT INSERT ON TABLE public."solicitacao_viagem" TO "service_role";
GRANT SELECT ON TABLE public."solicitacao_viagem" TO "service_role";
GRANT UPDATE ON TABLE public."solicitacao_viagem" TO "service_role";
GRANT DELETE ON TABLE public."solicitacao_viagem" TO "service_role";
GRANT TRUNCATE ON TABLE public."solicitacao_viagem" TO "service_role";
GRANT REFERENCES ON TABLE public."solicitacao_viagem" TO "service_role";
GRANT TRIGGER ON TABLE public."solicitacao_viagem" TO "service_role";
GRANT MAINTAIN ON TABLE public."solicitacao_viagem" TO "service_role";
ALTER TABLE public."usuario" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."usuario" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."usuario" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."usuario" TO "anon";
GRANT SELECT ON TABLE public."usuario" TO "anon";
GRANT UPDATE ON TABLE public."usuario" TO "anon";
GRANT DELETE ON TABLE public."usuario" TO "anon";
GRANT TRUNCATE ON TABLE public."usuario" TO "anon";
GRANT REFERENCES ON TABLE public."usuario" TO "anon";
GRANT TRIGGER ON TABLE public."usuario" TO "anon";
GRANT MAINTAIN ON TABLE public."usuario" TO "anon";
GRANT INSERT ON TABLE public."usuario" TO "authenticated";
GRANT SELECT ON TABLE public."usuario" TO "authenticated";
GRANT UPDATE ON TABLE public."usuario" TO "authenticated";
GRANT DELETE ON TABLE public."usuario" TO "authenticated";
GRANT TRUNCATE ON TABLE public."usuario" TO "authenticated";
GRANT REFERENCES ON TABLE public."usuario" TO "authenticated";
GRANT TRIGGER ON TABLE public."usuario" TO "authenticated";
GRANT MAINTAIN ON TABLE public."usuario" TO "authenticated";
GRANT INSERT ON TABLE public."usuario" TO "postgres";
GRANT SELECT ON TABLE public."usuario" TO "postgres";
GRANT UPDATE ON TABLE public."usuario" TO "postgres";
GRANT DELETE ON TABLE public."usuario" TO "postgres";
GRANT TRUNCATE ON TABLE public."usuario" TO "postgres";
GRANT REFERENCES ON TABLE public."usuario" TO "postgres";
GRANT TRIGGER ON TABLE public."usuario" TO "postgres";
GRANT MAINTAIN ON TABLE public."usuario" TO "postgres";
GRANT INSERT ON TABLE public."usuario" TO "service_role";
GRANT SELECT ON TABLE public."usuario" TO "service_role";
GRANT UPDATE ON TABLE public."usuario" TO "service_role";
GRANT DELETE ON TABLE public."usuario" TO "service_role";
GRANT TRUNCATE ON TABLE public."usuario" TO "service_role";
GRANT REFERENCES ON TABLE public."usuario" TO "service_role";
GRANT TRIGGER ON TABLE public."usuario" TO "service_role";
GRANT MAINTAIN ON TABLE public."usuario" TO "service_role";
ALTER TABLE public."veiculo" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."veiculo" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."veiculo" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."veiculo" TO "anon";
GRANT SELECT ON TABLE public."veiculo" TO "anon";
GRANT UPDATE ON TABLE public."veiculo" TO "anon";
GRANT DELETE ON TABLE public."veiculo" TO "anon";
GRANT TRUNCATE ON TABLE public."veiculo" TO "anon";
GRANT REFERENCES ON TABLE public."veiculo" TO "anon";
GRANT TRIGGER ON TABLE public."veiculo" TO "anon";
GRANT MAINTAIN ON TABLE public."veiculo" TO "anon";
GRANT INSERT ON TABLE public."veiculo" TO "authenticated";
GRANT SELECT ON TABLE public."veiculo" TO "authenticated";
GRANT UPDATE ON TABLE public."veiculo" TO "authenticated";
GRANT DELETE ON TABLE public."veiculo" TO "authenticated";
GRANT TRUNCATE ON TABLE public."veiculo" TO "authenticated";
GRANT REFERENCES ON TABLE public."veiculo" TO "authenticated";
GRANT TRIGGER ON TABLE public."veiculo" TO "authenticated";
GRANT MAINTAIN ON TABLE public."veiculo" TO "authenticated";
GRANT INSERT ON TABLE public."veiculo" TO "postgres";
GRANT SELECT ON TABLE public."veiculo" TO "postgres";
GRANT UPDATE ON TABLE public."veiculo" TO "postgres";
GRANT DELETE ON TABLE public."veiculo" TO "postgres";
GRANT TRUNCATE ON TABLE public."veiculo" TO "postgres";
GRANT REFERENCES ON TABLE public."veiculo" TO "postgres";
GRANT TRIGGER ON TABLE public."veiculo" TO "postgres";
GRANT MAINTAIN ON TABLE public."veiculo" TO "postgres";
GRANT INSERT ON TABLE public."veiculo" TO "service_role";
GRANT SELECT ON TABLE public."veiculo" TO "service_role";
GRANT UPDATE ON TABLE public."veiculo" TO "service_role";
GRANT DELETE ON TABLE public."veiculo" TO "service_role";
GRANT TRUNCATE ON TABLE public."veiculo" TO "service_role";
GRANT REFERENCES ON TABLE public."veiculo" TO "service_role";
GRANT TRIGGER ON TABLE public."veiculo" TO "service_role";
GRANT MAINTAIN ON TABLE public."veiculo" TO "service_role";
ALTER TABLE public."viagem" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."viagem" NO FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public."viagem" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT INSERT ON TABLE public."viagem" TO "anon";
GRANT SELECT ON TABLE public."viagem" TO "anon";
GRANT UPDATE ON TABLE public."viagem" TO "anon";
GRANT DELETE ON TABLE public."viagem" TO "anon";
GRANT TRUNCATE ON TABLE public."viagem" TO "anon";
GRANT REFERENCES ON TABLE public."viagem" TO "anon";
GRANT TRIGGER ON TABLE public."viagem" TO "anon";
GRANT MAINTAIN ON TABLE public."viagem" TO "anon";
GRANT INSERT ON TABLE public."viagem" TO "authenticated";
GRANT SELECT ON TABLE public."viagem" TO "authenticated";
GRANT UPDATE ON TABLE public."viagem" TO "authenticated";
GRANT DELETE ON TABLE public."viagem" TO "authenticated";
GRANT TRUNCATE ON TABLE public."viagem" TO "authenticated";
GRANT REFERENCES ON TABLE public."viagem" TO "authenticated";
GRANT TRIGGER ON TABLE public."viagem" TO "authenticated";
GRANT MAINTAIN ON TABLE public."viagem" TO "authenticated";
GRANT INSERT ON TABLE public."viagem" TO "postgres";
GRANT SELECT ON TABLE public."viagem" TO "postgres";
GRANT UPDATE ON TABLE public."viagem" TO "postgres";
GRANT DELETE ON TABLE public."viagem" TO "postgres";
GRANT TRUNCATE ON TABLE public."viagem" TO "postgres";
GRANT REFERENCES ON TABLE public."viagem" TO "postgres";
GRANT TRIGGER ON TABLE public."viagem" TO "postgres";
GRANT MAINTAIN ON TABLE public."viagem" TO "postgres";
GRANT INSERT ON TABLE public."viagem" TO "service_role";
GRANT SELECT ON TABLE public."viagem" TO "service_role";
GRANT UPDATE ON TABLE public."viagem" TO "service_role";
GRANT DELETE ON TABLE public."viagem" TO "service_role";
GRANT TRUNCATE ON TABLE public."viagem" TO "service_role";
GRANT REFERENCES ON TABLE public."viagem" TO "service_role";
GRANT TRIGGER ON TABLE public."viagem" TO "service_role";
GRANT MAINTAIN ON TABLE public."viagem" TO "service_role";
REVOKE ALL ON SEQUENCE public."abastecimento_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."abastecimento_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."abastecimento_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."abastecimento_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."abastecimento_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."abastecimento_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."abastecimento_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."abastecimento_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."abastecimento_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."abastecimento_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."abastecimento_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."abastecimento_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."abastecimento_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."documento_veiculo_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."documento_veiculo_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."documento_veiculo_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."documento_veiculo_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."documento_veiculo_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."documento_veiculo_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."documento_veiculo_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."documento_veiculo_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."documento_veiculo_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."documento_veiculo_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."documento_veiculo_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."documento_veiculo_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."documento_veiculo_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."log_atividade_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."log_atividade_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."log_atividade_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."log_atividade_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."log_atividade_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."log_atividade_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."log_atividade_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."log_atividade_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."log_atividade_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."log_atividade_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."log_atividade_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."log_atividade_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."log_atividade_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."motorista_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."motorista_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."motorista_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."motorista_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."motorista_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."motorista_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."motorista_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."motorista_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."motorista_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."motorista_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."motorista_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."motorista_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."motorista_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."ordem_coleta_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."ordem_coleta_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."ordem_coleta_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."ordem_coleta_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."ordem_coleta_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."ordem_coleta_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."ordem_coleta_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."ordem_coleta_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."ordem_coleta_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."ordem_coleta_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."ordem_coleta_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."ordem_coleta_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."ordem_coleta_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."solicitacao_obito_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."solicitacao_obito_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."solicitacao_obito_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."solicitacao_obito_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."solicitacao_obito_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."solicitacao_obito_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."solicitacao_obito_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."solicitacao_obito_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."solicitacao_obito_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."solicitacao_obito_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."solicitacao_obito_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."solicitacao_obito_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."solicitacao_obito_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."solicitacao_viagem_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."solicitacao_viagem_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."solicitacao_viagem_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."solicitacao_viagem_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."solicitacao_viagem_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."solicitacao_viagem_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."usuario_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."usuario_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."usuario_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."usuario_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."usuario_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."usuario_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."usuario_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."usuario_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."usuario_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."usuario_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."usuario_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."usuario_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."usuario_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."veiculo_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."veiculo_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."veiculo_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."veiculo_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."veiculo_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."veiculo_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."veiculo_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."veiculo_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."veiculo_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."veiculo_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."veiculo_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."veiculo_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."veiculo_id_seq" TO "service_role";
REVOKE ALL ON SEQUENCE public."viagem_id_seq" FROM PUBLIC, postgres, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public."viagem_id_seq" TO "anon";
GRANT UPDATE ON SEQUENCE public."viagem_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE public."viagem_id_seq" TO "anon";
GRANT SELECT ON SEQUENCE public."viagem_id_seq" TO "authenticated";
GRANT UPDATE ON SEQUENCE public."viagem_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE public."viagem_id_seq" TO "authenticated";
GRANT SELECT ON SEQUENCE public."viagem_id_seq" TO "postgres";
GRANT UPDATE ON SEQUENCE public."viagem_id_seq" TO "postgres";
GRANT USAGE ON SEQUENCE public."viagem_id_seq" TO "postgres";
GRANT SELECT ON SEQUENCE public."viagem_id_seq" TO "service_role";
GRANT UPDATE ON SEQUENCE public."viagem_id_seq" TO "service_role";
GRANT USAGE ON SEQUENCE public."viagem_id_seq" TO "service_role";
ALTER SCHEMA public OWNER TO "pg_database_owner";
REVOKE ALL ON SCHEMA public FROM PUBLIC, postgres, anon, authenticated, service_role, pg_database_owner;
GRANT USAGE ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO "anon";
GRANT USAGE ON SCHEMA public TO "authenticated";
GRANT USAGE ON SCHEMA public TO "pg_database_owner";
GRANT CREATE ON SCHEMA public TO "pg_database_owner";
GRANT USAGE ON SCHEMA public TO "postgres";
GRANT USAGE ON SCHEMA public TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT INSERT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT REFERENCES ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRIGGER ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT INSERT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT REFERENCES ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRIGGER ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT INSERT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT REFERENCES ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRIGGER ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT INSERT ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT DELETE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT REFERENCES ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT TRIGGER ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT INSERT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT DELETE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT REFERENCES ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRIGGER ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT INSERT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT DELETE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT REFERENCES ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRIGGER ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT INSERT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT DELETE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT REFERENCES ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRIGGER ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT INSERT ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT DELETE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRUNCATE ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT REFERENCES ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT TRIGGER ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT MAINTAIN ON TABLES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT SELECT ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT UPDATE ON SEQUENCES TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA public GRANT USAGE ON SEQUENCES TO "service_role";
