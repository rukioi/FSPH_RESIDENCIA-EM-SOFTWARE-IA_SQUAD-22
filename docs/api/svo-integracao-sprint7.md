# Integração paralela SVO — Sprint 7 (SCRUM-132/145/146/147/148/149)

> Documento de coordenação e rastreabilidade; **não é evidência de API implementada nem de aceite**. Fonte de verdade: AGENTS.md, docs/api/svo.md, docs/permissoes.md, migrations versionadas, Jira das seis subtarefas e contratos gerados. Não substituir as histórias por regras inventadas.

## Objetivo e entregas independentes

Manter uma única base de integração backend–frontend, com commits rastreáveis por SCRUM, sem alterações diretas na main, no Supabase compartilhado, em .env ou em arquivos gerados. Nenhuma tela operacional pode usar mocks. PR somente após integração de contratos, migrations isoladas e testes.

| Tarefa | Responsabilidade exclusiva | Dependência/gate |
| --- | --- | --- |
| [SCRUM-145](https://unit-tiradentes.atlassian.net/browse/SCRUM-145) | Matriz RBAC por perfil efetivo **e vínculo da ordem**; 401/403/404 e DTO mínimo para equipe | O enum `perfil_usuario` só possui ADM, GESTOR_FROTA, SOLICITANTE_INTERNO, MOTORISTA e ATENDENTE_SVO; definição de Equipe SVO e vínculo de usuário/equipe requer reconciliação versionada |
| [SCRUM-147](https://unit-tiradentes.atlassian.net/browse/SCRUM-147) | Serviço comum de ocupação 0..4 por S10, locks, concorrência, reserva/liberação | `ordem_coleta.quantidade_corpos` existe; não contar ordens como corpos nem inferir veículos pela placa/ID. Confirmar fase de reserva e tratamento de ordens legadas com quantidade NULL |
| [SCRUM-132](https://unit-tiradentes.atlassian.net/browse/SCRUM-132) | Elegibilidade efetiva e preparação/despacho transacional | Consumir SCRUM-147 e RBAC SCRUM-145; preservar alocação compartilhada com viagens institucionais. CNH, documento e jornada precisam de política rastreável |
| [SCRUM-148](https://unit-tiradentes.atlassian.net/browse/SCRUM-148) | Consulta de ordens atribuídas, execução, etapas, km, evidências e conclusão/cancelamento autorizado | Depende de despacho, identidade vinculada à ordem e máquina de estados aprovada; não criar `PRONTA_PARA_INICIAR` para SVO sem migração/decisão; reutilizar serviço de anexos |
| [SCRUM-146](https://unit-tiradentes.atlassian.net/browse/SCRUM-146) | Consulta paginada, detalhes retomáveis de rascunho e histórico real de solicitações/ordens | Pode avançar independentemente de despacho; manter endpoint GET legado sem quebrar formato; não expor dados médicos em listas |
| [SCRUM-149](https://unit-tiradentes.atlassian.net/browse/SCRUM-149) | IND-07 e IND-10 a IND-14 em agregações SQL reais | Pode avançar independentemente de equipe: IND-10 é fila atual sem filtro de criação; decisões do período usam instante de decisão, não `criado_em`; ordem gerada precisa de base temporal comprovável |

## APIs existentes na main (não alterar sem compatibilidade)

- `POST /api/svo/solicitacoes`: registra ocorrência; não cria ordem.
- `GET /api/svo/solicitacoes?status=`: lista legado limitada a 20 registros, array direto.
- `PATCH /api/svo/solicitacoes/{id}/triagem`: grava rascunho.
- `POST /api/svo/solicitacoes/{id}/triagem`: decide SVO/IML; ordem somente para SVO.
- `GET /api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO`: consulta legado de ordens pendentes.
- `PATCH /api/svo/ordens-coleta/{id}/despachar`: despacho legado existente; **não atende ainda** a todas as guardas de 132/147.

## Propostas do Jira para contrato FE (não disponíveis até implementação e CI)

### SCRUM-146 — consultas e retomada
- `GET /api/svo/solicitacoes/{id}`: detalhe operacional autorizado, inclusive `triagemObservacoes` do rascunho e ordem associada se houver.
- `GET /api/svo/solicitacoes/{id}/historico` e `GET /api/svo/ordens-coleta/{id}/historico`: eventos reais cronológicos, sem forjar eventos ausentes.
- `GET /api/svo/ordens-coleta/{id}`: detalhe autorizado.
- Paginação/filtros do GET legado devem passar por contrato explícito ou nova operação para preservar consumidores do array existente.

### SCRUM-149 — indicadores
- `GET /api/svo/dashboard?periodo=hoje|7d|30d`.
- `GET /api/svo/dashboard/filas`.
- `GET /api/svo/dashboard/atividades?limite=`.
- IND-10: contagem real de `AGUARDANDO_TRIAGEM` em todas as datas. IND-11/13: decisões no período. IND-12: ordens geradas no período (sem inventar timestamp ausente). IND-14: distribuição por estado com coorte temporal documentada. IND-07: eventos persistidos de SVO, filtro por origem confiável, sem dados pessoais.

### SCRUM-132/147 — elegibilidade/ocupação
- `GET /api/svo/recursos-disponiveis?inicio=&fim=` e `GET /api/svo/veiculos/{id}/ocupacao` são **propostas**, ainda não contratos estáveis.
- A consulta apenas informa elegibilidade; toda operação de despacho revalida em transação e retorna 409 em disputa.
- S10 própria: usar sinalização real `veiculo.is_svo`, status, capacidade configurada/documentos; DVP §6.2 exige limite físico de quatro corpos; reconciliar as três S10 efetivamente cadastradas, sem inventar IDs.
- A regra compartilhada de exclusividade de frota hoje bloqueia veículo com ordem SVO ativa; conciliar com eventual coocupação de ordens antes de alterar transação.

### SCRUM-145/148 — equipe e execução
- `GET /api/svo/ordens-coleta/minhas`, `PATCH /api/svo/ordens-coleta/{id}/iniciar`, `/etapa`, `/concluir` e `POST .../evidencias` são propostas.
- `MOTORISTA` existe, mas não equivale automaticamente a `EQUIPE_SVO`. A tabela `motorista.usuario_id` permite associação motorista–usuário; não presume equipe.
- Estados SVO existentes no banco: `PENDENTE_ALOCACAO`, `EM_DESLOCAMENTO`, `EM_TRANSPORTE`, `CONCLUIDA`, `CANCELADA`. A nova transição “pronta para iniciar” não é um estado persistido aprovado desse enum.
- km inicial/final e campos de foto já existem em `ordem_coleta`; validar autoria, momento da exigência, upload/tipo/tamanho e vínculo antes de expor operações.

## Contrato mínimo de integração do frontend

1. FE não filtra elegibilidade por `status === DISPONIVEL` isoladamente; o backend decide CNH, capacidade, ocupação, uso compartilhado e condições documentadas.
2. Identificadores PostgreSQL `BIGINT` via API devem ser strings; nunca converter para `Number` nos novos DTOs.
3. `401` = sessão inválida/ausente; `403` = perfil sem permissão; `404` = recurso inexistente/não visível onde aplicável; `409` = estado/ocupação/concorrência inválidos. Não afirmar sucesso antes de confirmação da API.
4. Retomar triagem não realiza POST de decisão; apenas GET detalhe e PATCH rascunho.
5. Fila atual do dashboard não é zerada por filtro de período; falha de banco não é contador zero.
6. A integração FE de novas rotas só começa após implementação, documentação de request/response em Zod/registry, OpenAPI/cliente regenerados e 401/403/404/409 validados.

## Gates técnicos compartilhados

- Código no módulo próprio; mudanças transversais pequenas e justificadas. Evitar seis equipes editando o mesmo `svo.repository.ts`/`svo.routes.ts` simultaneamente; contratos compartilhados integrados de forma serial e auditável.
- Migration aditiva versionada em `backend/src/database/supabase/migrations/`, teste PostgreSQL isolado, schema/metadados/DER atualizados quando necessário; sem DDL ou seed no banco compartilhado.
- Registro de atividades atômico às transições; não construir timeline fingindo vínculos que não existem em `log_atividade`.
- Sem alterar a matriz dos demais épicos, e sem expor dados pessoais no dashboard/listas.
- Validação antes do PR: `db:test:prepare`, `db:docs:check`, `api:generate`, `client:generate`, `api:check`, `client:check`, `lint`, `typecheck`, `test:db`, `test`, `build`, `test:e2e`, além de HTTP/SQL e capturas sem credenciais.
- PR e Jira com evidências por subtask. Nenhum aceite automático, merge/deploy ou alteração em `main` pelo assistente.
