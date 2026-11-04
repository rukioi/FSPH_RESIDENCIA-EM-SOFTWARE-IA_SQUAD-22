# API — SVO (SCRUM-130)

## Registro telefônico e consulta inicial

Todas as rotas SVO exigem JWT Bearer de usuário ativo com perfil efetivo `ATENDENTE_SVO`. A população comunica ocorrências por telefone, sem conta ou token. O backend extrai `atendente_id` da sessão autenticada, nunca do corpo JSON.

| Método | Rota | Responsabilidade |
| --- | --- | --- |
| POST | `/api/svo/solicitacoes` | Registrar **somente** ocorrência pendente; não cria ordem de coleta |
| GET | `/api/svo/solicitacoes` | Consultar até 20 solicitações recentes, sem informação pessoal |
| GET | `/api/svo/solicitacoes?status=AGUARDANDO_TRIAGEM` | Filtrar por triagem; aceita também CONFIRMADA_SVO e ENCAMINHADA_IML |
| GET | `/api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO` | Legado: consulta ordens já existentes aguardando despacho |
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

**400**: dados de entrada/campos extras/filtro de status inválidos; **401**: sessão inexistente ou inválida; **403**: perfil não autorizado; **405**: método inválido, header `Allow`; **409**: conflito de unicidade ou atendente; **413**: corpo excessivo; **415**: tipo de mídia diferente de JSON; **500**: erro interno sem informações pessoais. Erros 4xx usam envelope `{"error":{"code":"HTTP_400","message":"..."}}` (exceto códigos especializados já existentes). `X-Request-Id` acompanha toda resposta.

## Dependências de banco e subtasks

A [migration versionada da SCRUM-162](../../backend/src/database/supabase/migrations/20261103000000_db_s7_01_svo_triagem.sql) define os campos `status_triagem`, `canal_atendimento`, `ponto_referencia` e outros; **não está aplicada ao Supabase remoto**. Desenvolvimento, migração e testes devem usar o PostgreSQL Docker **isolado**; nenhuma DDL/seed no Supabase compartilhado por esta PR.

**SCRUM-131:** triagem/IML e criação única de ordem; **SCRUM-132:** despacho; **SCRUM-145:** RBAC por recurso/equipe; **SCRUM-146:** consultas detalhadas, filtros e histórico; **SCRUM-147:** lotação S10; **SCRUM-149:** indicadores; **SCRUM-205/208:** RLS/ACL e rollout.

Fonte de contrato: `backend/src/shared/contract/registry.ts`. Executar `npm run api:generate`, `npm run client:generate`, `npm run api:check` e `npm run client:check` após alterar os schemas/rotas. Não editar artefatos gerados manualmente.
