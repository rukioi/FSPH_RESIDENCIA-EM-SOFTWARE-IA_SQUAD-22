# API — SVO (SCRUM-130 / SCRUM-131)

## Registro telefônico e consulta inicial

Todas as rotas SVO exigem JWT Bearer de usuário ativo com perfil efetivo `ATENDENTE_SVO`. A população comunica ocorrências por telefone, sem conta ou token. O backend extrai `atendente_id` da sessão autenticada, nunca do corpo JSON.

| Método | Rota | Responsabilidade |
| --- | --- | --- |
| POST | `/api/svo/solicitacoes` | Registrar **somente** ocorrência pendente; não cria ordem de coleta |
| GET | `/api/svo/solicitacoes` | Consultar até 20 solicitações recentes, sem informação pessoal |
| GET | `/api/svo/solicitacoes?status=AGUARDANDO_TRIAGEM` | Filtrar por triagem; aceita também CONFIRMADA_SVO e ENCAMINHADA_IML |
| GET | `/api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO` | Legado: consulta ordens já existentes aguardando despacho |
| PATCH | `/api/svo/solicitacoes/:id/triagem` | Salvar rascunho sem decidir nem criar ordem |
| POST | `/api/svo/solicitacoes/:id/triagem` | Finalizar SVO ou IML; ordem apenas para SVO confirmado |
| PATCH | `/api/svo/ordens-coleta/:id/despachar` | Legado: despacho; refatoração na SCRUM-132 |

Filtros de período, paginação extensiva, detalhe, consulta por ID e histórico pertencem à SCRUM-146. Dashboard de indicadores é SCRUM-149.

## POST /api/svo/solicitacoes

Campos obrigatórios: `localFalecimento` (1–255 caracteres), `enderecoRemocao` (1–255) e `solicitanteNome` (1–150). Dados são normalizados removendo espaços nas extremidades.

Opcionais: `nomeFalecido` (até 150 caracteres), `solicitanteParentesco` (até 50), `solicitanteTelefone` (7–20, formato telefônico), `observacoesMedicas` (até 2.000), `pontoReferencia` (até 255) e `canalAtendimento` (somente `TELEFONE`). Não são aceitos campos internos ou extras como `atendenteId`, `perfil`, `statusTriagem`, CPF e nascimento. JSON até 64 KiB.

**Exemplo fictício:**

```json
{
  "localFalecimento": "Unidade fictícia",
  "enderecoRemocao": "Rua de teste, 123",
  "solicitanteNome": "Pessoa fictícia",
  "pontoReferencia": "Próximo ao terminal",
  "canalAtendimento": "TELEFONE"
}
```

**201 Created**:

```json
{
  "solicitacao": {
    "id": "10",
    "codigo": "#SVO-10",
    "statusTriagem": "AGUARDANDO_TRIAGEM",
    "criadoEm": "2026-11-04T12:00:00.000Z"
  },
  "atividades": ["Solicitação #SVO-10 registrada por telefone"]
}
```

A resposta **não** tem `ordemColeta` porque RN07 exige confirmação posterior da triagem SVO (SCRUM-131). Os IDs `BIGINT` são strings, evitando perda de precisão. Cadastro e auditoria são transacionais: falha de atividade cancela o registro. Nenhum dado médico ou pessoal é colocado na descrição do evento.

O POST não possui chave de idempotência aprovada. Repetir uma solicitação HTTP válida pode gerar outro protocolo; não assumir que dois cadastros com mesmos campos sejam duplicados.

## GET /api/svo/solicitacoes

A consulta inicial retorna os **20 registros mais recentes**, ordenados por `criado_em DESC NULLS LAST, id DESC`, opcionalmente com um único filtro `status`. A resposta não expõe nome do falecido, solicitante, telefone nem observações.

**200 OK**:

```json
[
  {
    "id": "10",
    "codigo": "#SVO-10",
    "status_triagem": "AGUARDANDO_TRIAGEM",
    "criado_em": "2026-11-04T12:00:00.000Z"
  }
]
```

Registros legados podem ter `status_triagem: null` e devem ser conciliados pela equipe de banco, não classificados automaticamente.

## Erros e segurança

**400**: dados de entrada/campos extras/filtro de status inválidos; **401**: sessão inexistente ou inválida; **403**: perfil não autorizado; **405**: método inválido, header `Allow`; **409**: conflito de unicidade do protocolo; **413**: corpo excessivo; **415**: tipo de mídia diferente de JSON; **500**: erro interno sem informações pessoais. Erros 4xx usam envelope `{"error":{"code":"HTTP_400","message":"..."}}` (exceto códigos especializados já existentes). `X-Request-Id` acompanha toda resposta.

## Triagem SVO/IML — SCRUM-131

As operações abaixo exigem JWT do perfil `ATENDENTE_SVO` e ID decimal positivo de até
64 bits. Solicitação inexistente retorna 404; solicitação com triagem já concluída ou
registro legado sem status conciliado retorna 409. O usuário responsável é obtido
da sessão, nunca do JSON. Não se publicam informações médicas em atividades de auditoria.

### PATCH /api/svo/solicitacoes/:id/triagem

