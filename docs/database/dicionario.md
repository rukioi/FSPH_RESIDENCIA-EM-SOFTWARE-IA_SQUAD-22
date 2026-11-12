# Dicionário estrutural

<!-- Gerado por db:docs:generate. Não editar manualmente. -->

Fonte: catálogo do PostgreSQL isolado. Tipos, nulabilidade, constraints e índices
não substituem regras de negócio. Veja [metadados](./schema-metadata.json),
[DDL](./schema.sql), [DER](./der.mmd) e [limites de segurança](../seguranca.md).

DEFAULT não implica NOT NULL. Datas civis e timestamps sem fuso preservam os
tipos existentes; este catálogo não define sua serialização HTTP ou fuso histórico.

## abastecimento

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('abastecimento_id_seq'::regclass)` |
| `veiculo_id` | `bigint` | Não | — |
| `motorista_id` | `bigint` | Sim | — |
| `litragem` | `numeric(10,2)` | Não | — |
| `valor_total` | `numeric(10,2)` | Não | — |
| `quilometragem` | `integer` | Sim | — |
| `data_abastecimento` | `date` | Não | — |
| `criado_em` | `timestamp without time zone` | Sim | `now()` |
| `posto` | `character varying(255)` | Sim | — |
| `tanque_completo` | `boolean` | Não | `false` |
| `criado_por_id` | `bigint` | Sim | — |

Constraints:

- `abastecimento_criado_por_id_fkey`: `FOREIGN KEY (criado_por_id) REFERENCES usuario(id)`; validada: sim.
- `abastecimento_litragem_positiva`: `CHECK (litragem > 0::numeric AND litragem <> 'NaN'::numeric)`; validada: sim.
- `abastecimento_motorista_id_fkey`: `FOREIGN KEY (motorista_id) REFERENCES motorista(id)`; validada: sim.
- `abastecimento_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `abastecimento_quilometragem_valida`: `CHECK (quilometragem IS NULL OR quilometragem >= 0)`; validada: sim.
- `abastecimento_valor_positivo`: `CHECK (valor_total > 0::numeric AND valor_total <> 'NaN'::numeric)`; validada: sim.
- `abastecimento_veiculo_id_fkey`: `FOREIGN KEY (veiculo_id) REFERENCES veiculo(id)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX abastecimento_pkey ON public.abastecimento USING btree (id)`.
- `CREATE INDEX idx_abastecimento_data ON public.abastecimento USING btree (data_abastecimento DESC, id DESC)`.
- `CREATE INDEX idx_abastecimento_veiculo_data ON public.abastecimento USING btree (veiculo_id, data_abastecimento DESC, id DESC)`.

## abastecimento_comprovante

RLS: habilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `abastecimento_id` | `bigint` | Não | — |
| `nome` | `text` | Não | — |
| `tipo` | `text` | Não | — |
| `dados` | `bytea` | Não | — |

Constraints:

- `abastecimento_comprovante_abastecimento_id_fkey`: `FOREIGN KEY (abastecimento_id) REFERENCES abastecimento(id) ON DELETE CASCADE`; validada: sim.
- `abastecimento_comprovante_nome_check`: `CHECK (length(nome) >= 1 AND length(nome) <= 255)`; validada: sim.
- `abastecimento_comprovante_pkey`: `PRIMARY KEY (abastecimento_id)`; validada: sim.
- `abastecimento_comprovante_tamanho_check`: `CHECK (octet_length(dados) >= 1 AND octet_length(dados) <= 1048576)`; validada: sim.
- `abastecimento_comprovante_tipo_check`: `CHECK (tipo = ANY (ARRAY['image/jpeg'::text, 'image/png'::text]))`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX abastecimento_comprovante_pkey ON public.abastecimento_comprovante USING btree (abastecimento_id)`.

## anexo

RLS: habilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('anexo_id_seq'::regclass)` |
| `chave` | `uuid` | Não | `gen_random_uuid()` |
| `nome` | `text` | Não | — |
| `tipo` | `text` | Não | — |
| `tamanho` | `integer` | Não | — |
| `sha256` | `text` | Não | — |
| `dados` | `bytea` | Não | — |
| `autor_id` | `bigint` | Não | — |
| `criado_em` | `timestamp with time zone` | Não | `clock_timestamp()` |
| `solicitacao_viagem_id` | `bigint` | Sim | — |
| `solicitacao_obito_id` | `bigint` | Sim | — |
| `viagem_id` | `bigint` | Sim | — |
| `ordem_coleta_id` | `bigint` | Sim | — |
| `abastecimento_id` | `bigint` | Sim | — |
| `veiculo_id` | `bigint` | Sim | — |
| `motorista_id` | `bigint` | Sim | — |
| `documento_veiculo_id` | `bigint` | Sim | — |

Constraints:

