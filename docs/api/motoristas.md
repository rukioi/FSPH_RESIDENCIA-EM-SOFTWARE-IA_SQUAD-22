# API — Motoristas (#28)

Recorte de compatibilidade e infraestrutura da refatoração; os registros de negócio
mantêm os campos e envelopes atuais. Contrato global gerado na #32; consumo
validado e estado remoto compartilhado na #30, sem alterar formatos.

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

### 409 — Conflito

As validações de duplicidade mantêm suas mensagens específicas. O DELETE de motorista vinculado a histórico de CNH retorna `HISTORICO_CNH_EXISTENTE` e preserva o cadastro e as versões.

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

## Identidade comum — #29

Todas as rotas acima consultam usuário ativo e perfil atual do banco a cada
requisição, após validar JWT HS256/sub/exp e segredo mínimo de 32 bytes UTF-8.
Conta inativa/inexistente ou token inválido: 401 NAO_AUTENTICADO. Perfil efetivo
fora da lista existente: 403 ACESSO_NEGADO. Falha de consulta não usa claims como
fallback e recebe 500 do tratamento comum. As listas de permissão e operações
permanecem as documentadas acima. Ver [identidade compartilhada](./README.md#identidade-e-usuários--29).

## Escalas, impedimentos e inativação — SCRUM-239/240

Somente ADM e GESTOR_FROTA, inclusive leitura (decisão do responsável em 25/11).
ATENDENTE_SVO e demais perfis recebem 403. Autor e instante vêm da sessão e do banco;
campos extras ou autoria enviada pelo cliente retornam 400.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/motoristas/:id/escalas | não | 200, lista paginada |
| POST /api/motoristas/:id/escalas | JSON | 201, registro |
| POST /api/motoristas/:id/escalas/:registroId/cancelamento | JSON | 200, registro |
| GET /api/motoristas/:id/impedimentos | não | 200, lista paginada |
| POST /api/motoristas/:id/impedimentos | JSON | 201, registro |
| POST /api/motoristas/:id/impedimentos/:registroId/cancelamento | JSON | 200, registro |
| GET /api/motoristas/:id/transicoes | não | 200, lista paginada com situação profissional |
| POST /api/motoristas/:id/inativacao | JSON | 201, transição |
| POST /api/motoristas/:id/reativacao | JSON | 201, transição |

Escala exige início, fim e situação (EM_ESCALA ou FORA_DE_ESCALA). Impedimento exige
tipo (FOLGA ou AFASTADO) e início; o fim é opcional. Cancelamento, inativação e
reativação exigem motivo. As listas aceitam página, limite e, nas escalas e nos
impedimentos, início e fim informados juntos. Os schemas completos estão no
contrato gerado.

Datas são ISO 8601 com fuso; períodos são `[inicio, fim)`. Lacuna entre períodos
vigentes é dado ausente, não folga nem disponibilidade. Impedimento não tem campo
livre clínico; o motivo de inativação é administrativo e não deve conter diagnóstico.

Conflitos 409: `ESCALA_SOBREPOSTA`, `IMPEDIMENTO_SOBREPOSTO`, `REGISTRO_JA_CANCELADO`,
`MOTORISTA_JA_INATIVO`, `MOTORISTA_NAO_INATIVO`. O DELETE do cadastro retorna
`409 HISTORICO_DISPONIBILIDADE_EXISTENTE` quando há qualquer dessas trilhas.

Inativação não altera `usuario.ativo`, `motorista.status` nem reservas já feitas
(sem regra homologada para cancelá-las). Novos agendamentos, reagendamentos e
despachos SVO passam a recusar o motorista (SCRUM-240). Registro e alocação tomam o
mesmo lock do motorista, então uma inativação concorrente com um agendamento é
serializada. A listagem `GET /api/motoristas` não muda.

Elegibilidade (SCRUM-240): só bloqueiam impedimentos conhecidos (inativação, ausência
vigente, `FORA_DE_ESCALA` no intervalo). Falta de escala e a matriz CNH × classe
veicular, ainda sem classe no cadastro de veículos, ficam indeterminadas e não bloqueiam.