Corpo estrito: `{"triagemObservacoes":"Observações fictícias do rascunho"}`.
O campo deve conter entre 1 e 2.000 caracteres após `trim`.
O rascunho pode ser salvo novamente e altera somente `triagem_observacoes`, mantendo
`status_triagem=AGUARDANDO_TRIAGEM`, `triado_por_id=NULL`, `triado_em=NULL`
e nenhuma ordem vinculada. Responde 200 com:

```json
{
  "solicitacaoId": "10",
  "statusTriagem": "AGUARDANDO_TRIAGEM",
  "triagemObservacoes": "Observações fictícias do rascunho",
  "atividades": ["Rascunho da triagem de #SVO-10 atualizado"]
}
```

### POST /api/svo/solicitacoes/:id/triagem

Duas decisões definitivas mutuamente exclusivas:

```json
{"decisao":"CONFIRMADA_SVO","triagemObservacoes":"Justificativa fictícia","quantidadeCorpos":1}
```

```json
{"decisao":"ENCAMINHADA_IML","triagemObservacoes":"Justificativa fictícia"}
```

A quantidade é explícita e só aceita inteiros de 1 a 4 para SVO; não há valor padrão.
O campo de observação é exigido nos dois resultados. O endpoint responde 200 com
`solicitacao` (ID, protocolo, status, responsável e instante), `ordemColeta`
(ID, protocolo #OC, status `PENDENTE_ALOCACAO` e quantidade), ou `null` no
ramo IML, e `atividades`. O protocolo #OC é derivado do ID existente da ordem.

Estado, eventual ordem e auditoria são persistidos na mesma transação.
A linha da solicitação é bloqueada com `FOR UPDATE`; decisões repetidas ou simultâneas
não sobrescrevem a primeira decisão nem geram outra ordem. O banco conserva a
constraint `UNIQUE` sobre o vínculo da ordem. Retorna 409 em novo POST de decisão concluída.

Corpos/IDs inválidos retornam 400; ausência de sessão, 401; perfil indevido, 403;
recurso inexistente, 404; concorrência/estado inválido, 409; mídia/corpo excedido,
415/413; falha técnica, 500, com rollback.

**Integração:** os nomes de campos e as exigências de justificativa/quantidade devem
ser validados com o responsável por BL27 antes do acoplamento da UI (SCRUM-150).
Consulta detalhada e histórico geral pertencem à SCRUM-146; indicadores à SCRUM-149.
A implementação não aplica migration ao banco compartilhado.

## Dependências de banco e subtasks

A [migration versionada da SCRUM-162](../../backend/src/database/supabase/migrations/20261103000000_db_s7_01_svo_triagem.sql) define os campos `status_triagem`, `canal_atendimento`, `ponto_referencia` e outros; **não está aplicada ao Supabase remoto**. Desenvolvimento, migração e testes devem usar o PostgreSQL Docker **isolado**; nenhuma DDL/seed no Supabase compartilhado por esta PR.

**SCRUM-131:** triagem/IML e criação única de ordem; **SCRUM-132:** despacho; **SCRUM-145:** RBAC por recurso/equipe; **SCRUM-146:** consultas detalhadas, filtros e histórico; **SCRUM-147:** lotação S10; **SCRUM-149:** indicadores; **SCRUM-205/208:** RLS/ACL e rollout.

Fonte de contrato: `backend/src/shared/contract/registry.ts`. Executar `npm run api:generate`, `npm run client:generate`, `npm run api:check` e `npm run client:check` após alterar os schemas/rotas. Não editar artefatos gerados manualmente.

## Operação da frota SVO — SCRUM-132/145/147/148

O contrato de consulta de candidatos, lotação 0/4 e execução própria do motorista está em
[svo-operacional-sprint7.md](./svo-operacional-sprint7.md). A autorização do motorista é
verificada pelo vínculo de `motorista.usuario_id`, não pelo ID recebido no corpo. O antigo
GET/triagem/dashboard do atendente não foi aberto ao motorista.

## Disponibilidade compartilhada com o transporte institucional

O despacho existente mantém as verificações de referência e estado dos recursos.
Bloqueia motorista e depois veículo na mesma ordem usada pelo agendamento
institucional, em transação READ COMMITTED. Após adquirir os locks, consulta
reservas AGENDADA, PRONTA_PARA_INICIAR e EM_ANDAMENTO; inclusive reservas futuras
bloqueiam o despacho, pois o SVO não informa retorno previsto. Ordens SVO
EM_DESLOCAMENTO e EM_TRANSPORTE bloqueiam conservadoramente os recursos no
fluxo institucional. Não inventar janela de liberação. Conflito retorna 409.

O registro telefônico da SCRUM-130 continua sem criar ordem: a integração de
disponibilidade não antecipa triagem ou geração de ordem da SCRUM-131.

## Consultas adicionais — SCRUM-146

Os seis GETs de consulta, detalhe e histórico, sem mudança de comportamento das rotas legadas, estão descritos em [svo-consultas-scrum146.md](./svo-consultas-scrum146.md). O detalhe da solicitação permite recuperar a triagem parcial e não realiza decisão. O histórico só reproduz eventos reais conhecidos e não presume que despacho/execução já sejam auditados.

## Indicadores operacionais — SCRUM-149

As três rotas de dashboard, filas e atividades próprias do SVO estão documentadas em [svo-dashboard-scrum149.md](./svo-dashboard-scrum149.md). Nenhum contrato do Dashboard institucional foi alterado.