- `anexo_abastecimento_id_fkey`: `FOREIGN KEY (abastecimento_id) REFERENCES abastecimento(id)`; validada: sim.
- `anexo_assinatura_check`: `CHECK (tipo = 'application/pdf'::text AND SUBSTRING(dados FROM 1 FOR 5) = decode('255044462d'::text, 'hex'::text) OR tipo = 'image/png'::text AND SUBSTRING(dados FROM 1 FOR 8) = decode('89504e470d0a1a0a'::text, 'hex'::text) OR tipo = 'image/jpeg'::text AND SUBSTRING(dados FROM 1 FOR 3) = decode('ffd8ff'::text, 'hex'::text))`; validada: sim.
- `anexo_autor_id_fkey`: `FOREIGN KEY (autor_id) REFERENCES usuario(id)`; validada: sim.
- `anexo_chave_key`: `UNIQUE (chave)`; validada: sim.
- `anexo_documento_key`: `UNIQUE (id, documento_veiculo_id)`; validada: sim.
- `anexo_documento_veiculo_id_fkey`: `FOREIGN KEY (documento_veiculo_id) REFERENCES documento_veiculo(id)`; validada: sim.
- `anexo_hash_check`: `CHECK (sha256 = encode(sha256(dados), 'hex'::text))`; validada: sim.
- `anexo_motorista_id_fkey`: `FOREIGN KEY (motorista_id) REFERENCES motorista(id)`; validada: sim.
- `anexo_motorista_key`: `UNIQUE (id, motorista_id)`; validada: sim.
- `anexo_nome_check`: `CHECK (char_length(btrim(nome)) >= 1 AND char_length(btrim(nome)) <= 255 AND nome !~ '[[:cntrl:]/]'::text AND POSITION((chr(92)) IN (nome)) = 0 AND (nome <> ALL (ARRAY['.'::text, '..'::text])))`; validada: sim.
- `anexo_ordem_coleta_id_fkey`: `FOREIGN KEY (ordem_coleta_id) REFERENCES ordem_coleta(id)`; validada: sim.
- `anexo_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `anexo_registro_check`: `CHECK (num_nonnulls(solicitacao_viagem_id, solicitacao_obito_id, viagem_id, ordem_coleta_id, abastecimento_id, veiculo_id, motorista_id, documento_veiculo_id) = 1)`; validada: sim.
- `anexo_solicitacao_obito_id_fkey`: `FOREIGN KEY (solicitacao_obito_id) REFERENCES solicitacao_obito(id)`; validada: sim.
- `anexo_solicitacao_viagem_id_fkey`: `FOREIGN KEY (solicitacao_viagem_id) REFERENCES solicitacao_viagem(id)`; validada: sim.
- `anexo_tamanho_check`: `CHECK (tamanho >= 1 AND tamanho <= 5242880 AND tamanho = octet_length(dados))`; validada: sim.
- `anexo_veiculo_id_fkey`: `FOREIGN KEY (veiculo_id) REFERENCES veiculo(id)`; validada: sim.
- `anexo_viagem_id_fkey`: `FOREIGN KEY (viagem_id) REFERENCES viagem(id)`; validada: sim.

Índices:

- `CREATE INDEX anexo_abastecimento_idx ON public.anexo USING btree (abastecimento_id, criado_em DESC, id DESC) WHERE (abastecimento_id IS NOT NULL)`.
- `CREATE UNIQUE INDEX anexo_chave_key ON public.anexo USING btree (chave)`.
- `CREATE INDEX anexo_documento_idx ON public.anexo USING btree (documento_veiculo_id, criado_em DESC, id DESC) WHERE (documento_veiculo_id IS NOT NULL)`.
- `CREATE UNIQUE INDEX anexo_documento_key ON public.anexo USING btree (id, documento_veiculo_id)`.
- `CREATE INDEX anexo_motorista_idx ON public.anexo USING btree (motorista_id, criado_em DESC, id DESC) WHERE (motorista_id IS NOT NULL)`.
- `CREATE UNIQUE INDEX anexo_motorista_key ON public.anexo USING btree (id, motorista_id)`.
- `CREATE INDEX anexo_ordem_idx ON public.anexo USING btree (ordem_coleta_id, criado_em DESC, id DESC) WHERE (ordem_coleta_id IS NOT NULL)`.
- `CREATE UNIQUE INDEX anexo_pkey ON public.anexo USING btree (id)`.
- `CREATE INDEX anexo_solicitacao_obito_idx ON public.anexo USING btree (solicitacao_obito_id, criado_em DESC, id DESC) WHERE (solicitacao_obito_id IS NOT NULL)`.
- `CREATE INDEX anexo_solicitacao_viagem_idx ON public.anexo USING btree (solicitacao_viagem_id, criado_em DESC, id DESC) WHERE (solicitacao_viagem_id IS NOT NULL)`.
- `CREATE INDEX anexo_veiculo_idx ON public.anexo USING btree (veiculo_id, criado_em DESC, id DESC) WHERE (veiculo_id IS NOT NULL)`.
- `CREATE INDEX anexo_viagem_idx ON public.anexo USING btree (viagem_id, criado_em DESC, id DESC) WHERE (viagem_id IS NOT NULL)`.

## anotacao

RLS: habilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('anotacao_id_seq'::regclass)` |
| `solicitacao_viagem_id` | `bigint` | Sim | — |
| `solicitacao_obito_id` | `bigint` | Sim | — |
| `viagem_id` | `bigint` | Sim | — |
| `ordem_coleta_id` | `bigint` | Sim | — |
| `veiculo_id` | `bigint` | Sim | — |
| `texto` | `text` | Não | — |
| `autor_id` | `bigint` | Não | — |
| `criado_em` | `timestamp with time zone` | Não | `clock_timestamp()` |

