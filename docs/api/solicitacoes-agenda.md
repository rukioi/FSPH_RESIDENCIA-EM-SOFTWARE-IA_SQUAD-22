# Agenda, disponibilidade e reagendamento — SCRUM-156 / BE-S7-02

| Método | Rota | Autenticação | Perfis | Corpo |
| --- | --- | --- | --- | --- |
| GET | /api/solicitacoes-viagem/agenda | JWT e usuário ativo atual | ADM, GESTOR_FROTA | Sem corpo |
| GET | /api/solicitacoes-viagem/disponibilidade | JWT e usuário ativo atual | ADM, GESTOR_FROTA | Sem corpo |
| POST | /api/solicitacoes-viagem/{id}/reagendar | JWT e usuário ativo atual | ADM, GESTOR_FROTA | JSON estrito, até 64 KiB |

Solicitante, MOTORISTA e ATENDENTE_SVO não acessam essas rotas. A consulta antiga
de pedidos mantém o escopo por solicitante. ID segue o limite BIGINT existente;
formato não numérico no caminho recebe 404, número fora de BIGINT recebe 400.

As consultas exigem inicio/fim ISO 8601 com offset, início anterior ao fim e
período de até 31 dias (duração em instantes). Parâmetros desconhecidos ou
duplicados recebem 400. Não exigem período futuro: agenda permite consulta passada.
Os limites são normalizados pelo PostgreSQL para horários locais America/Maceio.

Agenda aceita page/limit no padrão atual: 1/20, limit máximo 100 e offset seguro.
Lista somente AGENDADA intersectando [inicio,fim), por saída e ID crescentes.
Dados e total usam os mesmos filtros no mesmo snapshot. Recursos removidos
podem aparecer como null. Reserva antiga sem retorno é exibida com retorno null
como intervalo sem fim conhecido a partir da saída, sem inventar horário.

Disponibilidade não aceita paginação; retorna listas mínimas dos recursos
DISPONIVEL elegíveis por todo o intervalo. Verifica AGENDADA,
PRONTA_PARA_INICIAR e EM_ANDAMENTO; intervalos contíguos não conflitam.
Reserva ativa sem retorno válido bloqueia conservadoramente o recurso.
Ordens SVO EM_DESLOCAMENTO/EM_TRANSPORTE bloqueiam sem fim estimado.
Não consulta nem devolve CPF, telefone, CNH ou email. Consulta é informativa:
não cria reserva nem garante que o recurso continuará livre até a gravação.

Reagendamento recebe os quatro campos obrigatórios: motoristaId, veiculoId,
ambos strings inteiras BIGINT assinadas entre -9223372036854775808 e
9223372036854775807, incluindo zero e IDs negativos das fixtures, e
dataHoraSaida e dataHoraRetornoPrevisto. Exige saída futura e retorno posterior;
o limite de 31 dias é das consultas, não da duração da reserva. Não permite outros
campos. Apenas AGENDADA; mantém esse estado sem nova aprovação. Não altera
origem, destino, finalidade, passageiros, código ou solicitante.

## 200 — Agenda

```json
{"data":[{"id":"1024","codigo":"TRP-1024","codigoExibicao":"#TRP-1024","status":"AGENDADA","origem":"Sede","destino":"Unidade","finalidade":"Visita institucional","qtdPassageiros":3,"motorista":{"id":"12","nome":"Motorista"},"veiculo":{"id":"34","placa":"TEST123","modelo":"Modelo"},"dataHoraSaida":"2099-11-10T08:00:00.000000-03:00","dataHoraRetornoPrevisto":"2099-11-10T17:00:00.000000-03:00"}],"meta":{"page":1,"limit":20,"total":1}}
```

## 200 — Disponibilidade

```json
{"data":{"motoristas":[{"id":"12","nome":"Motorista"}],"veiculos":[{"id":"34","placa":"TEST123","modelo":"Modelo"}]}}
```

Listas vazias são sucesso; não inclui períodos ou dados fictícios de liberação SVO.

## 200 — Reagendamento

```json
{"data":{"id":"1024","status":"AGENDADA","motoristaId":"12","veiculoId":"34","dataHoraSaida":"2099-11-10T08:00:00.000000-03:00","dataHoraRetornoPrevisto":"2099-11-10T17:00:00.000000-03:00"}}
```

## 400 — Período, campos, identificador ou horário inválidos

```json
{"error":{"code":"DADOS_INVALIDOS","message":"Revise os campos informados.","fields":{"fim":"Informe um valor válido, sem campos adicionais."}}}
```

