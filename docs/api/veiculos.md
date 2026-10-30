# API — Veículos (#28)

Recorte de compatibilidade e infraestrutura da refatoração; os registros de negócio
mantêm os campos e envelopes atuais. Contrato unificado/gerado será tratado na #32.

## Rotas

Autenticação: Bearer JWT. Perfis: GET: ADM/GESTOR_FROTA/ATENDENTE_SVO; escrita: ADM/GESTOR_FROTA.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/veiculos | não | {data: array}, id DESC |
| POST /api/veiculos | JSON | {data: registro}, 201 |
| PUT ou PATCH /api/veiculos/:id | JSON | {data: registro}, 200; alteração parcial |
| DELETE /api/veiculos/:id | não | {data: {success: true}}, 200 |

Cadastro exige placa, modelo, marca e ano; mantém os campos opcionais e enums validados pelo controller atual (tipo, capacidades, quilometragem_atual, status, is_svo, vinculo, fornecedor_locacao). PUT/PATCH continuam parciais; não há GET individual.

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
    "placa": "T1F0000",
    "modelo": "Veículo fictício 0",
    "marca": "Fixture",
    "ano": 2026,
    "tipo": "PASSEIO",
    "capacidade_obitos": 0,
    "quilometragem_atual": 1000,
    "status": "DISPONIVEL",
    "is_svo": false,
    "criado_em": "2026-01-15T15:00:00.000Z",
    "capacidade_passageiros": 5,
    "vinculo": "PROPRIO",
    "fornecedor_locacao": null
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
{"error": {"code": "PLACA_DUPLICADA", "message": "Já existe um veículo cadastrado com esta placa."}}
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
GET /api/veiculos HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados, regras operacionais ou paginação. Não unifica os
DTOs legados nesta fase. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).
