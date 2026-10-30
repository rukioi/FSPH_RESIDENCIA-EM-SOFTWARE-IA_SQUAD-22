# API — Documentos (#28)

Recorte de compatibilidade e infraestrutura da refatoração; os registros de negócio
mantêm os campos e envelopes atuais. Contrato unificado/gerado será tratado na #32.

## Rotas

Autenticação: Bearer JWT. Perfis: ADM/GESTOR_FROTA.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/documentos | não | {data: array} |
| POST /api/documentos | JSON ou multipart/form-data | {data: registro}, 201 |
| GET /api/documentos/pendencias | não | {data: array} |

Escrita existente: veiculo_id positivo, tipo_documento e data_vencimento civil válida (YYYY-MM-DD). Multipart inclui um arquivo PDF/JPEG/PNG com assinatura validada. JSON mantém 1 MiB; arquivo 5 MiB, corpo total 5 MiB + 64 KiB, dez campos de 4 KiB e onze partes. O excesso agora é 413; estrutura inválida permanece UPLOAD_INVALIDO (400).

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
    "tipo_documento": "Fixture",
    "data_vencimento": "2030-01-15T00:00:00.000Z",
    "status_regular": true,
    "arquivo_nome": "fixture.pdf",
    "arquivo_tipo": "application/pdf"
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

### 413 — Limite excedido

Exemplo do JSON; excesso multipart usa a mensagem técnica comum.

```json
{"error": {"code": "CORPO_MUITO_GRANDE", "message": "O JSON deve ter no máximo 1 MB."}}
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
GET /api/documentos HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados, regras operacionais ou paginação. Não unifica os
DTOs legados nesta fase. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).

## Identidade comum — #29

Todas as rotas acima consultam usuário ativo e perfil atual do banco a cada
requisição, após validar JWT HS256/sub/exp e segredo mínimo de 32 bytes UTF-8.
Conta inativa/inexistente ou token inválido: 401 NAO_AUTENTICADO. Perfil efetivo
fora da lista existente: 403 ACESSO_NEGADO. Falha de consulta não usa claims como
fallback e recebe 500 do tratamento comum. As listas de permissão e operações
permanecem as documentadas acima. Ver [identidade compartilhada](./README.md#identidade-e-usuários--29).
