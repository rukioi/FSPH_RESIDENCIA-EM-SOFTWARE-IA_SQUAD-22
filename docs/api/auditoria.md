# API — Auditoria (#28)

Recorte de compatibilidade e infraestrutura da refatoração; os registros de negócio
mantêm os campos e envelopes atuais. Contrato unificado/gerado será tratado na #32.

## Rotas

Autenticação: Bearer JWT. Perfis: ADM.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/admin/auditoria/logs | não | array direto, data_hora DESC |

Retorna l.* e usuario_nome/usuario_email via LEFT JOIN. Não há filtros ou paginação no caminho HTTP ativo.

## Respostas

### 200 — Consulta (exemplo vazio)

```json
[]
```

### 401 — Sem sessão

```json
{"error": {"code": "NAO_AUTENTICADO", "message": "Autenticação necessária."}}
```

### 403 — Perfil sem permissão

```json
{"error": {"code": "ACESSO_NEGADO", "message": "Acesso não permitido."}}
```

### 404 — Caminho desconhecido

Exemplo de caminho desconhecido; ausência de registro na edição mantém o erro de domínio atual.

```json
{"error": {"code": "NAO_ENCONTRADO", "message": "Rota não encontrada."}}
```

### 405 — Método inválido

Inclui `Allow` com os métodos da linha correspondente na tabela de rotas.

```json
{"error": {"code": "METODO_NAO_PERMITIDO", "message": "Método não permitido."}}
```

### 500 — Falha inesperada

Exemplo do fallback comum. Controllers preservam mensagens genéricas próprias; nenhum erro bruto é retornado.

```json
{"error": {"code": "ERRO_INTERNO", "message": "Não foi possível concluir a requisição."}}
```

## Exemplo mínimo

```http
GET /api/admin/auditoria/logs HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados, regras operacionais ou paginação. Não unifica os
DTOs legados nesta fase. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).
