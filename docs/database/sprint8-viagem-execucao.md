# DB-S8-01 — Viagem operacional, quilometragem, evidências e notificações

SCRUM-166 · Sprint 8 (06–12/11/2026) · Épico 04 — Execução e Acompanhamento de
Viagens · BL15–BL21 (BL15–BL20 Must, BL21 Should) · Pareamento
DB-S8-01 ↔ BE-S8-01 ↔ FE-S8-01.

Esta entrega é a parte **DB**: modelo persistente e auditável, migration,
reversão condicionada, preflight, provas reais em PostgreSQL isolado e
documentação. Endpoints, OpenAPI e telas pertencem a BE-S8-01/FE-S8-01; nenhum
contrato HTTP, cliente gerado ou tela foi alterado aqui.

## Perfis afetados

Parte da **execução de viagens** (Épico 04). Não envolve SVO.

| Perfil | O que o modelo passa a guardar |
| --- | --- |
| MOTORISTA | Início e fim da viagem, km inicial/final, fotos do odômetro e avisos de atribuição e lembrete |
| GESTOR_FROTA e ADM | Validação final da viagem (autor e instante) e correções com justificativa |
| SOLICITANTE | Nada novo: a solicitação continua sendo a origem 1:1 da viagem |

Arquivos da entrega:

