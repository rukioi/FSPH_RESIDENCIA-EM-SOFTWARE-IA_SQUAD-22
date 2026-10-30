# API — SVO (#28)

## Rotas

Bearer JWT, perfil ATENDENTE_SVO. A identidade positiva válida continua exigida.

| Método | Caminho | Corpo |
| --- | --- | --- |
| GET | /api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO | não |
| POST | /api/svo/solicitacoes | JSON até 64 KiB |
| PATCH | /api/svo/ordens-coleta/:id/despachar | JSON até 64 KiB |

Solicitação: localFalecimento, enderecoRemocao e solicitanteNome obrigatórios;
nomeFalecido, solicitanteParentesco, solicitanteTelefone e observacoesMedicas
opcionais. Despacho: motoristaId/veiculoId inteiros positivos.

## Respostas

### 200 — Consulta ou despacho

Consulta vazia: `[]`. Despacho:

```json
{"id":1,"motorista_id":2,"veiculo_id":3,"status":"EM_DESLOCAMENTO"}
```

### 201 — Solicitação e ordem criadas

```json
{"solicitacao":{"id":1,"codigo":"#SVO-1"},"ordemColeta":{"id":1,"codigo":"#OC-1","status":"PENDENTE_ALOCACAO"},"atividades":["Solicitação #SVO-1 confirmada na ligação","Ordem de coleta #OC-1 gerada para #SVO-1"]}
```

### 400 — JSON malformado ou entrada inválida

```json
{"erro":"O corpo da requisição precisa ser um JSON válido."}
```

Validações de campos mantêm `{erro: mensagem}`. O filtro GET exige
AGUARDANDO_DESPACHO e consulta PENDENTE_ALOCACAO, preservando o legado.

### 401 — Sem sessão

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

Identidade inválida mantém `{ "erro": "Identificação do usuário inválida." }`.

### 403 — Perfil sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

### 404 — Ordem indisponível ou referência inexistente

```json
{"erro":"Motorista ou veículo não encontrado."}
```

### 405 — Método inválido

Inclui Allow: GET, POST ou PATCH conforme a rota.

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

### 409 — Estado ou alocação incompatível

```json
{"erro":"Motorista ou veículo já está em deslocamento."}
```

### 413 — Corpo excessivo

```json
{"erro":"O corpo da requisição excede o limite de 64 KB."}
```

### 415 — Tipo incompatível

```json
{"erro":"Envie o corpo como application/json."}
```

### 500 — Falha inesperada

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível despachar a ordem de coleta."}}
```

## Exemplo mínimo

```http
GET /api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda despacho, disponibilidade, perfis, estados ou limites temporais. Mantém
transações do repository e os envelopes legados; a unificação de DTOs pertence à #32.

## Identidade comum — #29

Todas as rotas acima consultam usuário ativo e perfil atual do banco a cada
requisição, após validar JWT HS256/sub/exp e segredo mínimo de 32 bytes UTF-8.
Conta inativa/inexistente ou token inválido: 401 NAO_AUTENTICADO. Perfil efetivo
fora da lista existente: 403 ACESSO_NEGADO. Falha de consulta não usa claims como
fallback e recebe 500 do tratamento comum. As listas de permissão e operações
permanecem as documentadas acima. Ver [identidade compartilhada](./README.md#identidade-e-usuários--29).
