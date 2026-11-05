# Agendamento institucional — SCRUM-139 / BE-S7-02

POST /api/solicitacoes-viagem/{id}/agendar. Bearer JWT com usuário ativo atual;
somente ADM/GESTOR_FROTA. Corpo JSON estrito, limitado a 64 KiB:
motoristaId e veiculoId como strings inteiras BIGINT assinadas, entre
-9223372036854775808 e 9223372036854775807 (inclusive zero), e
dataHoraRetornoPrevisto ISO 8601 com offset explícito. IDs negativos das fixtures
são aceitos para recursos; existência e disponibilidade continuam obrigatórias.
Não aceita sinal positivo explícito, espaços, decimais ou notação exponencial.
ID do pedido continua não negativo; formato numérico fora de BIGINT: 400;
caminho fora do padrão: 404.

Saída vem do pedido, nunca do corpo. Somente APROVADA pode mudar para AGENDADA.
Retorno é convertido pelo PostgreSQL para America/Maceio e deve ser estritamente
posterior à saída local. Armazena timestamp without time zone; resposta usa -03:00.

## 200 — Agendamento confirmado

```json
{"data":{"id":"1024","status":"AGENDADA","motoristaId":"12","veiculoId":"34","dataHoraSaida":"2026-11-10T08:00:00.000000-03:00","dataHoraRetornoPrevisto":"2026-11-10T17:00:00.000000-03:00"}}
```

## 400 — Entrada inválida ou retorno não posterior à saída

```json
{"error":{"code":"RETORNO_INVALIDO","message":"O retorno previsto deve ser posterior à saída."}}
```

Campos inválidos/extras recebem DADOS_INVALIDOS e fields no envelope comum.

## 401 — Sessão inválida, usuário inexistente ou inativo

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

## 403 — Perfil sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

## 404 — Pedido, motorista ou veículo inexistente

```json
{"error":{"code":"REFERENCIA_INEXISTENTE","message":"Motorista ou veículo não encontrado."}}
```

Pedido inexistente usa NAO_ENCONTRADO; FK 23503 também recebe 404.

## 409 — Estado, disponibilidade ou reserva incompatível

```json
{"error":{"code":"CONFLITO_ALOCACAO","message":"Motorista ou veículo possui uma alocação conflitante."}}
```

Estado diferente de APROVADA: ESTADO_INCOMPATIVEL. Recurso fora de DISPONIVEL:
RECURSO_INDISPONIVEL. O agendamento não muda o status operacional do recurso para
EM_VIAGEM; a reserva é temporal, não início de execução.

## 413 — Corpo excessivo

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

## 415 — Tipo de corpo incompatível

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

## 405 — Método diferente de POST

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

Allow: POST; aplicado antes de autenticar. Respostas incluem X-Request-Id.

## 500 — Falha inesperada ou falha da auditoria

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

## Requisição mínima

```http
POST /api/solicitacoes-viagem/1024/agendar HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{"motoristaId":"12","veiculoId":"34","dataHoraRetornoPrevisto":"2026-11-10T17:00:00-03:00"}
```

## Integridade e concorrência

Transação READ COMMITTED: bloqueia pedido, depois motorista, depois veículo.
Os locks permanecem até commit. Depois dos locks consulta os dois fluxos,
grava recursos/retorno/status e registra Agendou a solicitação de transporte ID n
com o usuário da sessão, na mesma transação. Falha da auditoria reverte a reserva.

Reservas institucionais ativas: AGENDADA, PRONTA_PARA_INICIAR, EM_ANDAMENTO.
Conflito se qualquer recurso coincidir e início existente < retorno novo e
retorno existente > saída nova. Intervalos [início,fim) contíguos são permitidos.
Reservas ativas antigas sem retorno ou com retorno inválido bloqueiam o recurso
conservadoramente; não há preenchimento artificial de histórico.

SVO em EM_DESLOCAMENTO/EM_TRANSPORTE bloqueia recursos sem presumir fim. No sentido
inverso, despacho SVO recusa qualquer reserva institucional ativa, inclusive futura,
pois não pode assegurar que terminará antes dela. CONCLUIDA/CANCELADA de SVO não
bloqueiam. Compartilha a mesma operação e ordem de locks de recursos; consultas de
conflito não bloqueiam linhas de pedidos/ordens de outras transações, evitando
inversão de locks. Depois de esperar por um recurso, READ COMMITTED permite que
a consulta seguinte veja a reserva recém-confirmada pelo outro fluxo.

A garantia exige que todas as alocações passem pelos dois fluxos atualizados.
Escritas SQL externas não são protegidas por esse protocolo de aplicação.

## Limites do endpoint de agendamento

Não executa viagem, inventa fim SVO, cancela, reagenda, reserva veículo is_svo
exclusivamente ou introduz regras de CNH/capacidade não aprovadas.
A entrega inclui 20261104000002_add_retorno_previsto.sql, com coluna timestamp
without time zone nullable e CHECK solicitacao_viagem_retorno_previsto_check.
Banco novo executa o incremento após a baseline; banco com a alteração manual
precisa de [inspeção e reconciliação explícitas](../database/sprint7-reconciliacao.md),
sem repetir ADD CONSTRAINT nem ignorar definições divergentes. A migration e seu
hash são preservados. Não cria novo evento de auditoria do despacho SVO: a auditoria
nova é do agendamento institucional, preservando o fluxo SVO fora das verificações
de disponibilidade autorizadas.

Testes HTTP reais verificam agendamento, IDs assinados, horários, duplicidade, falha de auditoria com rollback e disputas concorrentes. solicitacoes-aceite.test.ts disputa o mesmo motorista/veículo entre despacho SVO e agendamento institucional: somente uma alocação vence. Reconciliação novo/equivalente/divergente também é ensaiada no PostgreSQL isolado, conforme o procedimento de rollout.
