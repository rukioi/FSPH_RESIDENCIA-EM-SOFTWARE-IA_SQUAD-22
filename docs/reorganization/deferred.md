# Divergências preservadas — #28

Registro exigido pela coordenação #22; este arquivo adicional ao rol de caminhos
é necessário para cumprir a instrução explícita de não resolver domínio durante
a refatoração técnica. Nada abaixo foi implementado ou alterado pela #28.

- Dashboard /gestor chama contagem total de motoristas de motoristasDisponiveis;
  /dashboard/kpis não existe. Não adicionar indicador nem redefinir disponibilidade.
- Abastecimento admite omitir motorista_id/quilometragem no controller, enquanto
  a baseline auditada exige ambos. RF40 e a obrigatoriedade precisam de tarefa própria.
- SVO expõe filtro AGUARDANDO_DESPACHO e persiste PENDENTE_ALOCACAO; despacho verifica
  apenas o conflito operacional já existente, sem disponibilidade unificada com viagens.
- IDs negativos das fixtures #27 servem à prova isolada; a rota SVO continua
  exigindo identidade positiva, como antes. Não mudar essa regra para acomodar fixtures.
- Segurança de sessões, perfil efetivo/usuário ativo, tamanho de JWT_SECRET e
  autorização são da #29. Transações/gravação da auditoria existente são da #31.
- Envelopes diretos/data/erro, snake_case, listas sem paginação e serialização
  temporal/numérica legada ficam para #32; nenhuma conversão de histórico.
- ACL/RLS reproduzidas em #27 não comprovam proteção da Data API compartilhada.
  Nenhuma alteração remota está autorizada por esta entrega.
- Agenda/reservas, triagem/IML, novos estados/perfis, notificações, manutenção e
  regras pendentes #23–#26 continuam fora desta refatoração.

Sequência: #27 → #28 → #29 → #31 → #32 → #30 → #33. Somente #33 abre o PR final.

## Atualização #29

- Requisitos tratam ADM/Gestor como equivalentes operacionais; a matriz existente
  foi preservada. Reconciliação funcional futura, sem novos acessos nesta tarefa.
- Papel runtime remoto, memberships e schemas expostos da Data API não foram
  confirmados. Sem migration ACL ou escrita remota; estratégia mínima ensaiada
  no isolado com rollback. A baseline mantém grants amplos até rollout aprovado.
- Revogação avançada/refresh/cache/token_version permanecem fora; estado ativo e
  perfil efetivo passam a ser consultados por requisição. Operações já autorizadas
  não são interrompidas por uma mudança posterior no banco.
- Cadastro/edição mantêm auditoria legada fora da transação; centralização #31.
  Status já é atômico/idempotente para evitar eventos duplicados por repetição.
- Envelopes e DTOs atuais continuam para #32; nenhum DTO HTTP novo foi duplicado
  no frontend. O modelo visual continua usando rótulos; API/SQL usam enum real.

Próximo ticket: #31. Somente #33 abre/reutiliza o PR final.

- O painel visual preexistente PermissoesPerfil não configura a autorização da API;
  a fonte continua sendo a lista explícita do backend. Nenhuma permissão nova foi
  persistida ou tornada configurável nesta tarefa. Essa reconciliação é futura.
- Em 390 px a tabela de usuários conserva rolagem interna preexistente; a página
  não tem rolagem horizontal. Não houve redesign/CSS fora do escopo da #29.

## Atualização #31

- Cadastro/edição agora confirmam junto da atividade; status conserva idempotência.
  Os dois eventos SVO existentes usam o mesmo serviço e a mesma transação anterior.
- A consulta paginada projeta DTO mínimo; chamadas sem page/limit conservam array
  completo/campos legados, inclusive email. Unificação e remoção coordenada do
  adaptador ficam para #32. UI demonstrativa permanece para #30.
- Descrições antigas não são reescritas: podem conter email do cadastro legado.
  Novos registros usam ID/modelos fechados. Anonimização, retenção, imutabilidade,
  FKs de exclusão e fuso histórico permanecem tarefas próprias.
