# Detalhes e histórico institucional — SCRUM-157 / BE-S7-02

| Método | Rota | Autenticação | Perfis | Corpo |
| --- | --- | --- | --- | --- |
| GET | /api/solicitacoes-viagem/{id} | JWT e usuário ativo atual | ADM, GESTOR_FROTA, SOLICITANTE_INTERNO | Sem corpo |
| GET | /api/solicitacoes-viagem/{id}/historico | JWT e usuário ativo atual | ADM, GESTOR_FROTA, SOLICITANTE_INTERNO | Sem corpo |

ADM/Gestor consultam qualquer pedido; solicitante consulta exclusivamente seus
pedidos, pela identidade atual da sessão. Restrições são aplicadas no SQL de
detalhes, autorização do histórico, página e total. Inexistente e inacessível
recebem exatamente o mesmo 404. MOTORISTA/ATENDENTE_SVO recebem 403.

ID decimal não negativo dentro de BIGINT; número fora do limite: 400; caminho
não numérico não registrado: 404. Detalhes ignoram query params. Histórico aceita
somente page/limit, sem duplicatas; defaults 1/20, máximo100, offset inteiro seguro.

## 200 — Detalhes

```json
{"data":{"id":"1024","codigo":"TRP-1024","codigoExibicao":"#TRP-1024","solicitante":{"id":"42","nome":"Solicitante"},"origem":"Sede","destino":"Unidade","finalidade":null,"status":"AGENDADA","qtdPassageiros":3,"motivoRejeicao":null,"dataHoraSaida":"2026-11-10T08:00:00.000000-03:00","dataHoraRetornoPrevisto":"2026-11-10T17:00:00.000000-03:00","motorista":{"id":"12","nome":"Motorista"},"veiculo":{"id":"34","placa":"TEST123","modelo":"Modelo"}}}
```

Finalidade, retorno, motivo, solicitante e recursos podem ser null conforme os
registros existentes. Campos pessoais limitados a ID/nome; sem email, CPF, CNH,
telefone, hash ou dados administrativos. Horários do pedido mantêm a convenção
institucional America/Maceio/-03:00, sem atualização de histórico.

## 200 — Histórico cronológico paginado

Resposta ao solicitante:

```json
{"data":[{"id":"55","descricao":"Aprovou a solicitação de transporte ID 1024","dataHora":"2026-11-04T10:00:00.000000"}],"meta":{"page":1,"limit":20,"total":1}}
```

Para ADM/Gestor, cada item também contém responsavel com ID/nome, ou null se
o usuário não existir. Solicitante não recebe esse campo. Nenhum papel recebe email.
dataHora é o valor civil de log_atividade.data_hora, timestamp without time zone:
não se infere UTC ou offset histórico. Pode ser null, ordenado ao final.
Ordenação data_hora ASC NULLS LAST e id ASC numérico para desempate; página e
total são lidos com a autorização no mesmo snapshot REPEATABLE READ READ ONLY.
Histórico vazio é 200, total0, não uma reconstrução de ações antigas.

## 400 — Identificador ou paginação inválidos

```json
{"error":{"code":"DADOS_INVALIDOS","message":"Revise os campos informados.","fields":{"page":"Informe um valor válido, sem campos adicionais."}}}
```

## 401 — Sessão inválida, usuário inexistente ou inativo

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

## 403 — Perfil sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

## 404 — Pedido inexistente ou inacessível

```json
{"error":{"code":"NAO_ENCONTRADO","message":"Solicitação não encontrada."}}
```

## 405 — Método incompatível

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

Detalhes compartilham caminho com edição: Allow GET, PATCH. Histórico: Allow GET.
Método é validado antes da autenticação. Todas as respostas incluem X-Request-Id.

## 500 — Falha inesperada

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

## Requisições mínimas

```http
GET /api/solicitacoes-viagem/1024 HTTP/1.1
Authorization: Bearer <token>
```

```http
GET /api/solicitacoes-viagem/1024/historico?page=1&limit=20 HTTP/1.1
Authorization: Bearer <token>
```

## Vínculo estruturado da auditoria

Criação, aprovação, rejeição, edição, agendamento e reagendamento passam a gravar
log_atividade.solicitacao_viagem_id usando o recursoId tipado recebido pelo serviço.
Não se extrai ID da descrição. Operação e INSERT do log continuam na transação
do chamador: falha da FK/atividade rejeita a operação. Descrições existentes são
preservadas. Eventos de usuários/SVO não ganham vínculo institucional, mesmo
quando IDs numéricos coincidirem. Lotes mistos mantêm a correspondência por evento.

## O que a entrega não faz

Não associa logs antigos com vínculo null, não interpreta texto, não cria eventos
de ações que não ocorreram nem reconstrói valores anteriores ou motivos a partir
de descrições. Não muda as outras operações ou a auditoria administrativa.
Coluna nullable/FK/índice foram confirmados pelo responsável; esta entrega não
altera DDL, migrations, estrutura ou o banco compartilhado.

Mocks verificam autorização, SQL, vínculo por evento e respostas; persistência,
FK, snapshots, ordenação e rollback reais seguem pendentes no PostgreSQL isolado.
