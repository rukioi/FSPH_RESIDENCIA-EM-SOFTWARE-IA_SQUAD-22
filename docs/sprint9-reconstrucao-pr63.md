# Reconstrução da entrega Sprint 9 / PR #63

## Estado atual — revisão pré-PR de 18/11/2026

O Supabase oficial é a referência desta entrega. A validação histórica já obtida confirmou
12/12 migrations aplicadas, nenhuma pendente/órfã e ausência da RF40 nullable
antiga. Motorista e quilometragem são NOT NULL, sem criado_por_id. Cadastro,
consultas, histórico, comprovante legado, auditoria e conflitos de odômetro
passaram no ambiente real. As diferenças conhecidas de RLS/ACL/CHECK não causaram
bloqueio funcional da SCRUM-180 e não são corrigidas nesta entrega.

O drift Docker relatado abaixo é **histórico**, não o bloqueio atual da história.
Nesta revisão não se cria Docker, não se acessa banco para novos testes e não se
altera schema, migration, RLS, grants ou owners. Permanecem registradas separadamente
a limpeza operacional dos dados de teste anteriores e a validação complementar
do upload compartilhado no Supabase, sem procedimento autorizado de limpeza.
Nenhum resultado de interface com resposta controlada é prova dessa persistência.

A integração foi incorporada por fast-forward até origin/main 908e2ce,
preservando o Dashboard de candidatos provisórios e a entrega de abastecimentos.
As correções pré-PR alinham motorista obrigatório, transporte FormData, validação
decimal mínima e isolamento de testes. A expectativa de motorista em /login era
obsoleta: destinoDoPerfil e seus testes definem /notificacoes para sessão válida;
o E2E continua verificando que conteúdo e consultas de Gestor não são liberados.

As seções de fechamento anteriores registram resultados e decisões de cada momento;
não substituem o relatório final da revisão atual nem autorizam commit/push/PR.

### Missão final SCRUM-180 — validação atual de 18/11/2026

Novo fetch confirmou HEAD e origin/main em `908e2ce`, sem commits divergentes
ou conflitos. Os 37 arquivos locais existentes foram copiados para backup e
conferidos por SHA-256 antes do trabalho. Esta rodada acrescenta somente uma
suíte unitária de comprovantes aos arquivos da entrega. Não modifica migrations,
RF40, telas do Gustavo nem a implementação de consumo da SCRUM-188.

**Correção nova:** a validação anterior aceitava km inteiro negativo quando não
havia leitura anterior. Três asserções falharam antes da correção (processo exit 1).
O schema de entrada agora exige inteiro não negativo e o controller reutiliza
essa validação antes da transação. Zero e igualdade continuam permitidos; o
confronto com a leitura anterior e viagem corrigida permanece. Contrato global,
tipos gerados, testes e documentação foram atualizados, sem alteração de schema
PostgreSQL. A rodada direcionada posterior passou 33/33, exit 0.

**Correções anteriores preservadas e revalidadas:** motorista obrigatório no
contrato e no controller; FormData transmitido sem serialização JSON/Content-Type
manual; rejeição de decimais positivos menores que `0.005`, que seriam zero em
NUMERIC(10,2); geração de API preservando também o Dashboard atual. Os testes
unitários que importavam indiretamente o pool usam uma sentinela que falha se
SQL for chamado; isso não substitui as suítes reais de integração.

**Validação executada nesta rodada:**

| Verificação | Resultado atual | Exit |
| --- | --- | --- |
| `npm run typecheck` (frontend, backend, scripts e testes) | Passou | 0 |
| `npm run lint` | Passou | 0 |
| `npm run build --workspace backend` | Passou | 0 |
| `npm run build --workspace frontend -- --config <config-local-sem-env>` | Passou; warning já existente de tamanho do chunk exceljs | 0 |
| `npm run api:generate` / `npm run client:generate` | Duas gerações idênticas dos quatro artefatos | 0 / 0 |
| `npm run api:check` / `npm run client:check` | Passaram | 0 / 0 |
| `npm test -- --config <config-local-sem-banco>` | 674/674, zero falhas e zero skips; 529 backend e 145 frontend, 58 arquivos | 0 |
| `npm run test:e2e -- --config <config-local-interface>` | 142/142, zero falhas, retries desativados | 0 |
| `npm run test:e2e -- --config <config-local-producao>` | 3/3, login/proteção em 390/768/1280 | 0 |
| `git diff --check` | Passou | 0 |

