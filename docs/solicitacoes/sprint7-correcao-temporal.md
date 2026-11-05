# Correção temporal — conclusão da Sprint 7

Branch feat/be-s7-conclusao-auditoria-indicadores. Alterações anteriores preservadas,
sem commit, push, merge, rebase ou acesso ao Supabase compartilhado. Esta correção
não adiciona migration, coluna, estado, endpoint ou regra de disponibilidade.

## Causas e correção

O serializer padrão de datas da biblioteca postgres transforma parâmetros inferidos
como timestamp/timestamptz em Date e chama toISOString. Isso pode deslocar horário
civil conforme o fuso Node e limita a fração a milissegundos. O teste real anterior
à correção observou retorno 17:00 gravado como 20:00 em UTC−3 e .123456 persistido
como .123000. O problema não era um deslocamento fixo necessário ao domínio.

Todos os parâmetros temporais dos repositories de solicitações agora entram como
text. O PostgreSQL faz text → timestamptz para entradas ISO com offset e aplica
America/Maceio antes de gravar a coluna timestamp without time zone. Valores civis
já normalizados usam text → timestamp, sem passar por Date no serializer. Criação,
edição, agendamento, reagendamento e filtros de lista/total da agenda foram cobertos.
A disponibilidade compartilhada e o dashboard já usavam esse padrão e foram preservados.
Não foi desativado prepare nem alterado o pool/serializer global ou código SVO.

As comparações de período usavam Date.parse com a fração, perdendo diferenças abaixo
de um milissegundo. Agora interpretam somente o segundo inteiro com offset em Date,
e somam a fração arredondada em BigInt. O instante em microssegundos nunca vira Number.
A fração segue strtod/rint para microsegundos, inclusive empate para par/carry,
confrontada com o [código PostgreSQL 17](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/utils/adt/datetime.c#L673)
e com consultas reais no banco. Frações de mais de seis dígitos continuam aceitas,
sujeitas ao arredondamento do PostgreSQL; entradas com seis dígitos são preservadas.

A comparação comum atende dashboard, agenda/disponibilidade e retorno do reagendamento.
Permanece o limite de 31 dias onde já existia; não foi introduzido esse limite no
reagendamento. Saída futura continua revalidada após aquisição dos locks usando o
relógio do banco. Nenhum registro histórico foi convertido ou atualizado pela correção.

## Provas e resultados

Nove regressões falharam antes da implementação: três intervalos válidos receberam
400; persistência/agendamento perderam microssegundos ou deslocaram horas; agenda
legada rejeitou o intervalo e metadados revelaram binds timestamp no driver.

- solicitacoes-temporal.test.ts: sete testes HTTP/PostgreSQL, com TZ=UTC e
  America/Fortaleza. Sete repetições por cenário de cadastro/edição e de
  agendamento/reagendamento; conferência dos valores armazenados com to_char,
  filtros [início,fim), disponibilidade, conflito 409, reserva de um microssegundo,
  registros legados com finalidade null e preservação dos valores existentes.
- O teste inspeciona pg_prepared_statements de todas as conexões do pool de testes
  e comprova múltiplas execuções dos caminhos reais com parâmetros textuais,
  não apenas mocks ou strings SQL esperadas. Nenhuma conexão externa é aceita.
- solicitacoes-precisao.test.ts: 28 comparações reais com PostgreSQL para instantes
  e intervalos: um microssegundo, arredondamento/carry, empates, igualdade/inversão,
  offsets até ±15:59, anos 0001/9999, época anterior a 1970 e 31 dias exatos/+1 μs.
- dashboard-indicadores.test.ts: sete cenários HTTP adicionais de períodos
  microscópicos válidos/inválidos, offsets diferentes e limite excedido.
- solicitacoes.datas.test.ts: seis testes adicionais de entradas inválidas sem
  exceção e precisão antes/depois da época Unix. Expectativas de casts dos mocks
  da agenda foram atualizadas, sem afrouxar regras de status/locks/auditoria.

Validação: 593 testes em 54 arquivos, incluindo 63 testes reais de banco;
35 E2E; bootstraps src/dist com portas efêmeras; lint, typecheck, build,
api:generate/client:generate e respectivos checks, db:docs:check e diff --check.
Os 16 testes de geração foram reexecutados após as descrições de estado no contrato.
Não houve drift estrutural: snapshots/DER e todas as migrations permanecem intactos.

Todos os ensaios usaram o harness que confirma container, checkout, porta e marcador
antes do acesso. Não foi usada a DATABASE_URL do desenvolvedor ou arquivo .env.
Portas e identidade foram exclusivamente temporárias e restauradas dos backups.

## Semântica mantida e pendências externas

Aprovadas/reprovadas continuam sendo estados atuais APROVADA/REPROVADA dos pedidos
com saída no período. Agendar pode reduzir a quantidade atualmente APROVADA; isso
não significa apagar uma decisão do histórico. Não são contagens de decisões
realizadas no período. A interpretação permanece provisória e depende do aceite
da equipe, agora explícito também nos schemas/OpenAPI e nos tipos gerados.

Não foram implementados cancelamento, frontend institucional, escala/jornada,
matriz CNH × veículo ou rollout no Supabase. Motoristas continuam indeterminados
quando faltam dados, com motivo. A reconciliação das migrations manuais e a proteção
do acesso direto ao banco continuam responsabilidades de implantação/aceite.

## Arquivos alterados neste complemento

- backend/src/modules/dashboard/dashboard.indicadores.schemas.ts
- backend/src/modules/solicitacoes/solicitacoes.agenda.repository.ts
- backend/src/modules/solicitacoes/solicitacoes.datas.ts
- backend/src/modules/solicitacoes/solicitacoes.repository.ts
- backend/src/modules/solicitacoes/solicitacoes.schemas.ts
- backend/src/modules/solicitacoes/solicitacoes.service.ts
- backend/tests/database/solicitacoes-precisao.test.ts
- backend/tests/integration/dashboard-indicadores.test.ts
- backend/tests/integration/solicitacoes-temporal.test.ts
- backend/tests/unit/solicitacoes.agenda.test.ts
- backend/tests/unit/solicitacoes.datas.test.ts
- docs/api/dashboard.md
- docs/api/openapi.yaml
- docs/api/solicitacoes.md
- docs/solicitacoes/sprint7-correcao-temporal.md
- docs/solicitacoes/sprint7-validacao.md
- frontend/src/shared/api/generated/schema.d.ts

A lista completa da branch inclui também as alterações anteriores preservadas.
Backups/hashes locais: .test-db/s7-temporal-fix/before.json. Não integram o Git.
