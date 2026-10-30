# API — Veículos (#32)

Piloto do contrato global executável. Os registros mantêm os campos, envelopes,
permissões e regras existentes; os mesmos schemas validam entrada/saída e geram
[OpenAPI](./openapi.yaml), tipos e bindings do cliente.

## Rotas

Autenticação: Bearer JWT. Perfis: GET: ADM/GESTOR_FROTA/ATENDENTE_SVO; escrita: ADM/GESTOR_FROTA.

| Método e caminho | Corpo | Sucesso existente |
| --- | --- | --- |
| GET /api/veiculos | não | {data: array}, id DESC |
| POST /api/veiculos | JSON | {data: registro}, 201 |
| PUT ou PATCH /api/veiculos/:id | JSON | {data: registro}, 200; alteração parcial |
| DELETE /api/veiculos/:id | não | {data: {success: true}}, 200 |

Cadastro exige placa, modelo, marca e ano; mantém os campos opcionais e enums validados pelo controller atual (tipo, capacidades, quilometragem_atual, status, is_svo, vinculo, fornecedor_locacao). PUT/PATCH continuam parciais; não há GET individual.

Cadastro: textos com pelo menos um caractere não branco, sem trim/normalização
no backend; ano inteiro de 1900 a 2100. Tipo: PASSEIO/VAN/AMBULANCIA/RABECÃO_SVO;
status: DISPONIVEL/EM_VIAGEM/EM_MANUTENCAO/INDISPONIVEL. Capacidade de óbitos é
inteira >=0; passageiros inteira >0; km é número finito >=0 no validador (o banco
INTEGER pode rejeitar decimal/overflow, conservando 500). is_svo é booleano.
Defaults para ausente/null: tipo PASSEIO, capacidade_obitos 0, passageiros 5,
km 0, is_svo false, vínculo PROPRIO. Status ausente usa DISPONIVEL; null é inválido,
como no validador anterior. Campos extras continuam ignorados.

Vínculo é PROPRIO ou LOCADO; LOCADO exige fornecedor não vazio no mesmo corpo.
Fornecedor explícito não nulo deve ser texto não branco. PROPRIO limpa fornecedor.
PUT/PATCH editam somente placa, marca, modelo, status, capacidade_passageiros,
vinculo e fornecedor_locacao. Enviar ano/tipo/km/capacidade_obitos/is_svo não os
altera. null não limpa fornecedor de LOCADO; vínculo LOCADO explícito exige enviar
fornecedor mesmo quando o registro já o tem. Não há nova regra de disponibilidade.

Lista/criação/edição projetam explicitamente os 14 campos do registro no exemplo
abaixo. ID BIGINT é string; campos com default mas nullable no banco (capacidades,
km, status, is_svo, criado_em) aceitam null na saída. criado_em é ISO produzido pelo
driver, sem migração de fuso. Lista usa id DESC, completa, sem page/limit/meta.

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

Para ID inexistente em edição/exclusão, o mesmo código traz `Veículo não encontrado.`.

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

Controllers mantêm `Falha ao listar/cadastrar/atualizar/remover veículo(s).` conforme
a operação. Em particular, exclusão impedida por FK conserva 500 `ERRO_INTERNO`,
sem revelar SQL ou constraint. A mudança desse status para 409 exige tarefa própria.

## Exemplo mínimo

```http
GET /api/veiculos HTTP/1.1
Authorization: Bearer <token>
```

## O que a entrega não faz

Não muda permissões, estados, regras operacionais ou paginação. A #30 migrou os
consumidores de frota, usuários e SVO; validação HTTP global dos controllers
legados continua fora do piloto. Limites, request ID e erros técnicos seguem
[infraestrutura comum](./README.md#infraestrutura-http--28).

## Identidade comum — #29

Todas as rotas acima consultam usuário ativo e perfil atual do banco a cada
requisição, após validar JWT HS256/sub/exp e segredo mínimo de 32 bytes UTF-8.
Conta inativa/inexistente ou token inválido: 401 NAO_AUTENTICADO. Perfil efetivo
fora da lista existente: 403 ACESSO_NEGADO. Falha de consulta não usa claims como
fallback e recebe 500 do tratamento comum. As listas de permissão e operações
permanecem as documentadas acima. Ver [identidade compartilhada](./README.md#identidade-e-usuários--29).