Constraints:

- `anotacao_autor_id_fkey`: `FOREIGN KEY (autor_id) REFERENCES usuario(id)`; validada: sim.
- `anotacao_ordem_coleta_id_fkey`: `FOREIGN KEY (ordem_coleta_id) REFERENCES ordem_coleta(id)`; validada: sim.
- `anotacao_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `anotacao_registro_check`: `CHECK (num_nonnulls(solicitacao_viagem_id, solicitacao_obito_id, viagem_id, ordem_coleta_id, veiculo_id) = 1)`; validada: sim.
- `anotacao_solicitacao_obito_id_fkey`: `FOREIGN KEY (solicitacao_obito_id) REFERENCES solicitacao_obito(id)`; validada: sim.
- `anotacao_solicitacao_viagem_id_fkey`: `FOREIGN KEY (solicitacao_viagem_id) REFERENCES solicitacao_viagem(id)`; validada: sim.
- `anotacao_texto_check`: `CHECK (char_length(btrim(texto)) >= 1 AND char_length(btrim(texto)) <= 2000)`; validada: sim.
- `anotacao_veiculo_id_fkey`: `FOREIGN KEY (veiculo_id) REFERENCES veiculo(id)`; validada: sim.
- `anotacao_viagem_id_fkey`: `FOREIGN KEY (viagem_id) REFERENCES viagem(id)`; validada: sim.

Índices:

- `CREATE INDEX anotacao_ordem_idx ON public.anotacao USING btree (ordem_coleta_id, criado_em DESC, id DESC) WHERE (ordem_coleta_id IS NOT NULL)`.
- `CREATE UNIQUE INDEX anotacao_pkey ON public.anotacao USING btree (id)`.
- `CREATE INDEX anotacao_solicitacao_obito_idx ON public.anotacao USING btree (solicitacao_obito_id, criado_em DESC, id DESC) WHERE (solicitacao_obito_id IS NOT NULL)`.
- `CREATE INDEX anotacao_solicitacao_viagem_idx ON public.anotacao USING btree (solicitacao_viagem_id, criado_em DESC, id DESC) WHERE (solicitacao_viagem_id IS NOT NULL)`.
- `CREATE INDEX anotacao_veiculo_idx ON public.anotacao USING btree (veiculo_id, criado_em DESC, id DESC) WHERE (veiculo_id IS NOT NULL)`.
- `CREATE INDEX anotacao_viagem_idx ON public.anotacao USING btree (viagem_id, criado_em DESC, id DESC) WHERE (viagem_id IS NOT NULL)`.

## documento_historico

RLS: habilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('documento_historico_id_seq'::regclass)` |
| `documento_veiculo_id` | `bigint` | Sim | — |
| `motorista_id` | `bigint` | Sim | — |
| `versao` | `integer` | Não | — |
| `tipo_documento` | `character varying(50)` | Sim | — |
| `data_vencimento` | `date` | Não | — |
| `status_regular` | `boolean` | Sim | — |
| `numero_cnh` | `character varying(20)` | Sim | — |
| `categoria_cnh` | `character varying(5)` | Sim | — |
| `anexo_id` | `bigint` | Sim | — |
| `autor_id` | `bigint` | Não | — |
| `criado_em` | `timestamp with time zone` | Não | `clock_timestamp()` |

Constraints:

