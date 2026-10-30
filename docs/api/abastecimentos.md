# API — Abastecimentos (#30)

Os registros mantêm os campos e envelopes atuais. A #30 corrige a classificação
técnica de entrada e referência inexistente; o contrato global deriva da #32.

## Rotas

Autenticação: Bearer JWT. Perfis: ADM/GESTOR_FROTA.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/abastecimentos | não | {data: array}, id DESC |
| POST /api/abastecimentos | JSON | {data: registro}, 201 |

Campos existentes: veiculo_id, motorista_id, posto, litragem, valor_total,
quilometragem e data_abastecimento. Corpo precisa ser objeto JSON. IDs aceitam
inteiro seguro ou string decimal; litragem/valor aceitam número finito ou string
numérica; quilometragem exige inteiro; data exige calendário válido YYYY-MM-DD;
posto aceita string ou null. Mantém a rejeição anterior de veículo/litros/valor/data
vazios/zero. O banco atual exige motorista e quilometragem: omissão/null recebe
400, em vez de falhar com 500. Isso não define a obrigatoriedade definitiva do
produto: RF40 permite quilometragem quando disponível e não exige motorista.
A divergência continua adiada, sem migration. A consulta inclui veiculo_placa e
motorista_nome, sem nova regra, filtro ou indicador.

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
    "veiculo_id": "1",
    "motorista_id": "1",
    "litragem": "10.50",
    "valor_total": "63.00",
    "quilometragem": 1000,
    "data_abastecimento": "2026-01-15T00:00:00.000Z",
    "criado_em": "2026-01-15T15:00:00.000Z",
    "posto": "Posto fictício"
  }
}
```

### 400 — Entrada inválida

JSON malformado:

```json
{"error": {"code": "JSON_INVALIDO", "message": "Envie um JSON válido."}}
```

Tipo/campo incompatível com as colunas atuais (inclui NOT NULL, formato numérico,
limite PostgreSQL e data inválida):

```json
{"error":{"code":"DADOS_INVALIDOS","message":"Confira os tipos e campos exigidos pelo cadastro atual de abastecimento."}}
```

### 401 — Sem sessão

```json
{"error": {"code": "NAO_AUTENTICADO", "message": "Autenticação necessária."}}
```

### 403 — Perfil sem permissão

```json
{"error": {"code": "ACESSO_NEGADO", "message": "Acesso não permitido."}}
```

### 404 — Referência inexistente ou caminho desconhecido

Veículo/motorista inexistente (FK 23503), sem informar constraint ou SQL:

```json
{"error":{"code":"REFERENCIA_INEXISTENTE","message":"Veículo ou motorista não encontrado."}}
```

Caminho desconhecido:

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
GET /api/abastecimentos HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados, schema, regras operacionais ou paginação. Não resolve
a divergência RF40 nem muda nomes de DTOs. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).

## Identidade comum — #29

Todas as rotas acima consultam usuário ativo e perfil atual do banco a cada
requisição, após validar JWT HS256/sub/exp e segredo mínimo de 32 bytes UTF-8.
Conta inativa/inexistente ou token inválido: 401 NAO_AUTENTICADO. Perfil efetivo
fora da lista existente: 403 ACESSO_NEGADO. Falha de consulta não usa claims como
fallback e recebe 500 do tratamento comum. As listas de permissão e operações
permanecem as documentadas acima. Ver [identidade compartilhada](./README.md#identidade-e-usuários--29).