Os comandos usam Node 22.13, ambiente explícito sem dotenv e configurações locais
em `/tmp/fsph-missao180-20261118`, onde ficam logs, resultados JSON e traces.
Não são configurações de produção nem arquivos da entrega. A seleção Vitest
contém somente testes sem dependência de banco real. Não é a suíte completa
PostgreSQL. Os E2E de interface incluem respostas controladas e preview; não
são prova FE → API → PostgreSQL. Nenhuma escrita remota foi realizada.

A suíte nova de comprovantes passa 23/23: parser multipart real, boundary,
PDF/JPEG/PNG, assinatura, nome seguro, vínculo fixado pelo caminho, limite de
5 MiB, rejeição de 5 MiB + 1 byte, perfis, HTTP 401 sem sessão e streaming local
com bytes/headers privados. Não comprova FK, autorização por registro no banco,
persistência ou rollback. Sua primeira execução teve 1 timeout de comparação
profunda de Buffer de 5 MiB; a asserção usa agora comparação byte a byte nativa
(`Buffer.equals`) e tamanho exato, sem aumentar timeout ou afrouxar o teste.
A rodada direcionada final foi 56/56, exit 0, incluída nos 674 testes acima.

O caso intermitente `gestor consulta e edita solicitação em 768px` passou cinco
repetições na branch e cinco na main limpa, com a mesma configuração. Não houve
alteração para esconder o resultado anterior: a causa não foi reproduzida nem
atribuída à main. A rodada completa atual passou 142/142.

**Não executado / bloqueado por autorização de ambiente:** `db:docs:check`,
`test:db`, nove suítes de integração relacionadas a abastecimentos/anexos,
auditoria e correção de viagens, além dos nove E2E reais de abastecimentos.
A nova cobertura DB para km negativo está preparada, mas não foi executada.
O harness continua exigindo identidade isolada; não foi burlado. Sem autorização
para esse ambiente ou nova escrita remota, persistência/atomicidade e upload
compartilhado autenticado não foram comprovados nesta rodada. Evidência histórica
do Supabase não é apresentada como reexecução desses testes.

**Situação:** SCRUM-186 e SCRUM-187 implementadas e aprovadas nas verificações
executáveis, mas com aceite integrado atual pendente. SCRUM-180 permanece com
PR bloqueado por essa validação obrigatória. RF40 continua com Gabriel, intacta
e sem declaração de conclusão por este trabalho. A limpeza remota histórica é
pendência operacional separada, não uma funcionalidade DELETE exigida da história.
Próxima ação: responsável pelo ambiente e solicitante autorizarem o procedimento
de validação integrada/limpeza; executar as suítes reais sem alterar proteções.

### Integração formal com a main — 18/11/2026

Após novo fetch, a main permaneceu em `908e2ce`. O backup original foi conferido
(31/31 hashes), e uma nova cópia integral dos 43 arquivos locais e do índice foi
validada antes da operação. O procedimento foi ensaiado em checkout temporário:
preparação do índice com `git read-tree origin/main` (sem `-u`, sem reescrever
arquivos), seguida de `git merge --ff-only --no-commit origin/main`.

O mesmo fast-forward foi concluído na branch `feat/be-db-s9-abastecimentos-rebase-main`.
HEAD e origin/main agora apontam para `908e2ce`, 0 ahead / 0 behind. Nenhum commit
foi criado; índice vazio e nenhum arquivo em conflito. Todos os 621 arquivos
conferidos, incluindo os 43 arquivos locais, mantiveram os hashes durante a
integração. A solução de generate-api.ts mantém os contratos do Dashboard e de
abastecimentos; não houve reimplementação ou alteração de migration.

