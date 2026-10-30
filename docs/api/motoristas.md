# API — Motoristas (#28)

Recorte de compatibilidade e infraestrutura da refatoração; os registros de negócio
mantêm os campos e envelopes atuais. Contrato unificado/gerado será tratado na #32.

## Rotas

Autenticação: Bearer JWT. Perfis: GET: ADM/GESTOR_FROTA/ATENDENTE_SVO; escrita: ADM/GESTOR_FROTA.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/motoristas | não | {data: array}, id DESC |
| POST /api/motoristas | JSON | {data: registro}, 201 |
| PUT ou PATCH /api/motoristas/:id | JSON | {data: registro}, 200; alteração parcial |
| DELETE /api/motoristas/:id | não | {data: {success: true}}, 200 |

Cadastro exige nome, cnh, categoria_cnh e validade_cnh. status, cpf e telefone permanecem opcionais com validação existente. SVO não recebe cpf/telefone na consulta. PUT/PATCH continuam parciais; não há GET individual.

## Respostas

### 200 — Consulta (exemplo vazio)

```json
{"data":[]}
```

### 201 — Cadastro concluído

Exemplo fictício do formato retornado (valores ilustrativos, derivados das fixtures
do banco isolado; não constitui nova regra de preenchimento):

```json
{
  "data": {
    "id": "1",
    "usuario_id": null,
    "nome": "Motorista fictício T1 0",
    "cnh": "T1-CNH-0",
    "categoria_cnh": "D",
    "validade_cnh": "2030-01-15T00:00:00.000Z",
    "status": "DISPONIVEL",
    "criado_em": "2026-01-15T15:00:00.000Z",
    "cpf": "T1-CPF-0",
    "telefone": "00000000000"
  }
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

### 409 — Duplicidade

Exemplo de conflito; as validações existentes mantêm suas mensagens específicas.

```json
{"error": {"code": "CPF_DUPLICADO", "message": "Este CPF já está cadastrado."}}
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
GET /api/motoristas HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados, regras operacionais ou paginação. Não unifica os
DTOs legados nesta fase. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).