- `documento_historico_anexo_documento_fk`: `FOREIGN KEY (anexo_id, documento_veiculo_id) REFERENCES anexo(id, documento_veiculo_id)`; validada: sim.
- `documento_historico_anexo_motorista_fk`: `FOREIGN KEY (anexo_id, motorista_id) REFERENCES anexo(id, motorista_id)`; validada: sim.
- `documento_historico_autor_id_fkey`: `FOREIGN KEY (autor_id) REFERENCES usuario(id)`; validada: sim.
- `documento_historico_dados_check`: `CHECK (documento_veiculo_id IS NOT NULL AND tipo_documento IS NOT NULL AND btrim(tipo_documento::text) <> ''::text AND numero_cnh IS NULL AND categoria_cnh IS NULL OR motorista_id IS NOT NULL AND tipo_documento IS NULL AND status_regular IS NULL AND numero_cnh IS NOT NULL AND btrim(numero_cnh::text) <> ''::text AND categoria_cnh IS NOT NULL AND btrim(categoria_cnh::text) <> ''::text)`; validada: sim.
- `documento_historico_documento_veiculo_id_fkey`: `FOREIGN KEY (documento_veiculo_id) REFERENCES documento_veiculo(id)`; validada: sim.
- `documento_historico_documento_versao_key`: `UNIQUE (documento_veiculo_id, versao)`; validada: sim.
- `documento_historico_motorista_id_fkey`: `FOREIGN KEY (motorista_id) REFERENCES motorista(id)`; validada: sim.
- `documento_historico_motorista_versao_key`: `UNIQUE (motorista_id, versao)`; validada: sim.
- `documento_historico_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `documento_historico_registro_check`: `CHECK (num_nonnulls(documento_veiculo_id, motorista_id) = 1)`; validada: sim.
- `documento_historico_versao_check`: `CHECK (versao >= 1)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX documento_historico_documento_versao_key ON public.documento_historico USING btree (documento_veiculo_id, versao)`.
- `CREATE UNIQUE INDEX documento_historico_motorista_versao_key ON public.documento_historico USING btree (motorista_id, versao)`.
- `CREATE UNIQUE INDEX documento_historico_pkey ON public.documento_historico USING btree (id)`.
- `CREATE INDEX documento_historico_vencimento_idx ON public.documento_historico USING btree (data_vencimento, id)`.

## documento_veiculo

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('documento_veiculo_id_seq'::regclass)` |
| `veiculo_id` | `bigint` | Sim | — |
| `tipo_documento` | `character varying(50)` | Não | — |
| `data_vencimento` | `date` | Não | — |
| `status_regular` | `boolean` | Sim | `true` |
| `arquivo_dados` | `bytea` | Sim | — |
| `arquivo_nome` | `character varying(255)` | Sim | — |
| `arquivo_tipo` | `character varying(100)` | Sim | — |

Constraints:

- `documento_veiculo_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `documento_veiculo_veiculo_id_fkey`: `FOREIGN KEY (veiculo_id) REFERENCES veiculo(id)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX documento_veiculo_pkey ON public.documento_veiculo USING btree (id)`.
- `CREATE INDEX documento_veiculo_vencimento_idx ON public.documento_veiculo USING btree (data_vencimento, id)`.

## log_atividade

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('log_atividade_id_seq'::regclass)` |
| `usuario_id` | `bigint` | Sim | — |
| `descricao` | `text` | Não | — |
| `data_hora` | `timestamp without time zone` | Sim | `CURRENT_TIMESTAMP` |
| `solicitacao_viagem_id` | `bigint` | Sim | — |

Constraints:

- `fk_log_atividade_usuario`: `FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE SET NULL`; validada: sim.
- `log_atividade_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `log_atividade_solicitacao_viagem_id_fkey`: `FOREIGN KEY (solicitacao_viagem_id) REFERENCES solicitacao_viagem(id)`; validada: sim.
- `log_atividade_usuario_id_fkey`: `FOREIGN KEY (usuario_id) REFERENCES usuario(id)`; validada: sim.

Índices:

- `CREATE INDEX idx_log_atividade_solicitacao_viagem_id ON public.log_atividade USING btree (solicitacao_viagem_id)`.
- `CREATE UNIQUE INDEX log_atividade_pkey ON public.log_atividade USING btree (id)`.

## motorista

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('motorista_id_seq'::regclass)` |
| `usuario_id` | `bigint` | Sim | — |
| `nome` | `character varying(150)` | Não | — |
| `cnh` | `character varying(20)` | Não | — |
| `categoria_cnh` | `character varying(5)` | Não | — |
| `validade_cnh` | `date` | Não | — |
| `status` | `status_motorista` | Sim | `'DISPONIVEL'::status_motorista` |
| `criado_em` | `timestamp without time zone` | Sim | `CURRENT_TIMESTAMP` |
| `cpf` | `character varying(14)` | Sim | — |
| `telefone` | `character varying(20)` | Sim | — |

Constraints:

- `motorista_cnh_key`: `UNIQUE (cnh)`; validada: sim.
- `motorista_cpf_key`: `UNIQUE (cpf)`; validada: sim.
- `motorista_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `motorista_usuario_id_fkey`: `FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE`; validada: sim.
- `motorista_usuario_id_key`: `UNIQUE (usuario_id)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX motorista_cnh_key ON public.motorista USING btree (cnh)`.
- `CREATE UNIQUE INDEX motorista_cpf_key ON public.motorista USING btree (cpf)`.
- `CREATE UNIQUE INDEX motorista_pkey ON public.motorista USING btree (id)`.
- `CREATE UNIQUE INDEX motorista_usuario_id_key ON public.motorista USING btree (usuario_id)`.
- `CREATE INDEX motorista_validade_cnh_idx ON public.motorista USING btree (validade_cnh, id)`.

## notificacao

RLS: habilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('notificacao_id_seq'::regclass)` |
| `usuario_id` | `bigint` | Não | — |
| `chave` | `text` | Não | — |
| `titulo` | `character varying(200)` | Não | — |
| `descricao` | `text` | Não | — |
| `categoria` | `text` | Não | — |
| `criado_em` | `timestamp with time zone` | Não | `clock_timestamp()` |
| `lida_em` | `timestamp with time zone` | Sim | — |
| `tipo` | `text` | Sim | — |
| `viagem_id` | `bigint` | Sim | — |