- Não há novos eventos de despacho/login/negação, relatórios, dashboard,
  monitoramento, SLA 24x7 ou novas regras operacionais.

Próximo ticket: #32. Somente #33 abre/reutiliza o PR final.

## Atualização #32

- Contrato global cobre as 29 operações atuais; veículos é piloto runtime (cinco
  operações). As outras 24 conservam validadores/consumidores anteriores e estão
  em lista fechada no manifesto. Migração de serviços/tipos/estado das demais
  telas continua na #30. Não converter tudo para satisfazer uniformidade visual.
- A lista de auditoria sem page/limit ainda retorna array completo com email.
  Remover o adaptador contradiz a compatibilidade exigida na #32; exige adoção
  coordenada de paginação e tarefa explícita posterior.
- BIGINT string/NUMERIC string e serialização de datas do driver preservados.
  Alguns caminhos SVO convertem ID para Number e podem perder precisão; correção
  coordenada fica para tarefa própria. Sem conversão de históricos.
- FK ao excluir veículo/motorista ainda pode retornar 500. Abastecimento valida
  truthiness e aceita tentativas sem motorista/km que o NOT NULL rejeita com 500.
  Não converter esses erros nem endurecer regras de entrada nesta refatoração.
- PUT/PATCH de veículos editam somente os campos existentes; ano/tipo/km e alguns
  campos de cadastro enviados na edição são ignorados. Null/defaults e semântica
  de fornecedor conservados. Não introduzir filtros/paginação/GET individual.
- Schemas legados descrevem a forma usual e limitações explícitas; não provam
  todas as coerções admitidas pelo PostgreSQL, algoritmos CPF ou assinatura de
  arquivos. Validadores atuais e testes HTTP continuam a fonte desses detalhes.
- Geração sem banco/segredos e gate conservador não substituem teste de execução,
  nem revisão de compatibilidade. Mudanças em definições existentes requerem
  tarefa explícita; não há autorização para editar gerados ou apagar o baseline.
- Em 390 px, selects do filtro conservam texto abreviado pelo layout existente.
  O modal conserva rolagem interna; capturas do início e das ações registram isso.
  Não houve alteração de CSS, paleta, layout ou implementação dos painéis vazios
  de manutenção/multas/históricos. São partes da interface sem API correspondente.

Próximo ticket: #30; depois #33, responsável pelo único PR final.

## Atualização #30

Dependências conferidas por commits e evidências versionadas: #27 ea68b16,
#28 acd0f6c, #29 58dcbbf, #31 0feb939 e #32 7c29a2c. `git fetch origin` foi
executado e origin/main já era ancestral da agregadora. Checkout main alheio
preservado; neste worktree, `.ignore` e `graft/` preexistentes não integram o commit.
Não houve delegação, troca de modelo, PR individual, merge, deploy ou acesso a
arquivo de ambiente/segredo. O executável graft não estava disponível no terminal;
a inspeção usou buscas locais. Nenhuma ferramenta global ou dependência foi instalada.

### Implementação e compatibilidade

- Motoristas deixa de fazer HTTP/definir envelope na página: serviço, tipos
  gerados e schemas puros da #32 validam lista/cadastro. Cadastro não reconstrói
  resposta incompleta com o formulário. CPF/telefone usam campos já suportados
  pela API, sem alegar gravação local. E-mail de motorista não existe no contrato:
  controle fica indisponível; não é criado vínculo/usuário ou campo no banco.
- Veículos, motoristas e usuários compartilham estado remoto em useRemoteData:
  loading/erro/nova tentativa, cancelamento por ciclo/desmontagem e validação
  antes de aplicar. Uma escrita confirmada cancela a leitura anterior; filtros,
  seleção, modal e formulário continuam locais. Veículos separa erro de formulário
  de erro de consulta. Sem state manager ou armazenamento operacional no navegador.
- Usuários e SVO usam bindings/tipos gerados e parsing/erros do mesmo cliente.
  Mapeamento visual de perfis permanece único em usuarios.service; cadastro e
  edição enviam SOLICITANTE_INTERNO. IDs/nullable são preservados no transporte;
  o modelo visual numérico de usuário conserva o limite seguro preexistente.