Depois da integração: typecheck completo, lint, builds frontend/backend,
api:generate/client:generate, api:check/client:check e 644/644 testes Vitest seguros
passaram. A segunda geração dos quatro artefatos permaneceu idêntica.

A rodada E2E de interface passou 141/142; produção passou 3/3. O cenário
`gestor consulta e edita solicitação em 768px` excedeu 5 segundos ao aguardar
`#TRP-1`. A repetição diagnóstica apenas da suíte do Gestor, com trace, passou
4/4 sem alterar código, timeout ou asserções. A causa da falha inicial não foi
comprovada; o resultado não é apresentado como uma rodada integral verde.

Nenhum teste com banco, Docker ou Supabase foi executado. A integração Git deixou
de ser bloqueio; permanecem a investigação dessa intermitência e as validações
de banco/E2E real que dependem de autorização. Nenhum commit, push ou PR nesta etapa.

### Resultado das correções pré-PR — ensaio anterior

- Checkout temporário sobre `908e2ce` + entrega corrigida: 644/644 testes Vitest
  seguros em 57 arquivos, 142/142 E2E de interface e 3/3 testes do build de produção.
  As telas verificadas cobrem 390/768/1280; os testes com resposta controlada não
  comprovam API/PostgreSQL real. Os nove E2E de abastecimentos e as suítes que
  escrevem no banco não foram reexecutados nesta rodada, conforme a restrição.
- Typecheck completo, lint, builds backend/frontend, api:check e client:check
  passaram. Uma segunda geração oficial produziu os mesmos quatro artefatos.
  O warning preexistente de tamanho do chunk exceljs permanece não bloqueante.
- Os dois testes unitários bloqueados por import indireto do pool foram isolados
  com sentinela que falha se SQL for chamado. O mesmo problema foi corrigido no
  teste unitário `dashboard-consolidado-falhas` vindo da main. A guarda real do
  banco permanece intacta; testes de integração não foram convertidos em mocks.
- Os arquivos integrados foram copiados para a branch original após conferir os
  hashes dos 31 arquivos anteriores. O backup completo foi preservado fora do Git.
  O conteúdo incorpora a evolução do Dashboard de `908e2ce`, sem refazer suas regras.
  HEAD permanece `6da75df` (0 ahead / 1 behind): não houve merge, alteração do índice,
  commit ou push. A incorporação formal da main no histórico ainda não foi feita.
  A simulação textual final ainda aponta conflito nos imports adjacentes de
  `scripts/generate-api.ts` ao mesclar a partir desse ancestral. A solução com
  ambos os contratos já foi aplicada e testada, mas ainda precisará ser registrada
  na integração Git autorizada. Não confundir o arquivo corrigido com merge concluído.
- Nenhuma migration, rollback, política RLS, grant, owner ou snapshot foi alterado.
  CI completo com banco não foi executado nem declarado aprovado nesta revisão.

## Referências preservadas

- Base fixa solicitada: `6da75dfbfc38bf2addb09c433b989c409d23d123` (`origin/main` na leitura).
- Branch nova: `feat/be-db-s9-abastecimentos-rebase-main`.
- Branch original preservada: `feat/be-db-s9-abastecimentos`, HEAD `41165dd5ca0819135521c4ff77dc0250acfddc9b`.
- Referência de segurança: `safety/pr63-before-rebuild-20261118`, no mesmo HEAD.
- Nenhum reset, clean, merge, rebase, push ou alteração do PR #63 nesta reconstrução.

## Inventário por commit

Comandos: `git cherry -v origin/main feat/be-db-s9-abastecimentos`,
`git log --cherry-pick --right-only --no-merges origin/main...feat/be-db-s9-abastecimentos`
e `git range-diff e8dd0d6..feat/be-db-s9-abastecimentos e8dd0d6..origin/main`.

