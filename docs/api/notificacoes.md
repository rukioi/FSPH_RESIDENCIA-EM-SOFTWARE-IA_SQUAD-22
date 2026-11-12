# Notificações internas

Caixa individual persistida em PostgreSQL; sessão atual e conta ativa obrigatórias.
ADM, GESTOR_FROTA, SOLICITANTE_INTERNO, MOTORISTA e ATENDENTE_SVO acessam somente
os próprios avisos. Não há destinatário informado pelo cliente. ID de outra caixa
recebe o mesmo 404 de ID inexistente. Não há conteúdo médico, CPF ou contato nos avisos.

| Método | Caminho | Resposta |
| --- | --- | --- |
| GET | `/api/notificacoes?page=1&limit=20&filtro=todas` | `{data,meta:{page,limit,total,naoLidas}}` |
| POST | `/api/notificacoes/:id/ler` | `{data:{atualizadas:1}}` |
| POST | `/api/notificacoes/ler-todas` | `{data:{atualizadas:n}}` |
| POST | `/api/notificacoes/sincronizar` | `{data:{atualizadas:n}}` |

GET tem query estrita: page inteiro positivo até 1.000.000, limit 1..100,
filtro `todas`, `nao-lidas` ou `lidas`; duplicatas/campos desconhecidos recebem 400.
Ordenação criadoEm DESC, id DESC. Página e contadores compartilham snapshot;
naoLidas conta toda a caixa, independentemente do filtro/página.

Exemplo de item: `{id:"1",titulo:"Solicitação aprovada",descricao:"Solicitação #TRP-10",
categoria:"sucesso",criadoEm:"2026-11-09T12:00:00.000Z",lidaEm:null}`.
Categorias: informacao, atencao, urgente e sucesso. Datas ISO com fuso.

POST não exige corpo; conteúdo enviado é ignorado. Leitura individual é idempotente,
preserva o primeiro lidaEm; ler-todas altera as não lidas visíveis ao UPDATE,
incluindo páginas não carregadas, sem consumir avisos criados posteriormente.
Erros comuns: 400 entrada inválida, 401 sessão inválida/inativa, 404 aviso
ausente/alheio, 405 método e 500 técnico genérico. O GET não grava dados.

## Origem e atualização

Solicitação criada/editada/aprovada/recusada/agendada/reagendada avisa ADM/Gestor e
solicitante; agendamento/reagendamento também avisa o motorista vinculado por
motorista.usuario_id. Despacho/cancelamento SVO avisa o motorista vinculado, sem
informações sensíveis. Mudança efetiva do veículo para EM_MANUTENCAO avisa a gestão.
Avisos e operação confirmam/revertem na mesma transação. Não há backfill de eventos
históricos nem notificações para contas inativas; destinatários são os atuais no evento.

A sincronização materializa CNHs/documentos com vencimento em até **30 dias**, incluindo
vencidos, somente para a própria caixa ADM/Gestor. Para outros perfis é sucesso com
zero alterações. A data de referência usa America/Maceio. Unicidade por destinatário,
recurso, validade e faixa (próximo/vencido) evita repetição e permite novo aviso ao
vencer/renovar. Alertas antigos permanecem como histórico, mesmo após renovação.
Não há scheduler, email, push ou websocket: a aplicação sincroniza ao consultar a
caixa, após operações confirmadas no cliente comum, ao recuperar foco e a cada 60s
enquanto visível. Janela de 30 dias é o critério
inicial desta entrega, pois o documento de requisitos não define antecedência.

## Rollout e aceite

- [x] Tela responsiva, filtros, paginação, contador compartilhado e leitura confirmada.
- [x] Contrato global e cliente gerados a partir dos schemas.
- [x] Migration incremental, acesso direto anon/authenticated revogado e RLS habilitada.
- [ ] Aplicar migration e executar testes HTTP/banco no harness de origem comprovada.
- [ ] Regenerar schema.sql, schema-metadata.json e der.mmd do banco isolado.
- [x] Aplicar migration remota autorizada e conferir histórico, estrutura e acesso direto.
- [ ] Confirmar o papel usado pelo backend publicado e executar o fluxo HTTP nesse ambiente.

