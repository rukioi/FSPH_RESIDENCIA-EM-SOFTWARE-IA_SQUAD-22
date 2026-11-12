# Dicionário estrutural — T1 (#27)

A fonte verificável de colunas, tipos completos, defaults, nulabilidade, enums,
constraints e ACL/RLS é o arquivo gerado [schema-metadata.json](./schema-metadata.json).
O [schema.sql](./schema.sql) descreve o DDL e o [DER](./der.mmd) mostra chaves,
nullabilidade, unicidade e ações de exclusão. Não infira regra de negócio do nome.

| Tabela | Estrutura comprovada |
| --- | --- |
| usuario | Identidade, email único, hash, perfil obrigatório; ativo admite NULL. |
| motorista | CNH/CPF e usuario_id únicos; conta opcional e FK ON DELETE CASCADE. |
| veiculo | Placa única; tipo/status em enums; vínculo obrigatório com CHECK validado. |
| documento_veiculo | Vencimento date obrigatório; veículo e status_regular opcionais; bytes de arquivo. |
| abastecimento | Veículo, motorista, quilometragem e data obrigatórios; numeric(10,2) em litros/valor. |
| solicitacao_viagem | Código único, saída sem fuso, origem/destino; veículo/motorista com SET NULL. |
| viagem | Solicitação única opcional; km, horários sem fuso e status; FKs NO ACTION. |
| solicitacao_obito | Código único e dados de atendimento; não exportados como fixtures reais. |
| ordem_coleta | Solicitação de óbito única opcional, recursos, km e horários sem fuso. |
| log_atividade | id BIGINT PK; usuario_id BIGINT opcional; descricao TEXT obrigatória; data_hora TIMESTAMP sem fuso opcional, default CURRENT_TIMESTAMP. Duas FKs em usuario_id: uma SET NULL e outra NO ACTION, ambas preservadas. |

DEFAULT não implica NOT NULL. BIGINT permanece tipo do banco; esta tarefa não
define serialização HTTP. Colunas de hora são timestamp without time zone, sem
inferência de origem histórica. Campos date permanecem datas civis.

São pendentes, conforme D1–D4 (#23–#26): disponibilidade e alocação compartilhada;
papel do backend e proteção da Data API; revogação; semântica de status_regular;
obrigatoriedade de login de motorista; exclusão e histórico; limites numéricos e
tratamento de NULL/zero; fuso histórico e fronteiras temporais. T1 preserva o
estado auditado e não substitui essas respostas humanas.

Na #31, gravação/consulta foram centralizadas no módulo auditoria sem DDL ou mudança
de dados históricos. Novas mensagens usam evento fechado e ID, sem payload pessoal.
A transação responsável confirma/reverte alteração e atividade juntas. A consulta
ordena data_hora DESC NULLS LAST, id DESC; a paginação usa snapshot consistente.
Serialização HTTP mantém a interpretação legada do driver; não determina fuso de
origem nem converte timestamps históricos. Ver [contrato](../api/auditoria.md).

## Sprint 8 — DB-S8-01 (SCRUM-166)

Evolução aditiva de viagem operacional, quilometragem, evidências, validação,
correção e avisos ao motorista. Regras e provas em
[sprint8-viagem-execucao](./sprint8-viagem-execucao.md). Comprovantes e
notificações de 09/11 passaram a constar do snapshot regenerado.

| Tabela | Estrutura comprovada |
| --- | --- |
| viagem (colunas novas) | criado_em timestamptz anulável, com default clock_timestamp() só para linhas novas; validada_por_id BIGINT com FK usuario; validada_em timestamptz. Seis CHECKs NOT VALID: dados obrigatórios, km inicial ≥ 0, km final ≥ inicial, período, dados exigidos por status e validação coerente. Índices por motorista/status/início e status/início. |
| viagem_evidencia | Foto do odômetro INICIAL/FINAL por versão (UNIQUE viagem, momento, versão); bytea de 1 B a 1 MiB, image/jpeg ou image/png; autor e criado_em obrigatórios. RLS ligada, sem grants para anon/authenticated; UPDATE/DELETE/TRUNCATE revogados dos papéis de aplicação. |
| viagem_correcao | Correção/justificativa versionada (UNIQUE viagem, versão) com km anteriores e resultantes, justificativa de 1 a 2000 caracteres, autor e criado_em obrigatórios. Mesma proteção da evidência. |
| abastecimento_comprovante | Imagem do abastecimento (PK/FK abastecimento_id, ON DELETE CASCADE), bytea de 1 B a 1 MiB, image/jpeg ou image/png; RLS ligada, sem grants públicos (migration 20261109000000). |
| notificacao | Caixa individual (migration 20261109100000) com chave única por usuário, categoria, criado_em e lida_em timestamptz. DB-S8-01 acrescenta tipo (ATRIBUICAO/LEMBRETE) e viagem_id com FK; aviso tipado exige demanda e chave viagem:id:tipo:sufixo. |

Os timestamptz novos registram instantes do servidor. As colunas antigas de
viagem continuam timestamp sem fuso (D4), sem conversão do histórico.
