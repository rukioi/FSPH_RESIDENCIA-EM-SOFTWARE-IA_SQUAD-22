# Solicitações de transporte — SCRUM-137 / SCRUM-138 / BE-S7-02

| Método | Rota | Autenticação | Perfis | Corpo |
| --- | --- | --- | --- | --- |
| POST | /api/solicitacoes-viagem | Bearer JWT e usuário ativo atual | SOLICITANTE_INTERNO | JSON até 64 KiB |
| GET | /api/solicitacoes-viagem | Bearer JWT e usuário ativo atual | SOLICITANTE_INTERNO, GESTOR_FROTA, ADM | Sem corpo |

Aprovação e rejeição: [contrato SCRUM-138](./solicitacoes-decisoes.md).
Alocação e retorno previsto: [contrato SCRUM-139](./solicitacoes-agendamento.md).
Edição por ADM/Gestor: [contrato SCRUM-155](./solicitacoes-edicao.md).
Agenda, disponibilidade e reagendamento: [contrato SCRUM-156](./solicitacoes-agenda.md).
Detalhes e histórico por vínculo estruturado: [contrato SCRUM-157](./solicitacoes-detalhes.md).

POST estrito: origem/destino não vazios até 255 caracteres; finalidade não vazia;
dataHoraSaida ISO 8601 com offset explícito; qtdPassageiros inteiro entre 1 e
2147483647. Sem retorno previsto, identidade, código, status ou recursos no corpo.
Campos extras rejeitados. Identidade vem exclusivamente da sessão.

GET aceita somente page, limit e status, sem duplicatas. Defaults: page=1,
limit=20, máximo 100; offset deve ser inteiro seguro. Status usa o enum existente:
PENDENTE, APROVADA, AGENDADA, PRONTA_PARA_INICIAR, EM_ANDAMENTO, CONCLUIDA, REPROVADA.
Solicitante vê só seus pedidos, inclusive no total; ADM/Gestor veem todos.
Lista ordenada por id DESC; dados e total lidos no mesmo snapshot.

## 201 — Criação confirmada

```json
{"data":{"id":"1024","codigo":"TRP-1024","codigoExibicao":"#TRP-1024","solicitante":{"id":"42","nome":"Solicitante"},"origem":"Sede","destino":"Unidade","finalidade":"Visita institucional","dataHoraSaida":"2026-11-10T08:00:00.000000-03:00","qtdPassageiros":3,"status":"PENDENTE"}}
```

Código deriva da sequência existente, sem número inicial artificial, padding ou
conversão para Number. Armazenado sem #; codigoExibicao acrescenta #. UNIQUE
protege a gravação. Criação e evento de auditoria confirmam na mesma transação;
falha de auditoria reverte o INSERT. Repetir POST após perda de resposta pode criar
outro pedido: não há chave de idempotência.

## 200 — Consulta paginada

```json
{"data":[],"meta":{"page":1,"limit":20,"total":0}}
```

Itens usam o DTO do POST. Preserva finalidade, passageiros e status nullable
dos antigos. Solicitante pode ser null quando a referência antiga for nula;
quando presente contém apenas id e nome, sem email. IDs são strings BIGINT.

## 400 — Entrada ou consulta inválida

```json
{"error":{"code":"DADOS_INVALIDOS","message":"Revise os campos informados.","fields":{"qtdPassageiros":"Informe um valor válido, sem campos adicionais."}}}
```

JSON malformado usa JSON_INVALIDO no mesmo envelope, com mensagem em português.

## 401 — Sem sessão válida, usuário ausente ou inativo

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

## 403 — Perfil sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

## 404 — Referência inexistente no POST

```json
{"error":{"code":"REFERENCIA_INEXISTENTE","message":"O solicitante não foi encontrado."}}
```

Mapeia FK 23503, inclusive exclusão concorrente após validar a sessão.

## 409 — Conflito de código

```json
{"error":{"code":"CODIGO_DUPLICADO","message":"Já existe uma solicitação com esse código."}}
```

UNIQUE 23505 recebe 409. Se TRP-n ultrapassar varchar(20), responde
CODIGO_FORA_DO_LIMITE, sem truncar ou alterar o esquema.

## 413 — Corpo acima do limite

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

## 415 — Tipo de corpo incompatível

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

Ausência de Content-Type mantém a tolerância do leitor HTTP compartilhado.

## 405 — Método não permitido

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

Inclui Allow: POST, GET, antes da autenticação no dispatcher.

## 500 — Falha inesperada

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

Sem SQL, stack ou payload privado. Respostas incluem X-Request-Id.

## Requisição mínima

```http
POST /api/solicitacoes-viagem HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{"origem":"Sede","destino":"Unidade","finalidade":"Visita institucional","dataHoraSaida":"2026-11-10T08:00:00-03:00","qtdPassageiros":3}
```

Consulta: GET /api/solicitacoes-viagem?page=1&limit=20&status=PENDENTE.

## Convenção temporal e dependência do esquema

Decisão confirmada: saída armazenada como horário civil America/Maceio em
timestamp without time zone. INSERT converte o instante recebido por
`::timestamptz AT TIME ZONE 'America/Maceio'`: 11:00Z vira 08:00 local.
A leitura formata a coluna diretamente e acrescenta -03:00, sem passar por Date
ou pelo fuso do processo. Nenhum registro antigo é alterado. A apresentação
dos antigos como horários institucionais é uma hipótese explícita, não uma
confirmação de seu significado histórico. Sem regra de antecedência/data futura.

Entradas temporais rejeitam ano zero, offset fora de ±15:59 e normalização que
saia dos anos 0001–9999 no horário institucional, inclusive carry de arredondamento
de frações para microssegundos. Erro 400 antes de consultar ou gravar dados. Essa
validação também vale para PATCH, agendamento, reagendamento, agenda e disponibilidade.

Coluna finalidade TEXT NULL confirmada pelo responsável como aplicada manualmente
no Supabase; ainda não consta da baseline isolada. Esta entrega não lê credenciais,
cria DDL, migration ou snapshot. O banco de destino precisa conter essa coluna.
Falta versionar/reconciliar essa alteração em tarefa autorizada.

Testes sem banco: `npx vitest run --config backend/tests/solicitacoes.config.ts`.
Mocks verificam HTTP, escopo, parâmetros SQL e falhas transacionais; não comprovam
persistência, rollback, unicidade ou conversão temporal no PostgreSQL real.

## O que a entrega não faz

POST de criação e GET não fazem aprovação, reprovação, edição, alocação, agenda, retorno previsto, execução
de viagem ou mudanças de SVO. Sem cancelamento: diferença em relação à SCRUM-155,
pois o protótipo não apresenta essa ação. Novas ações exigem endpoints/permissões
e auditoria próprios. A SCRUM-138 acrescenta decisões e seus eventos, conforme contrato específico.