| Commit original | Classificação | Decisão |
| --- | --- | --- |
| `13425c163b9abb635390dc68f6b996ddfebfc012` | Parcialmente absorvido | Preservar cadastro/409 da main. Reaplicar consultas por detalhe/histórico/filtros. Migration/rollback nullable excluídos após confirmação do Caso B por Gabriel. Indicadores antigos não substituem os atuais. |
| `fa9b6d9ef83f2a3af609888fc98828bd31e46602` | Parcialmente absorvido | Main já contém documentos, anexos, anotações e dashboard. Reaplicar somente comprovante de abastecimento sobre a infraestrutura comum, testes e contratos necessários. Não reaplicar o frontend antigo. |
| `41165dd5ca0819135521c4ff77dc0250acfddc9b` | Merge de sincronização obsoleto | Não reaplicar: a base nova já inclui a evolução posterior. Não é commit de funcionalidade própria. |

`git cherry` encontrou dois `+`, nenhum `-`: **zero commits equivalentes completos**.
Equivalência semântica parcial não significa igualdade de patch. Nenhum cherry-pick
integral foi feito; os trechos ainda necessários foram adaptados à main atual.
Nenhum commit novo foi criado nesta etapa: as alterações ficam no working tree
para a validação final, naquele momento bloqueada pela recriação oficial do banco isolado. Por isso `git diff origin/main...HEAD` era vazio;
o inventário efetivo considera `git diff 6da75df` mais os arquivos novos não rastreados.

## O que foi preservado da main

