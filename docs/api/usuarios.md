# API — Usuários (#29)

## Rotas e entrada

Todas exigem Bearer JWT e ADM ativo com perfil efetivo atual no banco.

| Método e caminho | Corpo | Sucesso |
| --- | --- | --- |
| GET /api/admin/usuarios | não | array direto, id ASC |
| POST /api/admin/usuarios | JSON nome/email/perfil/senha | objeto direto, 201 |
| PUT /api/admin/usuarios/:id | JSON nome/email/perfil; senha opcional | objeto direto, 200 |
| PATCH /api/admin/usuarios/:id/status | JSON {ativo:boolean} | objeto direto, 200 |

Cadastro/edição aceitam somente os campos indicados. Nome: mínimo de três caracteres
após trim, máximo de 150 caracteres recebidos; email com formato válido, até 150
caracteres; senha com no mínimo oito caracteres e no máximo 72 bytes (limite bcrypt).
Perfil é código real: ADM, GESTOR_FROTA, SOLICITANTE_INTERNO, MOTORISTA ou
ATENDENTE_SVO. Rótulos visuais não são aceitos no SQL. Campos extras/internos
(id, ativo, criado_em, senha_hash etc.) são rejeitados, sem mass assignment.

Status exige exatamente ativo booleano, sem coerção. Repetir estado retorna 200
sem UPDATE/evento adicional. Mudança e evento existente compartilham transação
com FOR UPDATE; requisições concorrentes são serializadas. Frontend aguarda a
confirmação antes de alterar a tela e envia códigos reais no cadastro e na edição.

## Respostas

### 200 — Lista

```json
[]
```

Lista/edição usam os mesmos campos do cadastro abaixo, nunca senha_hash.

### 200 — Edição

```json
{"id":"42","nome":"Fixture Usuário","email":"fixture@example.invalid","perfil":"SOLICITANTE_INTERNO","ativo":true,"criado_em":"2026-01-15T15:00:00.000Z"}
```

### 200 — Status, incluindo estado já desejado

```json
{"id":"42","nome":"Fixture Usuário","email":"fixture@example.invalid","perfil":"SOLICITANTE_INTERNO","ativo":false}
```

### 201 — Cadastro

```json
{"id":"42","nome":"Fixture Usuário","email":"fixture@example.invalid","perfil":"SOLICITANTE_INTERNO","ativo":true,"criado_em":"2026-01-15T15:00:00.000Z"}
```

Exemplos fictícios; serialização temporal e envelopes legados continuam nesta fase.

### 400 — Entrada inválida

```json
{"error":{"code":"ENTRADA_INVALIDA","message":"Confira os campos informados."}}
```

Status inválido mantém code ENTRADA_INVALIDA e message
"Informe somente ativo como booleano."; id fora de bigint usa "Identificador inválido.".
JSON malformado:

```json
{"error":{"code":"JSON_INVALIDO","message":"Envie um JSON válido."}}
```

Cadastro com email já encontrado mantém a resposta legada:

```json
{"error":"Já existe um utilizador registado com este e-mail."}
```

### 401 — Sessão inválida/ausente ou conta inativa/inexistente

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

### 403 — Perfil efetivo sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

JWT antigo de ADM não preserva acesso quando o perfil no banco muda.

### 404 — Usuário inexistente na edição/status

```json
{"error":"Utilizador não encontrado."}
```

Caminho desconhecido é tratado pelo despacho comum, com NAO_ENCONTRADO.

### 405 — Método inválido

Allow corresponde à tabela de rotas.

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

### 413 — Corpo maior que 64 KiB

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

### 415 — Tipo explícito incompatível

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

### 500 — Falha inesperada

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

Sem erro bruto/SQL/hash na resposta; falha de consulta de identidade não autoriza.

## Exemplo mínimo

```http
PATCH /api/admin/usuarios/42/status HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{"ativo":false}
```

## O que a entrega não faz

O PATCH sem corpo de toggle deixa de ser aceito (400); API e frontend mudam juntos.
Não há novo fluxo de usuários, recuperação de senha, novos perfis ou expansão da
matriz ADM/Gestor. Não unifica paginação, datas ou todos os envelopes legados
(#32). Cadastro/edição conservam a gravação de auditoria atual fora da transação;
sua centralização é #31. Infraestrutura comum em [README.md](./README.md).
