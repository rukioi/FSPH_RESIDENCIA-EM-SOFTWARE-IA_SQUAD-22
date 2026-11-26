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

A sincronização documental segue a [janela RF46](./documentos-s9.md#alertas-rf46).
Ela grava a fase vigente (mês-calendário, semana, dia ou vencido) na caixa do
destinatário ADM/Gestor. A data de referência usa America/Maceio. A unicidade por
destinatário, vínculo, validade e fase evita repetição em sincronizações concorrentes.
Outros perfis recebem sucesso com zero alterações. O cliente sincroniza a caixa
ao consultar, após operações confirmadas, ao recuperar foco e a cada 60s enquanto
visível. O mecanismo documental continua acionado pelo cliente.

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

A caixa existente permanece restrita ao destinatário e mantém o formato HTTP anterior. Lembretes automáticos seguem a política provisória documentada abaixo. O funcionamento depende da migration DB-S8-01; a conferência e implantação no ambiente compartilhado são tarefas separadas e não foram executadas aqui.

## Rotas do motorista

`GET /api/motorista/notificacoes?pagina=1&lida=false` retorna a propria caixa paginada; `lida=true` filtra lidas e a omissao lista todas. `PATCH /api/motorista/notificacoes/{id}/lida` marca somente notificacao propria, de forma idempotente. Ambas exigem perfil MOTORISTA autenticado.

Na troca do motorista, a atribuicao anterior permanece na caixa com titulo de encerramento. Se a viagem voltar ao mesmo motorista, o aviso existente e reativado e volta a nao lido, sem duplicar a chave de atribuicao.


## Lembretes automáticos de viagem

O processo do backend consulta viagens institucionais agendadas e grava avisos LEMBRETE para a conta ativa vinculada ao motorista atribuído. A antecedência é configurada por `LEMBRETE_ANTECEDENCIA_MINUTOS` (padrão provisório de desenvolvimento: **30 minutos**, pendente de aprovação; intervalo aceito de 1 a 10080). A verificação ocorre ao iniciar e se repete após cada ciclo pelo intervalo em segundos configurado em `LEMBRETE_INTERVALO_SEGUNDOS` (padrão técnico 60, de 1 a 3600). O intervalo deve ser inferior à antecedência; configurações inválidas impedem a inicialização. O horário de saída é interpretado em America/Maceio.

A política provisória gera um aviso por viagem, motorista e horário de saída: repetidas verificações não duplicam o registro. O processamento concorrente usa bloqueio da solicitação e unicidade da caixa. Se a saída ou motorista mudar, os lembretes anteriores são identificados como desatualizados; uma nova atribuição no mesmo horário original reativa o aviso correspondente. Eventos passados não são enviados. Ao reiniciar antes da saída, o processo verifica novamente as viagens ainda dentro da janela.

Para funcionar em produção, pelo menos uma instância do backend precisa permanecer ativa e com acesso ao PostgreSQL durante a janela; se todas estiverem paradas até a saída, não haverá envio retroativo. A periodicidade e a antecedência precisam ser homologadas pela equipe. A falha de uma verificação é registrada sem dados sensíveis e o processo tenta novamente no ciclo seguinte. Não é necessário chamar uma rota manualmente.

## Alertas de manutenção — SCRUM-234

O emissor periódico atende somente ADM e GESTOR_FROTA ativos. Os dois
eventos são preventiva agendada que chega à janela civil [hoje, hoje+7)
e atraso corrente. Alertas não são gravados em GET. O aviso manual de
EM_MANUTENCAO e os eventos estruturados de viagem conservam as regras.

O indicador e o emissor compartilham os critérios civis em America/Maceio.
Cada ocorrência tem uma revisão independente por alerta. Sem linha
persistida, a revisão é 1. O emissor a materializa antes do primeiro
aviso. Uma mutação que abra revisão pela primeira vez persiste 2.

Reabertura e reativação avançam ambos os alertas uma vez. Uma alteração
relevante ou INICIAR avança somente alertas que saem da elegibilidade,
comparando antes e depois no mesmo dia civil do banco, após os locks.
Em A–B–A, a saída em B reserva a revisão seguinte mesmo entre ciclos
do emissor. Datas continuamente elegíveis e mudanças de custo, texto,
prestador, observações ou quilometragem preservam a revisão. Ao iniciar
uma agendada atrasada com previsão ainda não vencida, a revisão de
ATRASO avança e pode emitir quando a previsão vencer. Se o atraso
continuar, a chave é preservada.

Cada execução consulta lotes de até 25 ocorrências por ID crescente e
tenta até 100 no total. O orçamento de 35 segundos impede iniciar uma nova
tentativa após o prazo; consultas em curso têm timeout por instrução. O
agendador Node volta a consultar no ciclo seguinte, por padrão após 60
segundos (LEMBRETE_INTERVALO_SEGUNDOS). Avisos já entregues da revisão
corrente deixam de ocupar o lote. Cada ocorrência usa transação própria e check
após FOR UPDATE SKIP LOCKED. Sob o lock da ocorrência, o emissor materializa
ou lê a revisão e trava os destinatários por ID, sem travar o veículo. As
escritas usam a ordem veículo, ocorrência e revisões. Falhas de emissão têm tratamento
independente dos lembretes institucionais e permitem nova tentativa no ciclo
seguinte. A chave manutencao:<id>:<alerta>:<revisao> usa unicidade por
destinatário e ON CONFLICT DO NOTHING, preservando inclusive lida_em.

Confirmar o runtime compartilhado antes do rollout. Pausar e drenar
as escritas de manutenção antes de atualizar as instâncias. Após validar
a migration e substituir todos os escritores, retomar as escritas e
ativar com MANUTENCAO_ALERTAS_ATIVOS=true. Na primeira ativação, os casos
já elegíveis entram no lote.
A homologação institucional formal da FSPH permanece pendente.

Para reverter a aplicação, desligar a emissão, aguardar transações em curso
e preservar a tabela. O rollback físico exige tabela vazia e ausência de
chaves da nova família. Ele bloqueia a tabela de revisões e impede novas
gravações na caixa durante a conferência. Com qualquer revisão ou aviso,
recusa a remoção. A retirada definitiva com dados exige outra aprovação.

### Emissão periódica na Vercel

O cron de produção chama GET /api/cron/manutencao-alertas uma vez ao dia,
a partir das 12h UTC (9h em America/Maceio). A função exige CRON_SECRET
de servidor, com pelo menos 16 caracteres e gerado aleatoriamente, no
Bearer enviado pela Vercel. Com MANUTENCAO_ALERTAS_ATIVOS ausente ou
diferente de true, a chamada autenticada retorna 204 sem acessar o banco.

O cron chama exclusivamente o emissor de manutenção. Retorna 200 com
`emitidas`, `falhas`, `adiadas` e `restantes` quando o processamento termina
sem pendências detectadas. Retorna 503 com os mesmos contadores se houver
falha por ocorrência, lock concorrente ou trabalho além do limite. Os
contadores não incluem identificadores ou dados de destinatários. O Node
registra um evento operacional equivalente, sem interferir nos lembretes
institucionais. Uma falha geral retorna 500.

Ocorrências omitidas pelo limite, bloqueadas ou revertidas seguem candidatas
na próxima execução enquanto elegíveis. A cadência diária não garante nova
tentativa no mesmo dia. Monitore 503 e dimensione a frequência antes de
ativar a flag. Se for necessário escoar volume superior ao limite diário,
use o agendador Node contínuo. Ambos usam o lock por ocorrência e a
unicidade por destinatário, preservando a primeira leitura.

Antes de um rollback físico das revisões, suspenda e drene também as escritas
de manutenção. Retome as escritas somente com instâncias que já dispensam a
tabela. Para reverter apenas a aplicação, preserve a tabela.