- SVO cancela leituras encerradas, expõe falha de recursos e nova tentativa e
  não deixa resposta antiga recolocar recursos após despacho. IDs de consulta
  permanecem string; ordenação usa BigInt. O contrato de escrita SVO continua
  numérico e sua limitação de precisão permanece adiada, sem mudar o backend.
- Falha de rede recebe FALHA_REDE em pt-BR; respostas inválidas, status, erro
  legado, cancelamento e X-Request-Id passam pelo cliente comum. Login/sessão
  conservam o adaptador de autenticação existente; sem novo mecanismo de acesso.
- Não há endpoint de KPIs por período. A chamada ausente foi retirada; cartões
  usam travessão e mensagem de indisponibilidade, sem zero fictício. Widgets e
  análise local mostram demonstração. Auditoria permanece demonstrativa porque
  seu modelo visual exige perfil/evento/módulo/resultado ausentes do DTO mínimo;
  não são inferidos de descrições reais. Contrato/paginação da #31 preservados.
- Contadores, atividades recentes e ordens despachadas do SVO são apresentados
  como recorte desta sessão. Falta a leitura persistida para reconstruir esse
  resumo. Não foi criado histórico operacional, fluxo de execução ou notificação.
- Abastecimento recebe 400 para JSON/tipo/data/campo incompatível com o esquema
  atual e erros PostgreSQL 23502/22P02/22001/22003/22007/22008; FK 23503 recebe
  404 REFERENCIA_INEXISTENTE. Sucesso/SQL/pool/perfis preservados. RF40 continua
  divergindo de motorista_id/quilometragem NOT NULL: isto não define nova regra
  de obrigatoriedade do produto, não executa migration e substitui somente o 500
  técnico documentado na #32. Snapshot versionado orientou campos e constraints.

### Arquivos adicionais indispensáveis

`backend/src/modules/abastecimentos/abastecimentos.schemas.ts` e
`backend/src/shared/contract/registry.ts` atualizam descrição/status na fonte do
contrato global exigida pelo ticket. OpenAPI, inventário e tipos foram regenerados
pelos comandos oficiais, sem edição manual. `scripts/generate-api.ts` admite
somente a migração explícita do novo 404 comum desse POST e a descrição do seu
componente, mantendo a comparação dos demais campos/operações/tipos/status.
`backend/tests/contract/generation.test.ts` prova essa exceção e suas rejeições.

`backend/tests/integration/auditoria.test.ts` tinha a suposição de que limit=100
incluía o último registro. Reexecuções E2E acumularam atividades fictícias e
reproduziram falha quando total>100. O teste agora cria 101 atividades próprias
e consulta a última página calculada pelo total, preservando a exigência de NULL
no fim. Não apaga logs alheios nem afrouxa a expectativa de ordenação/projeção.
As fixtures extras usam o outro ator do teste para não contaminar a prova de
cadastro. Nenhuma mudança de código de auditoria ou regra de negócio foi necessária.

### Funcionalidades e limitações preservadas

- Agenda/reservas, triagem/IML, novos perfis/estados, notificações, manutenção,
  novas métricas, histórico persistente SVO, auditoria avançada e dúvidas #23–#26
  continuam fora desta refatoração. A sequência termina na #33, único PR final.
- Não houve conversão de datas históricas. A renderização preexistente de DATE
  com hora/fuso pode mostrar o dia anterior na CNH; corrigir a semântica temporal
  exige tarefa própria. Sem alteração de calendário operacional nesta entrega.
- CSS, paleta e componentes visuais foram preservados. Não há rolagem horizontal
  da página nos tamanhos verificados; tabelas/modais conservam rolagem interna.
  Permanecem filtros abreviados no celular e corte preexistente da legenda do
  widget ilustrativo de chamados por translateX(-50px) em Widgets.css. Não é uma
  alegação de acessibilidade/layout completos; a correção visual fica adiada.
