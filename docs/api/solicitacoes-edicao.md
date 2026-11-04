# Edição de solicitações de transporte — SCRUM-155 / BE-S7-02

PATCH /api/solicitacoes-viagem/{id}. Bearer JWT e usuário ativo atual; exclusivo
de ADM/GESTOR_FROTA. Corpo JSON estrito até 64 KiB, com ao menos um campo:
origem, destino, finalidade, dataHoraSaida ou qtdPassageiros.

Mesmas validações do POST: textos não vazios após trim; origem/destino até 255
caracteres; passageiros inteiro positivo compatível com INTEGER; saída ISO 8601
com offset explícito. Campos omitidos são preservados. Null é rejeitado, não
remove dados. Campos de recursos, retorno, código, identidade e estado recebem 400.
ID decimal não negativo dentro de BIGINT; fora do limite: 400, formato de caminho
desconhecido: 404.

## 200 — Edição confirmada

```json
{"data":{"id":"1024","codigo":"TRP-1024","codigoExibicao":"#TRP-1024","solicitante":{"id":"42","nome":"Solicitante"},"origem":"Nova sede","destino":"Unidade","finalidade":"Visita institucional","dataHoraSaida":"2026-11-10T08:00:00.000000-03:00","qtdPassageiros":3,"status":"PENDENTE"}}
```

PENDENTE permanece PENDENTE. APROVADA volta a PENDENTE e exige nova análise,
inclusive quando os valores enviados coincidem com os atuais. Cada PATCH válido
e confirmado registra uma atividade; não há detecção de ausência de mudança.
Código e solicitante originais permanecem iguais. Nome no DTO pertence ao
solicitante; responsável pela edição é registrado separadamente na auditoria.

## 400 — Campos, JSON ou ID inválidos

```json
{"error":{"code":"DADOS_INVALIDOS","message":"Revise os campos informados.","fields":{"origem":"Informe um valor válido, sem campos adicionais."}}}
```

Corpo vazio também recebe 400. JSON malformado usa JSON_INVALIDO no envelope comum.
Violação CHECK 23514 usa DADOS_INVALIDOS, sem expor SQL ou alterar a constraint.

## 401 — Sessão inválida, usuário inexistente ou inativo

```json
{"error":{"code":"NAO_AUTENTICADO","message":"Autenticação necessária."}}
```

## 403 — Solicitante ou outro perfil sem permissão

```json
{"error":{"code":"ACESSO_NEGADO","message":"Acesso não permitido."}}
```

## 404 — Pedido inexistente

```json
{"error":{"code":"NAO_ENCONTRADO","message":"Solicitação não encontrada."}}
```

FK do responsável excluído concorrentemente recebe REFERENCIA_INEXISTENTE.

## 409 — Estado incompatível

```json
{"error":{"code":"ESTADO_INCOMPATIVEL","message":"Somente solicitações pendentes ou aprovadas podem ser editadas."}}
```

AGENDADA, PRONTA_PARA_INICIAR, EM_ANDAMENTO, CONCLUIDA, REPROVADA e estado nulo
não permitem edição. Não altera reserva, retorno previsto, motorista ou veículo.

## 413 — Corpo excessivo

```json
{"error":{"code":"CORPO_MUITO_GRANDE","message":"Corpo da requisição muito grande."}}
```

## 415 — Tipo de corpo incompatível

```json
{"error":{"code":"TIPO_NAO_SUPORTADO","message":"Envie o corpo como application/json."}}
```

## 405 — Método não permitido no caminho de edição

```json
{"error":{"code":"METODO_NAO_PERMITIDO","message":"Método não permitido."}}
```

Allow: GET, PATCH (o mesmo caminho oferece detalhes desde SCRUM-157), antes da autenticação. Todas as respostas incluem X-Request-Id.

## 500 — Falha inesperada, incluindo auditoria

```json
{"error":{"code":"ERRO_INTERNO","message":"Não foi possível concluir a requisição."}}
```

## Requisição mínima

```http
PATCH /api/solicitacoes-viagem/1024 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{"origem":"Nova sede"}
```

## Transação e horário

READ COMMITTED e SELECT FOR UPDATE serializam edição com outras edições,
aprovação, rejeição e agendamento na mesma solicitação. Estado é verificado depois
do lock; UPDATE também restringe PENDENTE/APROVADA. Campos omitidos usam o valor
atual no banco, não um snapshot recebido do cliente. Edições válidas sucessivas
podem confirmar; no mesmo campo prevalece a última na ordem de execução. Não há
ETag, versão nem detecção de formulário antigo. Auditoria registra cada edição.

UPDATE e log_atividade com o responsável da sessão usam a mesma transação; falha
do log reverte a alteração. Texto privado do pedido não é copiado para a descrição:
Editou a solicitação de transporte ID n.

Saída recebida é normalizada com AT TIME ZONE America/Maceio e armazenada como
timestamp without time zone. Retorna o horário local com -03:00. Horário omitido
permanece exatamente como estava; não converte histórico em massa.

## O que a entrega não faz

Cancelamento consta da tarefa, mas não foi identificado no protótipo: não há
endpoint, estado ou ação de cancelamento nesta entrega. O frontend disponível
tem apenas botão Editar demonstrativo; campos e estados deste contrato foram
confirmados explicitamente pelo responsável.

Sem edição de reservas, solicitante, código ou identidade do responsável pelo
corpo; sem nova migration, DDL, alteração do SVO ou política de disponibilidade.
Mocks verificam fluxo e parâmetros SQL; locks, rollback e concorrência real
continuam pendentes de prova no PostgreSQL isolado.
