# Conclusão técnica — SCRUM-140, 154, 163 e 164

Árvore de entrega, branch feat/be-s7-conclusao-auditoria-indicadores, base 2d72048.
Verificações executadas em 05/11/2026. Sem commit, push, merge ou acesso ao
Supabase compartilhado. Alterações locais anteriores de auditoria/compatibilidade
foram preservadas e ampliadas. A branch original e a integração não foram editadas.

## Critérios e aceite

| SCRUM | Requisitos atendidos | Pendências e alcance do aceite | Evidência principal |
| --- | --- | --- | --- |
| 140 | Reutiliza serviço/repository, seis eventos, ator da sessão, vínculo FK, operação/log atômicos e histórico autorizado; falha real do INSERT de auditoria reverte cada ato | Criação não promete idempotência; repetição incompatível de decisão/agendamento não gera log extra. Política/ACL remota e retenção não foram alteradas ou certificadas. Evidências locais não equivalem a anexos/aceite Jira | solicitacoes-http.test.ts: rollback das seis operações, 405 do histórico, repetição, concorrência e isolamento; schemas/eventos anteriores preservados |
| 154 | Inventário e matriz de transições, finalidade/legado, aprovação distinta de agendamento, recursos/retorno na reserva, fuso, código e autor/instante no log documentados | Não há fonte/modelo aprovado de jornada/escala e CNH por veículo. Não inferir elegibilidade. Rastreabilidade individual dos textos integrais BL08–BL14 e aceite da equipe continuam externos | [Modelo e decisões](./sprint7-modelo-e-aceite.md); validações e transições HTTP reais de solicitações |
| 163 | Quatro migrations anteriores imutáveis; cinco índices medidos em incremento novo; tipos, CHECK, FK, snapshots/DER gerados do PostgreSQL; legado e rollback sem perda comprovados | Rollout compartilhado depende de reconciliar alterações manuais, histórico e hashes. Reversão segura mantém campos/enum/dados; sem down destrutivo. SQL externo não é protegido pelos locks de aplicação | 35 testes reais de banco, hashes, rollback do incremento e compatibilidade; [planos e rollout](../database/sprint7-indices.md) |
| 164 | Rotas existentes evoluídas, períodos, fila atual, status da coorte, aprovação/recusa atuais, logs/decisões recentes, veículos livres e SVO ativo; null com motivo quando falta elegibilidade de motorista; indisponibilidade de widgets fora do épico | Disponibilidade completa continua indisponível por decisão explícita, não implementada por suposição. Integração visual/aceite FE-S7-03 e fórmulas/títulos IND completos exigem equipe. Consumidor externo deve aceitar null | dashboard-indicadores.test.ts: HTTP/SQL, 401/403/400, estados, limites, períodos, recursos; [contrato e impacto](../api/dashboard.md) |

O texto de responsabilidade da 154 prevalece sobre seu item antigo que atribuía SQL
à mesma task: implementação de banco pertence à 163. Cancelamento permanece fora
por decisão expressa. Não há execução de viagem ou funcionalidade institucional de
frontend adicionada. Não marcar as quatro tarefas como integralmente aceitas apenas
com base nos testes: os limites funcionais/operacionais acima precisam de aceite.

## Validações executadas

| Verificação | Resultado |
| --- | --- |
| npm run lint | Aprovado |
| npm run typecheck | Aprovado: frontend, backend, testes e scripts |
| npm run build | Aprovado: frontend e backend |
| npm test | 545 testes em 52 arquivos, incluindo os 35 testes de banco |
| npm run test:db | 35 testes reais, também executados separadamente |
| npm run db:test:prepare | Aprovado no banco exclusivo, hashes e transações preservados |
| npm run db:docs:generate / db:docs:check | Gerados reais, sem drift; 10 tabelas, 109 colunas, 8 enums, 42 constraints e 27 índices |
| npm run api:check / client:check | Aprovados; gerados pelos comandos oficiais |
| npm run test:e2e | 35 testes aprovados em portas livres, sem encerrar processos existentes |
| Bootstrap TypeScript e compilado | Ambos aprovados na suíte com porta efêmera apenas no teste |
| Banco novo sem dados operacionais | Schema completo aplicado com --no-seed, cinco contagens zeradas antes da identidade fictícia; /gestor e /graficos reais retornaram 200 e zeros verdadeiros |
| git diff --check e whitespace de arquivos novos | Aprovados |

O ensaio de base vazia preservou a identidade Docker/marcador, criou uma base nova,
aplicou as migrations sem seed pelo runner existente e adicionou somente um ADM
fictício para autenticação. Não limpou a base anterior. Evidências ignoradas:
.test-db/s7-indicadores/empty-database.json e empty-result.json. A nova base foi
preservada; a guarda temporária foi restaurada. --no-seed não esvazia bancos e
não desativa nenhuma verificação de alvo.

Medição de 50.000 pedidos/150.000 logs em tabelas temporárias, nove consultas,
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON), mediana de três execuções. Os índices
por status isolado e histórico composto não foram escolhidos no cenário e não
foram adicionados. Os planos não representam SLA nem comprovam carga de produção.

## Revisão do diff

Somente cliente/tipos gerados foram alterados no frontend; página, serviços e
componentes funcionais permanecem iguais à base. Não houve mudança de regra SVO.
A única alteração no mecanismo compartilhado foi enviar limites timestamp como
texto para conversão no PostgreSQL, evitando deslocamento pelo fuso do Node em
consultas preparadas reutilizadas. Fronteiras adjacentes e TZ=America/Fortaleza
foram ensaiados. Permissões, SQL parametrizado, estados e ordem de locks permanecem.