Constraints:

- `notificacao_categoria_check`: `CHECK (categoria = ANY (ARRAY['informacao'::text, 'atencao'::text, 'urgente'::text, 'sucesso'::text]))`; validada: sim.
- `notificacao_demanda_check`: `CHECK (tipo IS NULL OR viagem_id IS NOT NULL AND chave ~~ (((('viagem:'::text \|\| viagem_id::text) \|\| ':'::text) \|\| lower(tipo)) \|\| ':%'::text))`; validada: sim.
- `notificacao_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `notificacao_tipo_check`: `CHECK (tipo IS NULL OR (tipo = ANY (ARRAY['ATRIBUICAO'::text, 'LEMBRETE'::text])))`; validada: sim.
- `notificacao_usuario_id_chave_key`: `UNIQUE (usuario_id, chave)`; validada: sim.
- `notificacao_usuario_id_fkey`: `FOREIGN KEY (usuario_id) REFERENCES usuario(id) ON DELETE CASCADE`; validada: sim.
- `notificacao_viagem_fk`: `FOREIGN KEY (viagem_id) REFERENCES viagem(id)`; validada: sim.

Índices:

- `CREATE INDEX notificacao_caixa_idx ON public.notificacao USING btree (usuario_id, criado_em DESC, id DESC)`.
- `CREATE INDEX notificacao_nao_lida_idx ON public.notificacao USING btree (usuario_id) WHERE (lida_em IS NULL)`.
- `CREATE UNIQUE INDEX notificacao_pkey ON public.notificacao USING btree (id)`.
- `CREATE UNIQUE INDEX notificacao_usuario_id_chave_key ON public.notificacao USING btree (usuario_id, chave)`.
- `CREATE INDEX notificacao_viagem_idx ON public.notificacao USING btree (viagem_id) WHERE (viagem_id IS NOT NULL)`.

## ordem_coleta

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('ordem_coleta_id_seq'::regclass)` |
| `solicitacao_obito_id` | `bigint` | Sim | — |
| `veiculo_id` | `bigint` | Sim | — |
| `motorista_id` | `bigint` | Sim | — |
| `km_inicial` | `integer` | Sim | — |
| `km_final` | `integer` | Sim | — |
| `foto_odometro_inicio` | `character varying(255)` | Sim | — |
| `foto_odometro_fim` | `character varying(255)` | Sim | — |
| `data_inicio` | `timestamp without time zone` | Sim | — |
| `data_fim` | `timestamp without time zone` | Sim | — |
| `validada_por_svo` | `boolean` | Sim | `false` |
| `status` | `status_ordem_coleta` | Sim | `'PENDENTE_ALOCACAO'::status_ordem_coleta` |
| `quantidade_corpos` | `smallint` | Sim | — |

Constraints:

- `ordem_coleta_motorista_id_fkey`: `FOREIGN KEY (motorista_id) REFERENCES motorista(id)`; validada: sim.
- `ordem_coleta_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `ordem_coleta_quantidade_corpos_check`: `CHECK (quantidade_corpos >= 1 AND quantidade_corpos <= 4)`; validada: sim.
- `ordem_coleta_solicitacao_obito_id_fkey`: `FOREIGN KEY (solicitacao_obito_id) REFERENCES solicitacao_obito(id)`; validada: sim.
- `ordem_coleta_solicitacao_obito_id_key`: `UNIQUE (solicitacao_obito_id)`; validada: sim.
- `ordem_coleta_veiculo_id_fkey`: `FOREIGN KEY (veiculo_id) REFERENCES veiculo(id)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX ordem_coleta_pkey ON public.ordem_coleta USING btree (id)`.
- `CREATE UNIQUE INDEX ordem_coleta_solicitacao_obito_id_key ON public.ordem_coleta USING btree (solicitacao_obito_id)`.
- `CREATE INDEX ordem_coleta_veiculo_status_idx ON public.ordem_coleta USING btree (veiculo_id, status) WHERE (veiculo_id IS NOT NULL)`.

## solicitacao_obito

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('solicitacao_obito_id_seq'::regclass)` |
| `codigo` | `character varying(20)` | Não | — |
| `atendente_id` | `bigint` | Sim | — |
| `nome_falecido` | `character varying(150)` | Sim | — |
| `local_falecimento` | `character varying(255)` | Não | — |
| `endereco_remocao` | `character varying(255)` | Não | — |
| `solicitante_nome` | `character varying(150)` | Não | — |
| `solicitante_parentesco` | `character varying(50)` | Sim | — |
| `solicitante_telefone` | `character varying(20)` | Sim | — |
| `observacoes_medicas` | `text` | Sim | — |
| `criado_em` | `timestamp without time zone` | Sim | `CURRENT_TIMESTAMP` |
| `status_triagem` | `status_triagem_svo` | Sim | `'AGUARDANDO_TRIAGEM'::status_triagem_svo` |
| `canal_atendimento` | `character varying(20)` | Sim | `'TELEFONE'::character varying` |
| `ponto_referencia` | `character varying(255)` | Sim | — |
| `triagem_observacoes` | `text` | Sim | — |
| `triado_por_id` | `bigint` | Sim | — |
| `triado_em` | `timestamp without time zone` | Sim | — |