- Grants/RLS/ACL e ambiente publicado não foram alterados nem validados. A prova
  é exclusivamente do PostgreSQL isolado confirmado pelo harness da #27.

Próximo ticket: #33 — consolidar documentação, CI e abrir/reutilizar o único PR
para main. Não fechar automaticamente #30 antes da aceitação desse PR.

### Verificação final da #30 — 30/10/2026

| Comando | Resultado |
| --- | --- |
| npm run api:generate | OpenAPI/inventário regenerados pela fonte |
| npm run client:generate | DTOs regenerados, sem edição manual |
| npm run api:check | passou, inclui gate e exceção explícita #30 |
| npm run client:check | passou, sem drift |
| npm run lint | passou |
| npm run typecheck | passou, frontend/backend/testes/scripts |
| npm test | 199 testes passaram em 30 arquivos |
| npm run test:db | 16 testes reais passaram |
| npm run build | frontend e backend passaram |
| npm run test:e2e | 24 cenários passaram, com capturas 390/768/1280 |

O harness conferiu identidade/proveniência Docker, vínculo ao checkout, porta e
marcador do banco fsph_t1_baseline/projeto fsph-t1-isolated-2026 antes do acesso.
Não foi usada URL arbitrária nem aplicada migration remota. A baseline existente
já estava provisionada: não foi necessário reset ou limpeza geral do banco.
O seed foi reaplicado idempotentemente pelos testes já existentes do harness.

Treze casos novos em abastecimentos.test.ts usam HTTP/PostgreSQL reais para
401/403/conta inativa, JSON inválido, null/array/tipo/campo obrigatório/data,
limite varchar(255), referências de veículo/motorista inexistentes e cadastro
confirmado pela linha persistida. As falhas foram reproduzidas antes da correção,
incluindo 500 por FK/NOT NULL/tipo e por texto maior que a coluna. A primeira
execução detectou ausência de tipo na fixture de veículo; foi corrigida a fixture
conforme o schema, sem mudar a aplicação para acomodá-la.

Testes do cliente/serviços provam formato inválido, erro de rede, 401/403/409,
envelopes legados, BIGINT/nullable, listas vazias, status/perfil persistido e
cancelamento. A falha de rede foi reproduzida antes da normalização. O gate
testa que o 404 autorizado não permite trocar payload, remover sucesso ou mudar
tipos. Nenhum teste foi pulado ou expectativa de segurança/negócio afrouxada.

E2E mantém os fluxos anteriores e adiciona cadastro real de motorista com POST
bloqueado até confirmação, resposta inválida/403/vazio/nova tentativa, lista de
usuários inválida, consulta antiga cancelada para não apagar cadastro confirmado,
ausência de chamada /kpis em trocas de período, demonstração explícita e despacho
SVO 409 seguido de sucesso. Consulta direta no isolado confirma veículo/motorista
alocados e status EM_DESLOCAMENTO. Fixtures próprias são removidas somente no alvo
verificado; atividades de outras execuções foram preservadas.

Uma execução detectou travessão com codificação incorreta; corrigido o texto e
reexecutado E2E completo. A inspeção visual detectou sobreposição do aviso de
demonstração nos cabeçalhos; o aviso foi agrupado ao título, mantendo CSS e
componentes. As capturas finais foram conferidas em 390/768/1280 em test-results:
motoristas-*/motoristas-<largura>.png, motorista-cadastro/motorista-detalhes e
bootstrap-demonstrações-*/dashboard/auditoria/svo-<largura>.png, além das capturas
preexistentes de veículos/usuários/login. Permanecem disponíveis localmente para
anexar ao PR da #33, fora do Git. Não comprovam acessibilidade completa.

Os erros ECONNREFUSED iniciais do proxy ocorreram na espera explícita pelo backend;
nenhum fluxo de negócio depende de retry automático. A consulta de diagnósticos
do editor não respondeu; as verificações estáticas por CLI passaram. Artefatos
dist historicamente rastreados foram restaurados ao estado inicial após o build,
sem incluir gerados de build no commit da refatoração. Nada foi implantado.
