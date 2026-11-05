# SCRUM-146 — consultas SVO (recorte funcional)

**Fonte:** backend/src/modules/svo/svo.consultas.*. Todas as rotas exigem JWT Bearer válido de usuário ativo com perfil efetivo `ATENDENTE_SVO`. Requisição sem sessão: 401; outro perfil: 403; ID inexistente: 404; entrada inválida: 400. Consultas não alteram estado nem geram ordem.

O GET legado `/api/svo/solicitacoes?status=` permanece **array direto de até 20 itens** e o GET legado `/api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO` permanece inalterado. Novas telas devem usar os endpoints paginados abaixo.

| Método | Endpoint | Resposta | Observações |
| --- | --- | --- | --- |
| GET | `/api/svo/solicitacoes/paginadas?page=1&limit=20&status=&inicio=&fim=` | `{data:[],meta:{page,limit,total}}` | `status` opcional, `inicio/fim` datas `YYYY-MM-DD` inclusivas, com comparação em data civil persistida, até 100 itens por página. Omitir parâmetros não usados, sem `status=` vazio. |
| GET | `/api/svo/solicitacoes/{id}` | `DetalheSolicitacaoSvo` | Recupera rascunho `triagemObservacoes`, decisão, origem e eventual ordem. Dados pessoais/médicos exclusivamente no detalhe com RBAC atendente. Nunca realiza decisão. |
| GET | `/api/svo/solicitacoes/{id}/historico?page=1&limit=20` | `{data:[],meta}` | Auditoria realmente persistida e ordenada; sem eventos artificiais. |
| GET | `/api/svo/ordens-coleta/paginadas?page=1&limit=20&status=` | `{data:[],meta}` | Ordens, inclusive finalizadas, sem dados pessoais na lista. |
| GET | `/api/svo/ordens-coleta/{id}` | `DetalheOrdemSvo` | Estado, quantidade de corpos, vínculo ao protocolo e recursos/quilometragem quando existentes. |
| GET | `/api/svo/ordens-coleta/{id}/historico?page=1&limit=20` | `{data:[],meta}` | Somente eventos fechados existentes da ordem, não transições hipotéticas. |

IDs PostgreSQL `BIGINT` são sempre strings e passam por validação contra o limite assinado de 64 bits. Paginação só aceita inteiros seguros, máximo 100. Filtros não declarados e parâmetros duplicados recebem 400. Datas são civis na base (`timestamp without time zone`); não se inventa conversão de instante histórico.

**Limitação importante:** `log_atividade` não possui FK de solicitação/ordem SVO. A recuperação histórica nesse recorte consulta **exclusivamente descrições exatas dos eventos SVO conhecidos** (`solicitacao_registrada`, `solicitacao_confirmada`, três eventos de triagem e `ordem_gerada`), inclusive repetições realmente gravadas; não representa auditoria estruturada de despacho ou execução. Eventos futuros devem ter vínculo explícito em migration versionada quando a política for aprovada; não inferir vínculo de textos livres. Acesso restrito a ATENDENTE_SVO, sem email/CPF/telefone no histórico.

**FE:** SCRUM-150 usa detalhe para recuperar observações parciais; SCRUM-152 consulta histórico real. Não confiar em filtro visual como autorização.

**Validação antes do PR:** `npm run api:generate`, `npm run client:generate`, `npm run api:check`, `npm run client:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e testes reais/E2E no PostgreSQL Docker isolado. O pacote não inclui gerados editados manualmente nem resultados de testes não executados.