Telas, rotas, CSS, RBAC, autenticação, execução SVO/viagens, correções de odômetro,
migrations existentes, auditoria tipada, anexos privados, notas, documentos e
suas proteções. Também permanecem consumo cheio a cheio (PR #75), RF46 (PR #74)
e os dashboards/intervalo SVO (PRs #72–77). A reconstrução não volta esses módulos
ao estado antigo de indisponibilidade do PR #63.

No frontend manual, somente o transporte de download e seu consumidor de
abastecimentos aceitam explicitamente PDF/JPEG/PNG até 5 MiB. O padrão dos outros
consumidores permanece JPEG/PNG até 1 MiB. Os dois artefatos de API foram gerados
pelos scripts oficiais. As páginas não foram substituídas.

## Quilometragem: Caso B confirmado

Gabriel confirmou a regra oficial, comunicada pelo solicitante em **18/11/2026**:
quilometragem obrigatória, não nula e nunca menor que a leitura anterior válida.
Igualdade não constitui regressão. Essa decisão substitui a proposta RF40 nullable.

- 400 atual para ausência/null preservado; testes legados da main intactos.
- Schema, DTO e OpenAPI exigem km inteiro obrigatório; artefatos regenerados oficialmente.
- A main não comparava o cadastro com o abastecimento anterior: a regressão foi
  demonstrada por teste antes do ajuste. Agora a comparação é revalidada sob o
  lock do veículo existente, antes do INSERT. Menor retorna 409; igual/maior persiste.
- Cronologia de abastecimentos segue os indicadores atuais (data, cadastro, ID),
  considerando somente leituras válidas até a data informada e o mesmo veículo.
- Confronto com viagem corrigida e respectivo 409 preservados; nenhuma alteração
  nos fluxos de viagens ou SVO, nem inferência/atualização automática de odômetro.
- Formulário da main permanece obrigatório. Os dados do E2E de cadastro foram
  ajustados para km 1000 + largura, pois antes 390/768 eram inferiores ao km 1000
  da fixture anterior; nenhuma expectativa de obrigatoriedade foi removida.

## Migration nullable excluída

A migration da main `20261111000000_add_tipo_evento_log_atividade.sql` fica intacta.
A proposta `20261118090000_db_s9_01_abastecimentos_rf40.sql`, o rollback e o README
inativos foram removidos da nova entrega. Os originais continuam preservados na
branch antiga e na referência de segurança. Nenhuma migration nullable foi ativada.
O snapshot da main não foi editado manualmente.

Na primeira validação, o Docker registrava a versão antiga `20261111000000_db_s9_01_abastecimentos_rf40.sql`.
A orientação naquele momento era removê-la mediante recriação oficial do ambiente, não alteração manual do
ledger, esquema ou snapshot. `db:test:start` reutiliza a instância; `db:test:prepare`
só aplica incrementos. Nenhum script de reset/recriação existe neste checkout.
`docs/database/README.md` proíbe apagar volumes ou refazer marcadores para contornar
as guardas. O solicitante confirmou que esse procedimento ainda não existe e proibiu reset
improvisado. É necessário que o responsável forneça um script aprovado para criar
uma nova identidade isolada, sem reutilizar/adulterar a atual. Nenhum comando de
remoção, rollback manual ou reparo foi improvisado.

## Fechamento do Caso B — 18/11/2026

- Antes da correção: 4 regressões reproduzidas (schema nullable, km menor,
  leitura do mesmo dia e concorrência); os testes de ausência/null já retornavam 400.
- Depois: 40/40 testes focados de km, legado, contrato e correção de viagem.
- Vitest completo: **1.047/1.049**, em 114 arquivos; apenas os dois testes de
  snapshot do banco antigo falham. DB 112/114; integração 362/362; contratos
  35/35; consumidores/frontend 142/142. Todos os testes de abastecimentos: 62/62.
- E2E afetados: **9/9** considerando a rodada inicial (8 passaram) e o reteste
  do cenário novo (1/1). O teste novo procurava o posto na tabela; o campo existe
  somente no detalhe. O seletor do teste foi corrigido, sem alterar a interface.
  Comprovou 409 real para 999 após 1000, 201 real para igualdade, registro no
  PostgreSQL e detalhe recuperado após reload. Há provas de 390/768/1280.
- Typecheck frontend/backend/testes/scripts, builds frontend/backend, lint,
  api:check, client:check e git diff --check: aprovados. Build Vite com envDir:false.
- `db:test:start` reconheceu a identidade; `db:test:prepare` incremental passou.
  `db:docs:check` continua com drift estrutural em schema-metadata.json, decorrente
  exclusivamente da migration RF40 antiga aplicada no Docker.
- Migration/rollback nullable removidos da entrega; migration de auditoria,
  testes legados de HTTP 400/409 e snapshot da main preservados. Telas intactas.
- Não houve reset, remoção de volume/banco, alteração de marcador/ledger, edição
  manual de snapshot, acesso ao Supabase compartilhado, commit, push ou PR.

**Conclusão histórica daquela rodada, substituída pelo estado atual acima:** faltava a validação em banco limpo com nova
identidade aprovada. O drift não foi mascarado e zero divergência ainda não foi
comprovado. Não há pendência de decisão sobre quilometragem: o Caso B está definido.

### Solicitação técnica registrada naquela rodada (histórico)

Fornecer um procedimento/script aprovado e documentado para criar uma **nova
identidade isolada**, sem reutilizar/adulterar a atual. Deve preservar a prova de
checkout/container/porta/marcador do harness e permitir aplicar a baseline e todas
as migrations atuais pelo runner oficial. Depois executar prepare, db:docs:check
e os testes DB/integrados. Este registro documenta a solicitação necessária;
nenhuma mensagem foi publicada em Jira/PR ou enviada a outro canal nesta etapa.

## Fechamento focado BE-S9-01 — SCRUM-186/187

Revisão de 18/11/2026 após leitura integral da SCRUM-180, 186 e 187 e seus
comentários. A `origin/main` consultada é `908e2ce`; seu novo commit não altera
abastecimentos, anexos ou auditoria. Não houve merge nem mudança nas telas do
Gustavo, na SCRUM-188, nas migrations RF40 ou no banco remoto.

Foram comprovadas e corrigidas duas lacunas da SCRUM-186: ausência de atividade
do cadastro e validação incompleta de litros/valor positivos. Antes, 9 dos 11
novos testes falhavam. Agora o ator vem exclusivamente da sessão, e cadastro,
comprovante legado e atividade `abastecimento_criado` confirmam na mesma transação.
Falha real de auditoria reverte as escritas. O evento contém somente o ID do
registro; não exige a coluna `criado_por_id` da proposta RF40. Valores inválidos
retornam 400 antes de chegar às constraints; strings monetárias não são convertidas
para cálculo em ponto flutuante. Km obrigatório e conflitos de odômetro foram
preservados.

SCRUM-187 conserva o serviço compartilhado já entregue: PDF/JPEG/PNG, metadados,
autor, FK, download privado, 401/403/404/413/415, reenvio e rollback. Novas provas
cobrem conta/perfil alterado após emissão do token, path traversal e limite exato
de 5 MiB, incluindo bytes completos e auditoria do upload. Nenhum storage novo.

- Bateria diretamente afetada: **157/157**; inclui 11/11 novas provas de cadastro,
  10/10 de comprovantes, contratos/geração, RBAC, auditoria e concorrência com viagens.
- E2E afetados: **9/9**, incluindo cadastro, download e reload reais em
  390/768/1280 e 409 real para km menor. Os casos legados com respostas de erro
  controladas continuam evidências de interface, não de persistência.
- Typecheck completo, builds frontend/backend, lint, api:check, client:check e
  diff-check passaram. Vite/Vitest sem carregar `.env`; PostgreSQL pelo harness.
- A limpeza dos testes de cadastro, viagens e E2E foi ampliada apenas para remover
  as atividades criadas pelas próprias fixtures. Nenhuma regra de viagens mudou.

**SCRUM-186 e SCRUM-187 prontas no backend.** O aceite integrado final da SCRUM-180
naquela rodada continuava condicionado à reconciliação RF40/banco isolado sem drift, sob
responsabilidade externa a esta etapa. A evidência anterior de `db:docs:check`
e dos dois testes de snapshot permanece vermelha; não foi ocultada nem apresentada
como aprovada. SCRUM-188 consta concluída no Jira e não foi reimplementada.
Não houve atualização do Jira, commit, push ou PR.

## Validação anterior à confirmação do Caso B (histórico)

- Harness Docker reconhecido; `db:test:start` e `db:test:prepare` oficiais concluídos.
- Os 8 testes reaproveitados de comprovantes falharam antes da reaplicação (POST 405), comprovando a lacuna na base.
- Testes focados HTTP/contrato/consumidor: 27/27; rodada final diretamente afetada: 114/114.
- Playwright afetado: 8/8, incluindo 3 PDFs reais e 3 cadastros reais em 390/768/1280; 2 casos legados de erro controlado. Houve uma tentativa de proxy antes de o backend iniciar, recuperada pelo polling oficial, sem falha de teste.
- Vitest consolidado: 1.038/1.040; integração HTTP 355/355; contratos 34/34; frontend/consumidores 141/141; DB 112/114.
- As duas falhas DB são `schema.test.ts`: snapshot completo e detecção/restauração de drift. `db:docs:check` também falha pelo mesmo motivo.
- O catálogo isolado já tinha a migration RF40 antiga: motorista/km nullable, coluna criado_por_id, 2 índices e 4 constraints adicionais. Essas são todas as diferenças estruturais contra o snapshot da main.
- A consulta somente de leitura ao histórico do harness confirmou `20261111000000_db_s9_01_abastecimentos_rf40.sql` já aplicada.
- Após o teardown, as contagens dos usuários, veículos, abastecimentos e anexos das fixtures usadas foram zero.
- Scripts de banco, teste schema e snapshot são idênticos à base 6da75df. Nenhuma alteração desta reconstrução adicionou esse drift. Não foi gerado snapshot artificial nem revertido o banco para mascará-lo.
- Typecheck frontend/backend e testes/scripts, lint, api:check e client:check passaram. Builds backend/frontend passaram; Vite executado com envDir:false. Aviso de bundle grande do exportador da main permanece.

Os testes de consumidor usam respostas controladas e não provam persistência.
Os testes de integração de comprovante/consulta usam HTTP e PostgreSQL real, com
fixtures oficiais e teardown, sem interceptação. O E2E de download adicionado
usa login real de fixture oficial, API real e consulta PostgreSQL, teclado e reload
em 390/768/1280. O E2E legado conserva os casos de erro com resposta controlada;
esses casos não são apresentados como comprovação de persistência real.

Não houve acesso a banco remoto/Supabase, Jira ou conteúdo de .env.
A branch nova é a candidata a substituir o PR #63 depois de validar o baseline de banco recriado e o Caso B. O PR antigo permanece aberto e inalterado.

## Arquivos desta reconstrução

Nenhum arquivo da branch original foi apagado. “Não reaplicado” significa excluído apenas da nova entrega.

### Reaplicados/adaptados ou novos para auditoria

- `backend/src/modules/abastecimentos/abastecimentos.consultas.ts`
- `backend/src/modules/abastecimentos/abastecimentos.controller.ts`
- `backend/src/modules/abastecimentos/abastecimentos.repository.ts`
- `backend/src/modules/abastecimentos/abastecimentos.routes.ts`
- `backend/src/modules/abastecimentos/abastecimentos.schemas.ts`
- `backend/src/modules/anexos/anexos.schemas.ts`
- `backend/src/modules/anexos/anexos.service.ts`
- `backend/src/shared/contract/openapi.ts`
- `backend/src/shared/contract/registry.ts`
- `backend/tests/contract/abastecimentos-consultas-s9.test.ts`
- `backend/tests/contract/generation.test.ts`
- `backend/tests/integration/abastecimentos-anexos-s9.test.ts`
- `backend/tests/integration/abastecimentos-consultas-s9.test.ts`
- `backend/tests/integration/abastecimentos-quilometragem-s9.test.ts`
- `docs/api/abastecimentos.md`
- `docs/api/anexos.md`
- `docs/api/inventory.md`
- `docs/api/legacy-manifest.json`
- `docs/api/openapi.yaml`
- `docs/sprint9-reconstrucao-pr63.md`
- `frontend/src/shared/api/client.ts`
- `frontend/src/shared/api/generated/operations.ts`
- `frontend/src/shared/api/generated/schema.d.ts`
- `frontend/src/shared/services/abastecimentos.service.test.ts`
- `frontend/src/shared/services/abastecimentos.service.ts`
- `scripts/generate-api.ts`
- `tests/e2e/abastecimentos.spec.ts`

### Não reaplicados da entrega antiga

| Arquivo | Motivo |
| --- | --- |
| `backend/src/app.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/database/scripts/generate-db-docs.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/database/supabase/migrations/20261111000000_db_s9_01_abastecimentos_rf40.sql` | Proposta nullable removida da nova entrega pelo Caso B; original preservado na referência de segurança. |
| `backend/src/database/supabase/migrations/20261112000000_db_s9_02_documentos_evidencias.sql` | Já absorvido integralmente pela main. |
| `backend/src/database/supabase/rollbacks/20261111000000_db_s9_01_abastecimentos_rf40.sql` | Proposta nullable removida da nova entrega pelo Caso B; original preservado na referência de segurança. |
| `backend/src/database/supabase/rollbacks/20261112000000_db_s9_02_documentos_evidencias.sql` | Já absorvido integralmente pela main. |
| `backend/src/modules/abastecimentos/abastecimentos.comprovante.ts` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `backend/src/modules/abastecimentos/abastecimentos.service.ts` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `backend/src/modules/anexos/anexos.routes.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/anexos/registros.acesso.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/anotacoes/anotacoes.routes.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/anotacoes/anotacoes.schemas.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/anotacoes/anotacoes.service.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/auditoria/auditoria.service.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/modules/dashboard/dashboard.consolidado.schemas.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/modules/dashboard/dashboard.consolidado.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/modules/dashboard/dashboard.controller.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/dashboard/dashboard.routes.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/documentos/documentos.controller.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/documentos/documentos.gestao.schemas.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/modules/documentos/documentos.gestao.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/modules/documentos/documentos.historico.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/documentos/documentos.routes.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/modules/documentos/documentos.upload.ts` | Já absorvido integralmente pela main. |
| `backend/src/modules/motoristas/motoristas.controller.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/src/modules/motoristas/motoristas.routes.ts` | Já absorvido integralmente pela main. |
| `backend/tests/contract/abastecimentos-s9.test.ts` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `backend/tests/contract/anexos-s9.test.ts` | Já absorvido integralmente pela main. |
| `backend/tests/contract/documentos-notas-dashboard-s9.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/database/abastecimentos-s9.test.ts` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `backend/tests/database/documentos-evidencias-s9.test.ts` | Já absorvido integralmente pela main. |
| `backend/tests/database/schema.test.ts` | Baseline da main preservado; não copiar snapshot/expectativas do banco RF40 antigo. |
| `backend/tests/database/seed.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/helpers/anexos-fixture.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/integration/abastecimentos-comprovante-indicadores.test.ts` | Main já contém consumo atualizado; testes antigos misturam comportamento substituído/RF40. |
| `backend/tests/integration/abastecimentos-s9.test.ts` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `backend/tests/integration/abastecimentos.test.ts` | Teste legado de km obrigatório preservado até decisão. |
| `backend/tests/integration/anexos-s9.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/integration/anotacoes-s9.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/integration/dashboard-consolidado-falhas.test.ts` | Já absorvido integralmente pela main. |
| `backend/tests/integration/dashboard-consolidado-s9.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/integration/dashboard.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/integration/documentos-s9.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/integration/documentos.test.ts` | Já absorvido integralmente pela main. |
| `backend/tests/integration/motoristas.test.ts` | Já absorvido integralmente pela main. |
| `backend/tests/integration/veiculos-contract.test.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `backend/tests/unit/abastecimentos.indicadores.test.ts` | Main já contém consumo atualizado; testes antigos misturam comportamento substituído/RF40. |
| `docs/abastecimentos-validacao.md` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `docs/api/README.md` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `docs/api/anotacoes.md` | Já absorvido integralmente pela main. |
| `docs/api/dashboard-consolidado-s9.md` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `docs/api/documentos-s9.md` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `docs/database/README.md` | Baseline da main preservado; não copiar snapshot/expectativas do banco RF40 antigo. |
| `docs/database/der.mmd` | Baseline da main preservado; não copiar snapshot/expectativas do banco RF40 antigo. |
| `docs/database/dicionario.md` | Baseline da main preservado; não copiar snapshot/expectativas do banco RF40 antigo. |
| `docs/database/schema-metadata.json` | Baseline da main preservado; não copiar snapshot/expectativas do banco RF40 antigo. |
| `docs/database/schema.sql` | Baseline da main preservado; não copiar snapshot/expectativas do banco RF40 antigo. |
| `docs/database/sprint9-abastecimentos.md` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `docs/database/sprint9-documentos-evidencias.md` | Baseline da main preservado; não copiar snapshot/expectativas do banco RF40 antigo. |
| `docs/permissoes.md` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
| `frontend/src/app/App.tsx` | Preservar o frontend mais recente; não restaurar tela/rota/serviço antigo. |
| `frontend/src/pages/abastecimentos/Abastecimentos.tsx` | Preservar o frontend mais recente; não restaurar tela/rota/serviço antigo. |
| `frontend/src/pages/abastecimentos/DetalheAbastecimento.tsx` | Preservar o frontend mais recente; não restaurar tela/rota/serviço antigo. |
| `frontend/src/pages/abastecimentos/HistoricoAbastecimentos.tsx` | Preservar o frontend mais recente; não restaurar tela/rota/serviço antigo. |
| `frontend/src/pages/abastecimentos/IndicadoresAbastecimentos.tsx` | Preservar o frontend mais recente; não restaurar tela/rota/serviço antigo. |
| `frontend/src/shared/services/access.service.test.ts` | Preservar o frontend mais recente; não restaurar tela/rota/serviço antigo. |
| `frontend/src/shared/services/access.service.ts` | Preservar o frontend mais recente; não restaurar tela/rota/serviço antigo. |
| `scripts/generate-client.ts` | Já absorvido integralmente pela main. |
| `tests/e2e/abastecimentos-s9-integrado.spec.ts` | Versão antiga misturava RF40 nullable descartado pelo Caso B; partes necessárias reaplicadas em arquivos adaptados. |
| `tests/e2e/motoristas.spec.ts` | Preservar implementação/testes/documentação mais recentes da main; não restaurar versão antiga. |
