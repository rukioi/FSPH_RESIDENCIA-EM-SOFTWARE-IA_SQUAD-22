# Regras de colaboração

Leia este arquivo inteiro e as instruções do diretório afetado antes de editar.
Leia também [README](./README.md), [decisões](./docs/decisions.md),
[API](./docs/api/README.md) e contrato do módulo, [permissões](./docs/permissoes.md),
[segurança](./docs/seguranca.md) e [testes](./docs/testing.md).
Apresente um plano curto antes das alterações.

## Escopo e fluxo

- Uma tarefa define arquivos, checklist e aceite. Faça a menor mudança necessária;
  sem refatorações, dependências ou regras de negócio adicionais. Explique no PR
  qualquer arquivo extra indispensável. Dúvidas de negócio/permissão bloqueiam só
  a parte dependente; continue o trabalho independente.
- Confira `git status` e `git fetch origin`. Primeira tarefa: `main` limpa,
  `git pull --ff-only origin main`, branch `feat/`, `fix/`, `chore/`, `docs/` ou
  `test/`. Branch existente deve incorporar a `origin/main` atual antes do PR.
  Preserve alterações alheias; não faça reset, clean ou stash automático.
- Exceção exclusiva da iniciativa #22: #27 → #28 → #29 → #31 → #32 → #30 → #33
  são sequenciais em `chore/reorganizacao-global-2026`. Só #33 abre/reutiliza o PR
  único para `main`. Não delegar nem trocar modelo nessa iniciativa.
- Commits em inglês no imperativo; PR em português usando o template e links das
  tarefas. Não fechar issues automaticamente antes da aceitação do PR final.
- Não fazer merge, push direto na `main`, force push, deploy/promote de produção
  ou mudança no banco compartilhado. Merge é do responsável. Escrita remota em
  banco exige autorização explícita própria; autorização para push/PR não a inclui.

## Fonte de verdade e padrões

- Regras no módulo responsável do backend; frontend usa serviços/cliente comuns.
  Não duplique mecanismos de HTTP, autenticação, autorização, auditoria ou conexão.
- Confira esquema/constraints/enums reais antes de escrever SQL. Sem MCP use o
  snapshot versionado; não invente colunas/status/perfis. Queries parametrizadas.
  Operações de alocação/status usam transação e bloqueios conforme regra existente.
- Dado operacional persistente passa pela API e pelo PostgreSQL/Supabase; sem SQL
  no frontend nem persistência de dados da aplicação no navegador. Estado transitório
  fica em memória; somente o token da sessão usa `sessionStorage`.
- Endpoint novo/alterado atualiza fonte do contrato global e documento do módulo
  no mesmo PR. Preserve os formatos legados inventariados; convenção futura não
  autoriza mudar consumidor. Gerados de API/cliente nunca são editados manualmente.
- Migrations/seeds só em `backend/src/database/`. Mudança de esquema autorizada
  inclui migration, snapshot/schema/DER regenerados e prova real isolada.
- Não leia, imprima, copie ou edite `.env*`, chaves, tokens ou credenciais existentes.
  Testes recebem ambiente explícito fictício, sem dotenv do desenvolvedor. Não
  instale ferramentas globais nem altere configuração do usuário.
- Não executar comandos destrutivos ou testes/seed/DDL contra banco compartilhado.
  O harness verifica container, checkout, porta e marcador antes de acessar o alvo.
  Não substitua essa prova por URL arbitrária ou por mock.

## Verificação e revisão

- Rode `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
  E2E é exigido por impacto em telas/rotas/fluxos; nesta consolidação #33 roda completo.
  Banco: `db:test:start`, `db:test:prepare`, `db:docs:check`, `test:db`.
  Contrato/gerados: `api:check` e `client:check`. Comandos partem da raiz.
- Bug começa com teste que falha. API protegida cobre 401/403, entrada inválida e
  sucesso; isolamento por organização só quando esse modelo existir. Não criar
  multitenancy para checklist. Sem `.skip`, remoção de proteção ou expectativa afrouxada.
- Tela: 390/768/1280 px, sem rolagem horizontal da página, foco/teclado e capturas
  no PR. Texto pt-BR, alvos ≥40 px, contraste AA; loading `role="status"`, erro
  `role="alert"`. Menu fechado fora do foco, item móvel fecha o menu.
- Compartilhe tipos e valide JSON antes de aplicar. Resposta antiga não sobrescreve
  consulta/escrita atual; salvamento só confirma após servidor. Reutilize tokens,
  CSS do módulo e componentes, sem redesenho não solicitado.
- Erros não expõem SQL, stack ou dados privados. Corpo limitado e erros tratados
  não derrubam processo. Reutilize códigos/mapeamentos atuais; não normalize todo
  legado sem tarefa. JSDoc útil nas funções exportadas alteradas.
- PR registra comandos/resultados, provas de banco, capturas e limites. Não declare
  check não executado como aprovado. Gerados de build e evidências locais não entram
  no Git. Use o [checklist](./docs/review-checklist.md).

## Limites da iniciativa #22

Melhorar a base existente não entrega todos os requisitos. Não antecipar agenda,
reserva, triagem/IML, novos perfis/estados, notificações, métricas ou auditoria avançada.
Registre divergências em [pendências](./docs/reorganization/deferred.md).
Grants/RLS auditados não provam segurança da Data API; rollout depende das
pré-condições de [segurança](./docs/seguranca.md). Revert de código não reverte banco.