A migration está em `backend/src/database/supabase/migrations/20261109100000_add_notificacoes.sql`.
O dono da tabela mantém acesso; um papel backend distinto precisa de grants/policy
explicitamente revisados. A aplicação remota autorizada está registrada abaixo. Revert do código
não remove tabela nem histórico. No checkout desta implementação o harness recusou
volume/container preexistente sem comprovante; não se apagou/adotou essa instância.
Os snapshots não foram editados manualmente. A entrega exige aplicação da migration
antes de ativar o código que produz avisos transacionais.

## Verificação no checkout

Typecheck, build, checks de API/cliente e lint dos arquivos alterados passaram.
56 testes selecionados passaram (serviço/validação de notificações, autenticação,
controle de rotas e regressões de veículos/solicitações com bancos simulados).
Seis E2E com API controlada passaram: leitura/filtros nos três tamanhos,
falha de escrita, JSON inválido e espera pela confirmação do servidor.
Capturas 390/768/1280 foram inspecionadas e ficam em `test-results/notificacoes-ui/`.
Esses testes não substituem a prova PostgreSQL. O teste real
`backend/tests/integration/notificacoes.test.ts` foi escrito, mas sua execução
e o check de snapshots foram recusados pelo harness por identidade isolada ausente.

## Aplicação no Supabase — 09/11/2026

Com autorização explícita do usuário e identificação do projeto
`cocdhjzzvdjilzahryaw`, a migration `20261109100000_add_notificacoes.sql`
foi aplicada pela CLI autenticada, sem abrir arquivos de credenciais.
DDL e registro `20261109100000 / add_notificacoes` em
`supabase_migrations.schema_migrations` confirmaram na mesma transação.

A pré-verificação confirmou a ausência da tabela/sequência/índices, o id BIGINT
com PK em usuario e os papéis envolvidos. A estrutura de comprovantes de
abastecimento já existia, registrada remotamente como `20261109114712`; ela não
foi reaplicada. As migrations históricas anteriores e seus registros não foram alterados.

A conferência posterior comprovou tabela pertencente a postgres com RLS habilitada,
quatro índices válidos (PK, unicidade e dois índices de consulta), FK com ON DELETE
CASCADE e CHECK de categoria. anon/authenticated não têm SELECT na tabela nem
USAGE na sequência. Uma transação real comprovou inserção, leitura confirmada e
preservação de lida_em ao repetir a leitura; foi revertida integralmente, sem manter
o aviso de teste nem avançar a sequência. Isso valida o banco sob o papel postgres;
não substitui a validação HTTP com a identidade/configuração do backend publicado.
O bloqueio do harness local e a regeneração dos snapshots locais continuam pendentes.

## Atribuição institucional — BE-S8-01

O agendamento com viagem vinculada grava aviso `ATRIBUICAO` para a conta ativa do motorista na mesma transação da viagem, reserva e auditoria. A chave é `viagem:<id>:atribuicao:<motoristaId>`; a restrição única impede duplicação por destinatário. Na troca de motorista, o novo atribuído recebe seu próprio aviso. Ao reagendar com o mesmo motorista, alterações efetivas continuam gerando aviso de reagendamento; repetir dados idênticos não gera outro aviso ao motorista. Pedidos antigos sem viagem conservam o aviso genérico existente. Motorista sem conta vinculada ou com conta inativa não recebe atribuição.

A caixa existente permanece restrita ao destinatário e mantém o formato HTTP anterior. Não há lembretes automáticos nesta etapa. O funcionamento depende da migration DB-S8-01; a conferência e implantação no ambiente compartilhado são tarefas separadas e não foram executadas aqui.

## Rotas do motorista

`GET /api/motorista/notificacoes?pagina=1&lida=false` retorna a propria caixa paginada; `lida=true` filtra lidas e a omissao lista todas. `PATCH /api/motorista/notificacoes/{id}/lida` marca somente notificacao propria, de forma idempotente. Ambas exigem perfil MOTORISTA autenticado.

Na troca do motorista, a atribuicao anterior permanece na caixa com titulo de encerramento. Se a viagem voltar ao mesmo motorista, o aviso existente e reativado e volta a nao lido, sem duplicar a chave de atribuicao.