Constraints:

- `solicitacao_obito_atendente_id_fkey`: `FOREIGN KEY (atendente_id) REFERENCES usuario(id)`; validada: sim.
- `solicitacao_obito_canal_check`: `CHECK (canal_atendimento IS NULL OR canal_atendimento::text = 'TELEFONE'::text)`; validada: sim.
- `solicitacao_obito_codigo_key`: `UNIQUE (codigo)`; validada: sim.
- `solicitacao_obito_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `solicitacao_obito_triador_fk`: `FOREIGN KEY (triado_por_id) REFERENCES usuario(id)`; validada: sim.
- `solicitacao_obito_triagem_decisao_check`: `CHECK (status_triagem IS NULL OR status_triagem = 'AGUARDANDO_TRIAGEM'::status_triagem_svo AND triado_por_id IS NULL AND triado_em IS NULL OR (status_triagem = ANY (ARRAY['CONFIRMADA_SVO'::status_triagem_svo, 'ENCAMINHADA_IML'::status_triagem_svo])) AND triado_por_id IS NOT NULL AND triado_em IS NOT NULL)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX solicitacao_obito_codigo_key ON public.solicitacao_obito USING btree (codigo)`.
- `CREATE UNIQUE INDEX solicitacao_obito_pkey ON public.solicitacao_obito USING btree (id)`.
- `CREATE INDEX solicitacao_obito_triagem_criado_idx ON public.solicitacao_obito USING btree (status_triagem, criado_em DESC)`.

## solicitacao_viagem

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('solicitacao_viagem_id_seq'::regclass)` |
| `codigo` | `character varying(20)` | Não | — |
| `solicitante_id` | `bigint` | Sim | — |
| `origem` | `character varying(255)` | Não | — |
| `destino` | `character varying(255)` | Não | — |
| `data_hora_saida` | `timestamp without time zone` | Não | — |
| `qtd_passageiros` | `integer` | Sim | `1` |
| `status` | `status_solicitacao` | Sim | `'PENDENTE'::status_solicitacao` |
| `motivo_rejeicao` | `text` | Sim | — |
| `criado_em` | `timestamp without time zone` | Sim | `CURRENT_TIMESTAMP` |
| `veiculo_id` | `bigint` | Sim | — |
| `motorista_id` | `bigint` | Sim | — |
| `finalidade` | `text` | Sim | — |
| `data_hora_retorno_previsto` | `timestamp without time zone` | Sim | — |

Constraints:

- `fk_solicitacao_viagem_motorista`: `FOREIGN KEY (motorista_id) REFERENCES motorista(id) ON DELETE SET NULL`; validada: sim.
- `fk_solicitacao_viagem_veiculo`: `FOREIGN KEY (veiculo_id) REFERENCES veiculo(id) ON DELETE SET NULL`; validada: sim.
- `solicitacao_viagem_codigo_key`: `UNIQUE (codigo)`; validada: sim.
- `solicitacao_viagem_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `solicitacao_viagem_retorno_previsto_check`: `CHECK (data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto > data_hora_saida)`; validada: sim.
- `solicitacao_viagem_solicitante_id_fkey`: `FOREIGN KEY (solicitante_id) REFERENCES usuario(id)`; validada: sim.

Índices:

- `CREATE INDEX solicitacao_viagem_autor_id_idx ON public.solicitacao_viagem USING btree (solicitante_id, id DESC)`.
- `CREATE UNIQUE INDEX solicitacao_viagem_codigo_key ON public.solicitacao_viagem USING btree (codigo)`.
- `CREATE INDEX solicitacao_viagem_fila_pendente_idx ON public.solicitacao_viagem USING btree (criado_em, id) WHERE (status = 'PENDENTE'::status_solicitacao)`.
- `CREATE INDEX solicitacao_viagem_motorista_reserva_idx ON public.solicitacao_viagem USING btree (motorista_id, data_hora_saida) INCLUDE (data_hora_retorno_previsto) WHERE (status = ANY (ARRAY['AGENDADA'::status_solicitacao, 'PRONTA_PARA_INICIAR'::status_solicitacao, 'EM_ANDAMENTO'::status_solicitacao]))`.
- `CREATE UNIQUE INDEX solicitacao_viagem_pkey ON public.solicitacao_viagem USING btree (id)`.
- `CREATE INDEX solicitacao_viagem_saida_status_idx ON public.solicitacao_viagem USING btree (data_hora_saida, status, id)`.
- `CREATE INDEX solicitacao_viagem_veiculo_reserva_idx ON public.solicitacao_viagem USING btree (veiculo_id, data_hora_saida) INCLUDE (data_hora_retorno_previsto) WHERE (status = ANY (ARRAY['AGENDADA'::status_solicitacao, 'PRONTA_PARA_INICIAR'::status_solicitacao, 'EM_ANDAMENTO'::status_solicitacao]))`.

## usuario

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('usuario_id_seq'::regclass)` |
| `nome` | `character varying(150)` | Não | — |
| `email` | `character varying(150)` | Não | — |
| `senha_hash` | `character varying(255)` | Não | — |
| `perfil` | `perfil_usuario` | Não | `'SOLICITANTE_INTERNO'::perfil_usuario` |
| `ativo` | `boolean` | Sim | `true` |
| `criado_em` | `timestamp without time zone` | Sim | `CURRENT_TIMESTAMP` |

