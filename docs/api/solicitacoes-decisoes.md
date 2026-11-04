# Decisões de solicitações de transporte — SCRUM-138 / BE-S7-02

| Método | Rota | Autenticação | Perfis | Corpo |
| --- | --- | --- | --- | --- |
| POST | /api/solicitacoes-viagem/{id}/aprovar | JWT e usuário ativo atual | ADM, GESTOR_FROTA | Sem corpo; conteúdo enviado é ignorado |
| POST | /api/solicitacoes-viagem/{id}/rejeitar | JWT e usuário ativo atual | ADM, GESTOR_FROTA | JSON estrito até 64 KiB: motivo |

ID decimal não negativo dentro de BIGINT; fora do limite: 400. Caminhos que não
correspondem ao padrão numérico não são registrados e recebem 404.
Responsável obtido exclusivamente da sessão atual, nunca do corpo. Rejeição exige
motivo string não vazio após trim; campos extras recebem 400.

Ambas as ações exigem PENDENTE. SELECT FOR UPDATE bloqueia a linha, depois UPDATE
também verifica o estado. Aprovação muda para APROVADA e limpa motivo_rejeicao;
rejeição muda para REPROVADA e persiste motivo. Decisão e log_atividade usam a mesma
transação. Segunda decisão, inclusive após espera por outra transação: 409, sem
novo evento. Falha da auditoria rejeita a transação inteira. Descrição do evento
contém só ação/ID; motivo fica no pedido, sem cópia de texto privado para o log.

## 200 — Decisão confirmada

```json
{"data":{"id":"1024","status":"APROVADA","motivoRejeicao":null}}
```

```json
{"data":{"id":"1024","status":"REPROVADA","motivoRejeicao":"Pedido sem justificativa institucional."}}
```

## 400 — Motivo, JSON ou identificador inválido

```json
{"error":{"code":"DADOS_INVALIDOS","message":"Revise os campos informados.","fields":{"motivo":"Informe um valor válido, sem campos adicionais."}}}
```

JSON malformado: JSON_INVALIDO no envelope comum.

## 401 — Sessão inválida, usuário inexistente ou inativo

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

## 403 — Perfil sem permissão, incluindo solicitante

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

## 404 — Pedido inexistente

```json
{"error":{"code":"NAO_ENCONTRADO","message":"Solicitação não encontrada."}}
```

## 409 — Estado incompatível ou decisão repetida

```json
{"error":{"code":"ESTADO_INCOMPATIVEL","message":"A solicitação precisa estar pendente para receber uma decisão."}}
```

## 413 — Rejeição com corpo acima do limite

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

## 415 — Rejeição com tipo de corpo incompatível

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

## 405 — Método diferente de POST

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

Allow: POST; tratado antes da autenticação. Todas as respostas incluem X-Request-Id.

## 500 — Falha inesperada, incluindo auditoria

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

## Requisições mínimas

```http
POST /api/solicitacoes-viagem/1024/aprovar HTTP/1.1
Authorization: Bearer <token>
```

```http
POST /api/solicitacoes-viagem/1024/rejeitar HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{"motivo":"Pedido sem justificativa institucional."}
```

## O que a entrega não faz

Não agenda, aloca recursos, executa viagem, edita pedido, cancela, reabre decisão
ou muda o SVO. APROVADA não equivale a AGENDADA. Enum remoto e migrations locais
foram informados pelo responsável, sem execução/alteração nesta entrega.
Testes com mocks verificam fluxo e SQL, não provam locks, rollback ou disputa
entre transações PostgreSQL reais. Essa prova permanece pendente no banco isolado.