- Migration: [20261109200000_db_s8_01_viagem_execucao.sql](../../backend/src/database/supabase/migrations/20261109200000_db_s8_01_viagem_execucao.sql)
- Reversão manual: [rollback/20261109200000_db_s8_01_viagem_execucao.down.sql](../../backend/src/database/rollback/20261109200000_db_s8_01_viagem_execucao.down.sql)
- Preflight somente leitura: [inspect-db-s8-01.sql](../../backend/src/database/scripts/inspect-db-s8-01.sql)
- Provas reais: [viagem-execucao.test.ts](../../backend/tests/database/viagem-execucao.test.ts)
- Snapshot regenerado: [schema.sql](./schema.sql), [schema-metadata.json](./schema-metadata.json), [der.mmd](./der.mmd); [dicionário](./dicionario.md#sprint-8--db-s8-01-scrum-166)

## Requisitos de referência

Requisitos citados pela tarefa, da Documentação Complementar (não versionada neste
repositório): RF13, RF14, RF28–RF38, RF49, RF50; RN01, RN03, RN05, RN09, RN10,
RN11, RN12, RN13; RNF05, RNF06, RNF08–RNF11, RNF14–RNF19. RNF12 e RNF13 não estão
definidos na Documentação Complementar recebida e não foram presumidos.

O [documento de requisitos versionado](../../documentação.md) usa numeração própria:
nele os temas desta entrega aparecem como RF37–RF46 (viagens), RF59–RF62
(evidências), RF63–RF64 (notificações) e RN04, RN09–RN11. Não se reproduz o
mapeamento inconsistente do quadro de backlog nem se renumera requisito. Os textos
integrais de BL15–BL21 não constam da descrição recebida: a tabela TO-BE abaixo
rastreia por tema e cada subtarefa deve indicar a BL correspondente.

## 1. Auditoria AS-IS (main de 09/11/2026)

Fontes: migrations versionadas, snapshot `schema.sql`/`schema-metadata.json`/`der.mmd`
e código do backend. Sem MCP e sem acesso ao banco compartilhado.

| Objeto | Estado encontrado | Lacuna para o Épico 04 |
| --- | --- | --- |
| `viagem` | `solicitacao_id` com UNIQUE (`viagem_solicitacao_id_key`) e FK para `solicitacao_viagem`; `veiculo_id`/`motorista_id` com FK NO ACTION; `km_inicial`/`km_final` integer; `foto_odometro_inicio`/`_fim` varchar(255); `data_inicio`/`data_fim` timestamp sem fuso; `validada_por_gestor` boolean default false; `status status_viagem` default AGENDADA. Todas as colunas anuláveis, nenhum CHECK. | Sem instante de criação, sem autor/instante da validação, sem regra de km/período/estado, recursos opcionais. Nenhum código do backend lê ou grava esta tabela. Grants amplos para anon/authenticated e RLS desligada (baseline auditada). |
| `status_viagem` | AGENDADA, EM_TRANSPORTE, CONCLUIDA, CANCELADA. | Rótulos diferentes dos status documentados de solicitação; ver seção 4. |
| `solicitacao_viagem` | `codigo` UNIQUE (TRP-id); status com APROVADA/AGENDADA/PRONTA_PARA_INICIAR/EM_ANDAMENTO/CONCLUIDA; recursos atribuídos no agendamento (FK SET NULL); índices de reserva. | Execução fica para o Épico 04 (decisão da Sprint 7). |
| `veiculo` | `quilometragem_atual` integer default 0. | Atualização a partir da viagem é regra do BE. |
| `motorista` | `usuario_id` UNIQUE e opcional. | Motorista sem conta não recebe aviso in-app. |
| `log_atividade` | FK `solicitacao_viagem_id`; sem vínculo com viagem. | Eventos de execução podem usar o vínculo da solicitação (1:1). |
| `notificacao` | Caixa individual com `usuario_id`, `chave` UNIQUE por usuário, `categoria`, `criado_em`, `lida_em`; RLS ligada e sem grants públicos. | Sem demanda vinculada e sem tipo do aviso. |
| Arquivos | `documento_veiculo.arquivo_dados` bytea em tabela com grants amplos (legado); `abastecimento_comprovante` bytea em tabela protegida (padrão mais recente). | Armazenamento externo não decidido ([decisões](../decisions.md)). Fotos da viagem não existem. |
| Snapshot | Não incluía `20261109000000` (comprovante) nem `20261109100000` (notificações). | Regenerado nesta entrega; ver seção 11. |

## 2. TO-BE por tema (BL15–BL21)

| Tema | Referência | AS-IS | TO-BE desta entrega | Depende de |
| --- | --- | --- | --- | --- |
| Viagem operacional 1:1 a partir da solicitação aprovada | RN01, RN03 | UNIQUE em `solicitacao_id`, mas anulável; recursos opcionais | `viagem_dados_obrigatorios_check` (solicitação, veículo, motorista e status) e `criado_em` | BE cria a viagem na transação do agendamento |
| Quilometragem inicial/final | RN09 | Sem regras | `km_inicial ≥ 0`, `km_final ≥ km_inicial`, km/data exigidos por estado | BE compara com `veiculo.quilometragem_atual` |
| Evidência fotográfica inicial/final | RN10 | varchar(255) sem uso | `viagem_evidencia` protegida, versionada, sem bytes na `viagem` | BE upload/download autorizado |
| Validação final do Gestor | RN11 | boolean sem autor | `validada_por_id`, `validada_em` e `viagem_validacao_check` | BE restringe a ADM/GESTOR_FROTA |
| Correção/justificativa | RF46 (doc. versionado) | Inexistente | `viagem_correcao` versionada, append-only, com autor | BE grava correção e viagem na mesma transação |
| Aviso ao motorista (atribuição, leitura, lembrete) | RF64 (doc. versionado) | Aviso genérico | `notificacao.tipo` e `notificacao.viagem_id` com chave estável | BE; lembrete aguarda regra confirmada |
| Consultas por motorista/status/período | RNF02 | Sem índice | `viagem_motorista_status_idx`, `viagem_status_periodo_idx`, `notificacao_viagem_idx` | — |
| Integridade e concorrência | RNF17–RNF19, RNF23 | Só UNIQUE | Constraints com provas reais (seção 11) | — |

## 3. Correspondência solicitação aprovada → viagem

- **1:1**: `viagem_solicitacao_id_key` impede duas viagens para a mesma solicitação.
  Para novas linhas, `solicitacao_id` é obrigatório (CHECK NOT VALID). Duas
  requisições simultâneas resultam em uma viagem; a segunda recebe `23505`, que o
  BE deve responder como `409`.
- **Protocolo único**: é o `solicitacao_viagem.codigo` (UNIQUE, `TRP-id`,
  apresentado como `#TRP-id`), alcançado pela FK 1:1. Não se cria código paralelo
  na viagem, evitando dois identificadores divergentes para a mesma demanda.
- **Recurso obrigatório**: veículo e motorista são obrigatórios na viagem nova.
  Proposta para BE-S8-01: criar a viagem quando a solicitação recebe recursos
  (APROVADA → AGENDADA), na mesma transação e na ordem de locks já usada no
  agendamento, copiando `veiculo_id`/`motorista_id`; o reagendamento atualiza os
  recursos da viagem enquanto ela estiver AGENDADA. O banco não consulta outra
  tabela em CHECK: verificar estado AGENDADA e igualdade de recursos é regra do BE,
  com `SELECT … FOR UPDATE` na solicitação. O preflight mede divergências legadas.
- **Datas**: `criado_em` (timestamptz, `clock_timestamp()`) registra a criação.
  Linhas anteriores à migration permanecem NULL. `data_inicio`/`data_fim` seguem
  timestamp sem fuso (D4 pendente): o BE deve normalizar para America/Maceio como
  em solicitações.
- **Origem, destino, finalidade e passageiros** continuam na solicitação, sem
  duplicação na viagem; as consultas usam o JOIN 1:1.

## 4. Conciliação de status (sem renomear o histórico)

O enum técnico `status_viagem` é preservado. Não há ALTER TYPE, rename nem
reclassificação de linhas.

| `status_viagem` (técnico) | `status_solicitacao` correspondente | Status documentado (RF19/RF42) |
| --- | --- | --- |
| AGENDADA | AGENDADA e PRONTA_PARA_INICIAR | agendada |
| EM_TRANSPORTE | EM_ANDAMENTO | em andamento |
| CONCLUIDA | CONCLUIDA | concluída |
| CANCELADA | — (sem cancelamento de solicitação, por decisão da Sprint 7) | cancelada |

- EM_TRANSPORTE é o rótulo técnico de "em andamento"; o texto em pt-BR fica no FE.
- PRONTA_PARA_INICIAR é estado só da solicitação.
- Validação do Gestor é atributo (`validada_por_gestor`, `validada_por_id`,
  `validada_em`), não estado novo.
- Nenhuma transição para CANCELADA é definida aqui: depende de decisão.

Matriz proposta para BE-S8-01. O banco garante os dados mínimos; perfil, origem do
estado e repetição (`409`) são regras do BE.

| De | Para | Dados exigidos pelo banco | Perfil (BE) |
| --- | --- | --- | --- |
| — | AGENDADA | solicitação, veículo, motorista, status | ADM/GESTOR_FROTA (no agendamento) |
| AGENDADA | EM_TRANSPORTE | `data_inicio`, `km_inicial ≥ 0` | MOTORISTA atribuído |
| EM_TRANSPORTE | CONCLUIDA | `data_fim ≥ data_inicio`, `km_final ≥ km_inicial` | MOTORISTA atribuído |
| CONCLUIDA não validada | CONCLUIDA validada | `validada_por_id`, `validada_em` | ADM/GESTOR_FROTA |

Correções justificadas são permitidas mesmo após a validação, preservando o histórico e as evidências.

## 5. Campos e constraints

Colunas novas em `viagem`: `criado_em timestamptz` (default só para novas),
`validada_por_id bigint` (FK `usuario`), `validada_em timestamptz`.

| Constraint | Regra | Código PostgreSQL → resposta sugerida ao BE |
| --- | --- | --- |
| `viagem_dados_obrigatorios_check` | solicitação, veículo, motorista e status não nulos | 23514 → 400 |
| `viagem_km_inicial_check` | `km_inicial` nulo ou ≥ 0 | 23514 → 400 |
| `viagem_km_final_check` | `km_final` nulo ou com `km_inicial` e ≥ `km_inicial` | 23514 → 400 |
| `viagem_periodo_check` | `data_fim` nula ou com `data_inicio` e ≥ `data_inicio` | 23514 → 400 |
| `viagem_execucao_status_check` | EM_TRANSPORTE exige início/km inicial; CONCLUIDA exige início, fim e os dois km | 23514 → 409 |
| `viagem_validacao_check` | validada ⇔ autor e instante preenchidos, e só em CONCLUIDA | 23514 → 409 |
| `viagem_validada_por_fk` | autor da validação existe | 23503 → 400 |
| `viagem_solicitacao_id_key` (existente) | uma viagem por solicitação | 23505 → 409 |

As seis CHECKs de `viagem` são **NOT VALID**: valem para toda inserção e alteração
desde a migration, mas não reprovam nem reescrevem linhas antigas. Uma linha
antiga incoerente só volta a ser gravada depois de corrigida. `VALIDATE CONSTRAINT`
fica para depois do preflight sem divergências (seção 10). As FKs/CHECKs das
tabelas novas e de `notificacao` são validadas: não há dado antigo a reprovar.

## 6. Evidências fotográficas

`viagem_evidencia`: `viagem_id`, `momento` (INICIAL/FINAL), `versao` (≥ 1, única
por viagem e momento), `nome` (1–255), `tipo` (image/jpeg, image/png), `dados`
bytea (1 B a 1 MiB, mesmo limite do comprovante de abastecimento),
`enviado_por_id` e `criado_em`. Substituir uma foto cria nova versão; a anterior
fica como histórico. A FK sem cascade impede apagar uma viagem com evidências.

As colunas legadas `foto_odometro_inicio`/`_fim` não foram removidas nem
reaproveitadas; novas gravações devem usar a tabela protegida.

Acesso seguro planejado para BE-S8-01:

- Bytes nunca ficam na `viagem`, que mantém os grants amplos da baseline.
- RLS ligada sem policies e sem grants para anon/authenticated: somente o backend lê.
- Histórico append-only: UPDATE, DELETE e TRUNCATE revogados de `postgres` e
  `service_role`. O dono da tabela ainda pode reconceder; isso não substitui a
  confirmação do papel runtime remoto ([segurança](../seguranca.md)).
- Download somente para o motorista atribuído e ADM/GESTOR_FROTA, com tipo da
  coluna, `Content-Disposition: attachment` e `X-Content-Type-Options: nosniff`.
  Bytes fora de listagens e logs. Corpo limitado antes da decodificação, como em
  abastecimentos.
- Política de retenção de fotos continua pendente (documento de requisitos §13).

## 7. Correção e justificativa versionadas

`viagem_correcao`: `viagem_id`, `versao` (≥ 1, única por viagem),
`km_inicial_anterior`, `km_final_anterior`, `km_inicial`, `km_final` (valores
resultantes, mesma regra de km), `justificativa` (1–2000 caracteres sem contar
espaços nas pontas), `autor_id` e `criado_em`. O BE grava a correção e atualiza a
viagem na mesma transação, com `versao = max + 1` sob lock da viagem. Duas
correções simultâneas na mesma versão: uma confirma e a outra recebe `23505`.
Mesma proteção da tabela de evidências: RLS, sem grants públicos, append-only.

## 8. Notificações ao motorista

A tabela `notificacao` existente já tem destinatário (`usuario_id`), instante
(`criado_em`) e leitura (`lida_em`). Foram acrescentados:

- `tipo` text: ATRIBUICAO ou LEMBRETE (NULL nos avisos existentes e genéricos).
- `viagem_id` bigint com FK para `viagem` (demanda).
- `notificacao_demanda_check`: aviso tipado exige demanda e chave no formato
  `viagem:<viagem_id>:<tipo em minúsculas>:<sufixo>`.

Com o UNIQUE existente `(usuario_id, chave)` e `ON CONFLICT DO NOTHING`:

- **Atribuição**: chave `viagem:<id>:atribuicao:<motorista_id>`. Nunca duplica para
  o mesmo motorista; uma reatribuição para outro motorista gera um novo aviso.
- **Lembrete**: chave `viagem:<id>:lembrete:<início da janela ISO>`. Repetição na
  mesma janela não duplica; janela nova gera um aviso novo.
- **Leitura**: `lida_em` preserva a primeira confirmação (contrato atual).

O destinatário é `motorista.usuario_id` de conta ativa; motorista sem conta não
recebe aviso. O aviso de atribuição confirma ou reverte com a operação, como os
avisos atuais. A janela temporal dos lembretes não está confirmada: não foi criado
scheduler, trigger nem regra de envio.

## 9. Índices e medição

| Índice | Consulta atendida |
| --- | --- |
| `viagem_motorista_status_idx (motorista_id, status, data_inicio DESC)` | Viagens do motorista por estado (minhas viagens ativas) |
| `viagem_status_periodo_idx (status, data_inicio DESC)` | Viagens por estado e período de execução; fila de validação |
| `notificacao_viagem_idx (viagem_id) WHERE viagem_id IS NOT NULL` | Verificação da FK e avisos de uma demanda |

O período agendado continua atendido pelos índices de `solicitacao_viagem`
(`data_hora_saida`). Medição ad hoc em transação revertida no PostgreSQL 17.11
isolado, com 60.000 viagens sintéticas, 50 motoristas e ~2% delas ativas
(`EXPLAIN ANALYZE, BUFFERS`):

| Consulta | Com índice | Sem índice |
| --- | --- | --- |
| Motorista + AGENDADA/EM_TRANSPORTE, ordem por início, LIMIT 20 | Bitmap Index Scan, 9 buffers | Seq Scan, 895 buffers |
| CONCLUIDA em uma semana (count) | Bitmap Index Scan, 26 buffers | Seq Scan, 895 buffers |
| CONCLUIDA não validada, ordem por início, LIMIT 50 | Index Scan, 11 buffers | Seq Scan + sort, 895 buffers |

Os números orientam a escolha e não substituem a medição em base populada.

## 10. Migration, preflight, rollout e reversão

- Migration aditiva, em uma transação, com `lock_timeout` 5 s e
  `statement_timeout` 60 s. Nenhuma migration anterior ou hash foi alterado.
- Os CHECKs NOT VALID não percorrem a tabela. Os CREATE INDEX são comuns: em base
  populada, avaliar CONCURRENTLY fora do runner, como em
  [sprint7-indices](./sprint7-indices.md).
- **Preflight** ([inspect-db-s8-01.sql](../../backend/src/database/scripts/inspect-db-s8-01.sql)),
  somente leitura, antes e depois: contagens de viagens legadas que violariam cada
  regra, associações com solicitação não agendada ou recursos divergentes, estado
  das constraints e proteção das tabelas. Não exporta dados pessoais.
- **VALIDATE**: depois que o preflight zerar as contagens de `viagens_legadas`,
  executar `ALTER TABLE public.viagem VALIDATE CONSTRAINT <nome>` em migration
  própria e autorizada.
- **Reversão** ([down](../../backend/src/database/rollback/20261109200000_db_s8_01_viagem_execucao.down.sql)):
  fora de `supabase/migrations`, manual, em transação única. Recusa (`P0001`) se
  já houver evidência, correção, validação com autor ou aviso vinculado à viagem.
  Sem esses dados, remove somente os objetos desta migration. Única perda aceita:
  `viagem.criado_em`, inexistente no esquema anterior. Revert de código não
  reverte o banco.
- Banco compartilhado: nada foi aplicado. Rollout remoto exige autorização própria,
  preflight e reconciliação do histórico, como na Sprint 7.

## 11. Provas executadas — 09/11/2026

Ambiente: PostgreSQL 17.11 isolado em container com a identidade exigida pelo
harness (projeto `fsph-t1-isolated-2026`, banco `fsph_t1_baseline`, porta 55432,
manifesto e marcador). As imagens da Supabase CLI não puderam ser baixadas no
ambiente de execução, por bloqueio de rede. Os papéis `postgres`,
`supabase_admin`, `anon`, `authenticated` e `service_role` foram criados para
reproduzir a CLI. Antes de qualquer mudança, esse banco aplicou as migrations até
`20261105000000` e `db:docs:check` passou **sem drift** contra o snapshot
versionado. Repetir a prova com `npm run db:test:start` oficial antes do aceite.

- `db:test:prepare` em banco recriado do zero: 10 migrations + seed aplicados.
  As fixtures existentes de `viagem` satisfazem as novas regras. A repetição é
  idempotente.
- `db:docs:generate` gerou o snapshot com 14 tabelas, 146 colunas, 8 enums,
  77 constraints e 39 índices. A diferença é só aditiva: nada anterior foi removido.
  Ela inclui as duas migrations de 09/11 que estavam pendentes de regeneração.
  `db:docs:check` passou.
- `viagem-execucao.test.ts`: **14 testes reais passaram** (repetidos 3×). Cobrem:
  - catálogo e proteção (RLS, grants e append-only);
  - ciclo completo;
  - km final < inicial, negativo ou sem inicial (`23514`);
  - período e estado incoerentes, validação sem autor ou fora de CONCLUIDA (`23514`);
  - associação inválida: recurso inexistente (`23503`) ou ausente (`23514`),
    evidência órfã, autor inexistente, aviso sem demanda ou com chave de outra viagem;
  - formato, tamanho, momento e versão da evidência;
  - justificativa vazia;
  - UPDATE/DELETE e acesso anon/authenticated (`42501`);
  - geração duplicada (`23505`);
  - **duas requisições simultâneas** de viagem e de correção, com bloqueio real
    comprovado em `pg_stat_activity`: uma confirma e a outra recebe `23505`;
  - lembrete sem duplicidade na janela;
  - preflight READ ONLY;
  - convivência com dados legados divergentes: a migration aplica e o
    VALIDATE falha;
  - reversão recusada com dados novos, restauração exata sem eles e reaplicação.
- `test:db`: 79 de 80 passaram. A falha restante já existia na main:
  `seed.test` exige coluna `id` em toda tabela, mas `abastecimento_comprovante`
  (20261109000000) não tem.
- `npm run lint`, `npm run typecheck`, `npm run build`, `api:check` e
  `client:check` passaram.
- `npm test`: 686 passaram e 13 falharam. São exatamente as mesmas 13 falhas
  registradas na main antes desta entrega: `solicitacoes.detalhes` (7),
  `solicitacoes.agenda` (1), `abastecimentos` (2), `seed` (1) e `schema` (2).
  As duas de `schema` só aparecem quando `abastecimentos.test.ts` roda antes e
  deixa o trigger `test_falha_comprovante`; sem esse resíduo, `schema.test.ts` passa.
- E2E não executado: não há tela, rota ou fluxo alterado nesta tarefa DB.
- Única alteração em teste existente: a asserção de RLS de `schema.test.ts` passou
  a listar as quatro tabelas protegidas. Antes ela só aceitava `notificacao` e já
  falhava com `abastecimento_comprovante`.

### 11.1 CI oficial e revisão — 11/11/2026

O CI do PR #60 rodou no harness oficial da Supabase CLI. Passaram
`db:test:start`, `db:test:prepare`, `db:docs:check` (sem drift), `api:check`,
`client:check`, `lint`, `typecheck` e os 14 testes de `viagem-execucao.test.ts`.
Parou em `test:db` só por causa do `seed.test` já quebrado na main.

Com a liberação do líder para ajustar módulos e testes, a branch foi sincronizada
com a main (PR #51, sem conflito) e as falhas preexistentes foram corrigidas:

- `seed.test.ts`: usa a PK de cada tabela e dispensa fixtures das quatro tabelas
  protegidas, sem dados de exemplo no seed.
- `solicitacoes.detalhes` e `solicitacoes.agenda`: os mocks não previam as
  consultas de notificação feitas depois do log de atividade.
- **Bug real em abastecimentos**: o comprovante era enviado ao driver como texto
  `'\x…'` e gravado literalmente. Um PNG de 11 bytes virava 24 bytes de texto, e o
  download devolvia arquivo corrompido. Agora os bytes vão como `Buffer`.
  Comprovantes já gravados no banco remoto continuam corrompidos e exigem reparo
  autorizado.
- `abastecimentos.test.ts`: o gatilho de ensaio passou a ser criado pela conexão
  administrativa (dona da tabela) e sempre é removido. Antes ele ficava no banco e
  derrubava o `schema.test`.

Resultado local em banco recriado do zero, na ordem do CI:

| Etapa | Resultado |
| --- | --- |
| `db:test:prepare`, `db:docs:check`, `api:check`, `client:check`, `lint`, `typecheck` | passaram |
| `test:db` | 80 de 80 |
| `npm test` | 743 de 743 |
| `build` | passou |
| `test:e2e` | 116 passaram e 33 falharam |

As 33 falhas de E2E vêm de telas como dashboard e perfil do gestor, veículos,
calendário, solicitações do gestor, auth skeleton e abastecimentos. Na main pura,
o mesmo ambiente falha em 37; as 33 da branch estão entre elas. São testes de
tela desatualizados em relação a mudanças recentes de interface, sem relação com
esta tarefa. O E2E local usou o Chrome do sistema, porque o download do Chromium
do Playwright é bloqueado aqui.

## 12. Limites e pendências

- O backend não lê nem grava a viagem nesta entrega. Endpoints, OpenAPI, erros
  400/401/403/404/409, telas e E2E 390/768/1280 são de BE-S8-01/FE-S8-01.
- Não foram decididas: janela e regras de lembrete, transição para CANCELADA,
  correção após validação, retenção de fotos, armazenamento externo de arquivos e
  fuso histórico (D4).
- O vínculo `log_atividade` ↔ viagem não foi criado: eventos de execução podem
  usar `solicitacao_viagem_id` pela correspondência 1:1. Se a auditoria precisar da
  viagem, isso exige tarefa própria.
- Grants amplos e RLS desligada da `viagem` (baseline) foram preservados; a
  proteção da Data API continua dependente de [segurança](../seguranca.md) (D2).
- Em abastecimentos, só houve a correção do bug de gravação do comprovante e do
  teste de gatilho (seção 11.1), com liberação do líder. A documentação dos Épicos
  05/07 não foi alterada.
- A migration não foi aplicada no Supabase remoto da equipe. A conta conectada
  nesta sessão não tem acesso a esse projeto. Aplicar exige autorização e o
  preflight antes.
- Os 33 testes E2E de telas já falhando na main ficam para os responsáveis por
  essas telas.