Constraints:

- `usuario_email_key`: `UNIQUE (email)`; validada: sim.
- `usuario_pkey`: `PRIMARY KEY (id)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX usuario_email_key ON public.usuario USING btree (email)`.
- `CREATE UNIQUE INDEX usuario_pkey ON public.usuario USING btree (id)`.

## veiculo

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('veiculo_id_seq'::regclass)` |
| `placa` | `character varying(10)` | Não | — |
| `modelo` | `character varying(100)` | Não | — |
| `marca` | `character varying(100)` | Não | — |
| `ano` | `integer` | Não | — |
| `tipo` | `tipo_veiculo` | Não | — |
| `capacidade_obitos` | `integer` | Sim | `0` |
| `quilometragem_atual` | `integer` | Sim | `0` |
| `status` | `status_veiculo` | Sim | `'DISPONIVEL'::status_veiculo` |
| `is_svo` | `boolean` | Sim | `false` |
| `criado_em` | `timestamp without time zone` | Sim | `CURRENT_TIMESTAMP` |
| `capacidade_passageiros` | `integer` | Sim | `5` |
| `vinculo` | `character varying(10)` | Não | `'PROPRIO'::character varying` |
| `fornecedor_locacao` | `character varying(255)` | Sim | — |

Constraints:

- `veiculo_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `veiculo_placa_key`: `UNIQUE (placa)`; validada: sim.
- `veiculo_vinculo_check`: `CHECK (vinculo::text = ANY (ARRAY['PROPRIO'::character varying, 'LOCADO'::character varying]::text[]))`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX veiculo_pkey ON public.veiculo USING btree (id)`.
- `CREATE UNIQUE INDEX veiculo_placa_key ON public.veiculo USING btree (placa)`.

## viagem

RLS: desabilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('viagem_id_seq'::regclass)` |
| `solicitacao_id` | `bigint` | Sim | — |
| `veiculo_id` | `bigint` | Sim | — |
| `motorista_id` | `bigint` | Sim | — |
| `km_inicial` | `integer` | Sim | — |
| `km_final` | `integer` | Sim | — |
| `foto_odometro_inicio` | `character varying(255)` | Sim | — |
| `foto_odometro_fim` | `character varying(255)` | Sim | — |
| `data_inicio` | `timestamp without time zone` | Sim | — |
| `data_fim` | `timestamp without time zone` | Sim | — |
| `validada_por_gestor` | `boolean` | Sim | `false` |
| `status` | `status_viagem` | Sim | `'AGENDADA'::status_viagem` |
| `criado_em` | `timestamp with time zone` | Sim | `clock_timestamp()` |
| `validada_por_id` | `bigint` | Sim | — |
| `validada_em` | `timestamp with time zone` | Sim | — |

Constraints:

- `viagem_dados_obrigatorios_check`: `CHECK (solicitacao_id IS NOT NULL AND veiculo_id IS NOT NULL AND motorista_id IS NOT NULL AND status IS NOT NULL) NOT VALID`; validada: não.
- `viagem_execucao_status_check`: `CHECK ((status IS DISTINCT FROM 'EM_TRANSPORTE'::status_viagem OR data_inicio IS NOT NULL AND km_inicial IS NOT NULL) AND (status IS DISTINCT FROM 'CONCLUIDA'::status_viagem OR data_inicio IS NOT NULL AND km_inicial IS NOT NULL AND data_fim IS NOT NULL AND km_final IS NOT NULL)) NOT VALID`; validada: não.
- `viagem_km_final_check`: `CHECK (km_final IS NULL OR km_inicial IS NOT NULL AND km_final >= km_inicial) NOT VALID`; validada: não.
- `viagem_km_inicial_check`: `CHECK (km_inicial IS NULL OR km_inicial >= 0) NOT VALID`; validada: não.
- `viagem_motorista_id_fkey`: `FOREIGN KEY (motorista_id) REFERENCES motorista(id)`; validada: sim.
- `viagem_periodo_check`: `CHECK (data_fim IS NULL OR data_inicio IS NOT NULL AND data_fim >= data_inicio) NOT VALID`; validada: não.
- `viagem_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `viagem_solicitacao_id_fkey`: `FOREIGN KEY (solicitacao_id) REFERENCES solicitacao_viagem(id)`; validada: sim.
- `viagem_solicitacao_id_key`: `UNIQUE (solicitacao_id)`; validada: sim.
- `viagem_validacao_check`: `CHECK (validada_por_gestor IS NOT TRUE AND validada_por_id IS NULL AND validada_em IS NULL OR validada_por_gestor IS TRUE AND validada_por_id IS NOT NULL AND validada_em IS NOT NULL AND NOT status IS DISTINCT FROM 'CONCLUIDA'::status_viagem) NOT VALID`; validada: não.
- `viagem_validada_por_fk`: `FOREIGN KEY (validada_por_id) REFERENCES usuario(id)`; validada: sim.
- `viagem_veiculo_id_fkey`: `FOREIGN KEY (veiculo_id) REFERENCES veiculo(id)`; validada: sim.

Índices:

- `CREATE INDEX viagem_motorista_status_idx ON public.viagem USING btree (motorista_id, status, data_inicio DESC)`.
- `CREATE UNIQUE INDEX viagem_pkey ON public.viagem USING btree (id)`.
- `CREATE UNIQUE INDEX viagem_solicitacao_id_key ON public.viagem USING btree (solicitacao_id)`.
- `CREATE INDEX viagem_status_periodo_idx ON public.viagem USING btree (status, data_inicio DESC)`.

## viagem_correcao

RLS: habilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('viagem_correcao_id_seq'::regclass)` |
| `viagem_id` | `bigint` | Não | — |
| `versao` | `integer` | Não | — |
| `km_inicial_anterior` | `integer` | Sim | — |
| `km_final_anterior` | `integer` | Sim | — |
| `km_inicial` | `integer` | Sim | — |
| `km_final` | `integer` | Sim | — |
| `justificativa` | `text` | Não | — |
| `autor_id` | `bigint` | Não | — |
| `criado_em` | `timestamp with time zone` | Não | `clock_timestamp()` |