Saída não futura recebe SAIDA_INVALIDA. O banco verifica novamente esse requisito
no UPDATE, após a espera pelos locks. Violação do CHECK de retorno recebe
RETORNO_INVALIDO. JSON malformado usa JSON_INVALIDO no envelope comum.

## 401 — Sem sessão válida, usuário inexistente ou inativo

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

## 403 — Perfil sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

## 404 — Pedido ou recurso inexistente no reagendamento

```json
{"error":{"code":"NAO_ENCONTRADO","message":"Solicitação não encontrada."}}
```

Motorista/veículo ausentes e FK 23503 usam REFERENCIA_INEXISTENTE.

## 409 — Estado ou reserva incompatível no reagendamento

```json
{"error":{"code":"ESTADO_INCOMPATIVEL","message":"Somente solicitações agendadas podem ser reagendadas."}}
```

Recurso fora de DISPONIVEL usa RECURSO_INDISPONIVEL; conflito institucional ou
SVO usa CONFLITO_ALOCACAO. Não confirma nem altera parcialmente a reserva anterior.

## 413 — Corpo de reagendamento excessivo

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

## 415 — Tipo do corpo de reagendamento incompatível

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

## 405 — Método incompatível

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

Allow: GET nas consultas; POST no reagendamento, antes de autenticar.
Todas as respostas incluem X-Request-Id.

## 500 — Falha inesperada, incluindo falha de auditoria

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

## Requisições mínimas

```http
GET /api/solicitacoes-viagem/agenda?inicio=2099-11-10T11:00:00Z&fim=2099-11-11T11:00:00Z&page=1&limit=20 HTTP/1.1
Authorization: Bearer <token>
```

```http
GET /api/solicitacoes-viagem/disponibilidade?inicio=2099-11-10T11:00:00Z&fim=2099-11-10T20:00:00Z HTTP/1.1
Authorization: Bearer <token>
```

```http
POST /api/solicitacoes-viagem/1024/reagendar HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{"motoristaId":"12","veiculoId":"34","dataHoraSaida":"2099-11-10T08:00:00-03:00","dataHoraRetornoPrevisto":"2099-11-10T17:00:00-03:00"}
```

## Transação e concorrência

Reagendamento usa READ COMMITTED e bloqueia o pedido com FOR UPDATE. Bloqueia
todos os motoristas antigos/novos por ID numérico crescente, depois todos os
veículos antigos/novos na mesma ordem. Duplicatas são removidas. A validação
compartilhada revalida recursos e conflitos, excluindo só o ID do próprio pedido
da busca institucional; não exclui bloqueios SVO. Não bloqueia outros pedidos ou
ordens nas consultas de conflito, evitando inversão de locks.

Os locks são compatíveis com os fluxos de agendamento/SVO (motorista antes de
veículo). A reserva antiga fica válida até o commit atômico da nova. Auditoria
registra Reagendou a solicitação de transporte ID n com o ator da sessão, na mesma
transação. Falha da atividade ou conflito reverte tudo. Mantém código, solicitante
e status AGENDADA. Não aplica a regra de voltar a PENDENTE do PATCH de edição.

## O que a entrega não faz

Sem cancelamento, execução de viagens, horários SVO inventados, acesso novo para
solicitante/motorista/SVO ou promessa de disponibilidade futura. Estes endpoints
não exigem migration adicional às quatro institucionais incluídas na entrega;
seus pré-requisitos e a reconciliação remota estão no
[procedimento de rollout](../database/sprint7-reconciliacao.md).
Disponibilidade não ignora reservas
próprias: a exclusão só existe na validação transacional do reagendamento.

Testes unitários e HTTP reais verificam filtros, limites, isolamento, intervalos adjacentes, reagendamento e rollback. solicitacoes-temporal.test.ts verifica parâmetros preparados repetidos e microssegundos; solicitacoes-aceite.test.ts verifica conflito com a reserva anterior e ordens SVO ativas. A disponibilidade consultada continua sem garantir a reserva.

### Reagendamento e viagem vinculada

O reagendamento atualiza na mesma transação os recursos da viagem vinculada AGENDADA e os horários previstos da solicitação. Viagem em outro estado ou com recursos inconsistentes bloqueia a operação com 409. Solicitações legadas sem viagem continuam sem viagem; não ocorre criação histórica automática.

O motorista selecionado deve possuir conta de usuário vinculada e ativa; caso contrário, o agendamento ou reagendamento retorna HTTP 409. A verificação é feita na transação da reserva.
