# API — Usuários (#28)

Recorte de compatibilidade e infraestrutura da refatoração; os registros de negócio
mantêm os campos e envelopes atuais. Contrato unificado/gerado será tratado na #32.

## Rotas

Autenticação: Bearer JWT. Perfis: ADM.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/admin/usuarios | não | array direto, ordenado por id ASC |
| POST /api/admin/usuarios | JSON | objeto direto, 201 |
| PUT /api/admin/usuarios/:id | JSON | objeto direto, 200 |
| PATCH /api/admin/usuarios/:id/status | não | objeto direto, 200; alterna ativo |

Campos de escrita existentes: nome, email, perfil e senha (senha opcional na edição). Retornos não incluem senha_hash. A alternância de status permanece sem corpo.

## Respostas

### 200 — Consulta (exemplo vazio)

```json
[]
```

### 201 — Cadastro concluído

Exemplo fictício do formato retornado (valores ilustrativos, derivados das fixtures
do banco isolado; não constitui nova regra de preenchimento):

```json
{
  "id": "1",
  "nome": "Fixture T1 ADM",
  "email": "t1-adm@example.invalid",
  "perfil": "ADM",
  "ativo": true,
  "criado_em": "2026-01-15T15:00:00.000Z"
}
```

### 400 — Entrada inválida

Exemplo para JSON malformado. Erros de campo e envelopes de domínio existentes permanecem.

```json
{"error": {"code": "JSON_INVALIDO", "message": "Envie um JSON válido."}}
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

### 413 — Limite de bytes excedido

```json
{"error": {"code": "CORPO_MUITO_GRANDE", "message": "Corpo da requisição muito grande."}}
```

### 415 — Tipo incompatível

```json
{"error": {"code": "TIPO_NAO_SUPORTADO", "message": "Envie o corpo como application/json."}}
```

### 500 — Falha inesperada

Exemplo do fallback comum. Controllers preservam mensagens genéricas próprias; nenhum erro bruto é retornado.

```json
{"error": {"code": "ERRO_INTERNO", "message": "Não foi possível concluir a requisição."}}
```

## Exemplo mínimo

```http
GET /api/admin/usuarios HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados, regras operacionais ou paginação. Não unifica os
DTOs legados nesta fase. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).