Constraints:

- `viagem_correcao_autor_fk`: `FOREIGN KEY (autor_id) REFERENCES usuario(id)`; validada: sim.
- `viagem_correcao_justificativa_check`: `CHECK (char_length(btrim(justificativa)) >= 1 AND char_length(btrim(justificativa)) <= 2000)`; validada: sim.
- `viagem_correcao_km_check`: `CHECK ((km_inicial IS NULL OR km_inicial >= 0) AND (km_final IS NULL OR km_inicial IS NOT NULL AND km_final >= km_inicial))`; validada: sim.
- `viagem_correcao_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `viagem_correcao_versao_check`: `CHECK (versao >= 1)`; validada: sim.
- `viagem_correcao_versao_key`: `UNIQUE (viagem_id, versao)`; validada: sim.
- `viagem_correcao_viagem_fk`: `FOREIGN KEY (viagem_id) REFERENCES viagem(id)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX viagem_correcao_pkey ON public.viagem_correcao USING btree (id)`.
- `CREATE UNIQUE INDEX viagem_correcao_versao_key ON public.viagem_correcao USING btree (viagem_id, versao)`.

## viagem_evidencia

RLS: habilitada; FORCE RLS: não.

| Coluna | Tipo | Aceita NULL | Default |
| --- | --- | --- | --- |
| `id` | `bigint` | Não | `nextval('viagem_evidencia_id_seq'::regclass)` |
| `viagem_id` | `bigint` | Não | — |
| `momento` | `text` | Não | — |
| `versao` | `integer` | Não | — |
| `nome` | `text` | Não | — |
| `tipo` | `text` | Não | — |
| `dados` | `bytea` | Não | — |
| `enviado_por_id` | `bigint` | Não | — |
| `criado_em` | `timestamp with time zone` | Não | `clock_timestamp()` |

Constraints:

- `viagem_evidencia_autor_fk`: `FOREIGN KEY (enviado_por_id) REFERENCES usuario(id)`; validada: sim.
- `viagem_evidencia_momento_check`: `CHECK (momento = ANY (ARRAY['INICIAL'::text, 'FINAL'::text]))`; validada: sim.
- `viagem_evidencia_nome_check`: `CHECK (char_length(nome) >= 1 AND char_length(nome) <= 255)`; validada: sim.
- `viagem_evidencia_pkey`: `PRIMARY KEY (id)`; validada: sim.
- `viagem_evidencia_tamanho_check`: `CHECK (octet_length(dados) >= 1 AND octet_length(dados) <= 1048576)`; validada: sim.
- `viagem_evidencia_tipo_check`: `CHECK (tipo = ANY (ARRAY['image/jpeg'::text, 'image/png'::text]))`; validada: sim.
- `viagem_evidencia_versao_check`: `CHECK (versao >= 1)`; validada: sim.
- `viagem_evidencia_versao_key`: `UNIQUE (viagem_id, momento, versao)`; validada: sim.
- `viagem_evidencia_viagem_fk`: `FOREIGN KEY (viagem_id) REFERENCES viagem(id)`; validada: sim.

Índices:

- `CREATE UNIQUE INDEX viagem_evidencia_pkey ON public.viagem_evidencia USING btree (id)`.
- `CREATE UNIQUE INDEX viagem_evidencia_versao_key ON public.viagem_evidencia USING btree (viagem_id, momento, versao)`.