Portas, identidade de testes, bootstrap, server.ts e configuração E2E temporários
foram restaurados a seus bytes de origem. As quatro migrations históricas têm
hashes verificados. Credenciais e arquivos .env não foram lidos, copiados ou editados.
Evidências locais, compilados e configurações temporárias não integram o diff.

## Arquivos da alteração local

- backend/src/database/scripts/apply-test-migrations.ts
- backend/src/database/scripts/measure-solicitacoes-indexes.ts
- backend/src/database/supabase/migrations/20261105000000_add_solicitacoes_query_indexes.sql
- backend/src/modules/alocacao/alocacao.repository.ts
- backend/src/modules/dashboard/dashboard.controller.ts
- backend/src/modules/dashboard/dashboard.indicadores.schemas.ts
- backend/src/modules/dashboard/dashboard.repository.ts
- backend/src/modules/dashboard/dashboard.routes.ts
- backend/src/modules/dashboard/dashboard.schemas.ts
- backend/src/modules/dashboard/dashboard.service.ts
- backend/src/shared/contract/openapi.ts
- backend/src/shared/contract/registry.ts
- backend/tests/contract/generation.test.ts
- backend/tests/database/solicitacoes-compatibilidade.test.ts
- backend/tests/database/solicitacoes-indices.test.ts
- backend/tests/integration/dashboard-indicadores.test.ts
- backend/tests/integration/solicitacoes-http.test.ts
- backend/tests/unit/dashboard-indicadores.test.ts
- backend/tests/unit/solicitacoes.alocacao.test.ts
- docs/api/dashboard.md
- docs/api/inventory.md
- docs/api/legacy-manifest.json
- docs/api/openapi.yaml
- docs/database/README.md
- docs/database/schema-metadata.json
- docs/database/schema.sql
- docs/database/sprint7-indices.md
- docs/permissoes.md
- docs/solicitacoes/sprint7-modelo-e-aceite.md
- docs/solicitacoes/sprint7-validacao.md
- frontend/src/shared/api/generated/schema.d.ts
- scripts/generate-api.ts

## Complemento — correção temporal posterior à revisão

As duas pendências de código identificadas na revisão foram corrigidas: parâmetros
temporais textuais nos caminhos de persistência/agenda e comparações na precisão
de microssegundos do PostgreSQL. Validação atual: 593 testes em 54 arquivos,
incluindo 63 testes reais de banco, e 35 E2E. Os 16 testes de contratos foram
reexecutados após explicitar a semântica provisória de estado no OpenAPI. Os
resultados anteriores da tabela acima são o registro da etapa inicial, não a
contagem atual. Evidências e arquivos do complemento em
[correção temporal](./sprint7-correcao-temporal.md).

A semântica de aprovação/recusa continua por estado atual da coorte de saída,
sujeita a aceite; não houve implementação de contagem de decisões no período.
As dependências externas anteriormente registradas permanecem.

## Encerramento das dez SCRUMs — 05/11/2026

Referência atual: [critérios, decisões e dependências](./sprint7-encerramento.md). As contagens anteriores deste arquivo são registros das etapas anteriores.

| Comando / prova | Resultado desta revisão |
| --- | --- |
| npm run db:test:prepare | Aprovado somente no Docker exclusivo da árvore, porta local 55452; identidade e hashes preservados. |
| npm test | 609 testes aprovados em 57 arquivos; inclui os 64 testes reais de banco e ambos os bootstraps. |
| npm run test:db | 64 testes aprovados em 10 arquivos, execução separada. |
| npm run test:e2e | 35 aprovados; portas livres exclusivas, sem encerrar processos existentes. |
| npm run lint / typecheck / build | Aprovados. |
| npm run api:generate / client:generate / api:check / client:check | Aprovados; gerados oficiais consistentes. |
| npm run db:docs:generate / db:docs:check | Gerados do banco isolado, sem drift. |
| git diff --check | Aprovado; arquivos novos também conferidos. |

Novas provas: solicitacoes-aceite.test.ts (9 testes HTTP reais) verifica matriz RBAC dos onze endpoints, 404, entradas incompatíveis com PostgreSQL sem escrita parcial, estados incompatíveis, histórico exclusivamente por FK, rollback do reagendamento, SVO EM_TRANSPORTE e corrida real SVO × institucional com apenas um vencedor. solicitacoes.erros.test.ts (6 testes) comprova a tradução estrita dos SQLSTATE temporais, preservação das demais falhas e resultado de sucesso. solicitacoes-preflight.test.ts executa o inventário em transação REPEATABLE READ READ ONLY.

Regressões reproduzidas antes da correção: NUL em texto e data ISO com fração extensa recusada pelo PostgreSQL retornavam 500; agora retornam 400 DADOS_INVALIDOS. Nenhuma falha genérica é convertida em sucesso, nenhuma transação parcial é confirmada.

Todos os ajustes temporários de identidade/portas e bootstrap foram restaurados por cópias de bytes verificadas. Credenciais e .env não foram lidos, copiados nem alterados. Frontend funcional e módulos SVO permanecem sem diff de código próprio; somente o cliente gerado exigido pelo contrato está alterado no frontend. As quatro migrations históricas preservam o conteúdo versionado e os hashes normalizados; nenhuma foi editada nesta revisão (a primeira já possui CRLF local, sem diferença de conteúdo); o incremento de índices anterior desta branch foi preservado. Não houve commit, push, merge ou acesso ao Supabase.
