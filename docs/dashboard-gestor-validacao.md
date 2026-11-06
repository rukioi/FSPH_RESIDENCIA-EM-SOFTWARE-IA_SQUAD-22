# Dashboard do gestor — integração e revisão

## Entrega

Dashboard conectado aos GETs existentes `/api/dashboard/gestor` e
`/api/dashboard/pendencias`. Nenhum dado demonstrativo é usado como fallback.
A distribuição inclui todos os estados retornados; o cartão de viagens soma
AGENDADA e PRONTA_PARA_INICIAR da distribuição, sem contar a lista limitada.

Interface adaptada a 390, 768 e 1280 px, com atalhos para a fila, programação e
cadastros existentes. O contador fixo de notificações foi removido. O botão de
atualização foi removido; a atualização em segundo plano preserva o conteúdo.
Detalhes técnicos não são apresentados como mensagens na página.

## Cache e consistência

- Cache apenas em memória, por sessão e filtro, validade máxima de 30 segundos,
  limitado a 12 entradas. Sem localStorage ou persistência operacional.
- Escritas validadas pelo cliente comum invalidam o cache e refazem as consultas
  ativas. Logout também invalida. GET e escritas com erro não invalidam.
- Leituras anteriores à invalidação não repovoam o cache; o hook existente cancela
  consultas substituídas e impede que respostas antigas sobrescrevam as atuais.
- Consultas periódicas ocorrem enquanto a página está visível. Retorno à janela
  ou aba refaz a consulta. Alterações externas são percebidas na próxima consulta;
  não há assinatura realtime nem garantia de atualização instantânea entre usuários.

## Verificações locais

- `npm run lint`, `npm run typecheck` e `npm run build`: passaram.
- `npx vitest run -c vitest.dashboard.config.ts`: 23 testes passaram. Cobrem cache,
  expiração, sessão, invalidação, resposta antiga e transporte HTTP.
- `npx playwright test -c playwright.dashboard.config.ts`: três testes passaram,
  um por largura. Conferem navegação, filtro, atualização automática, validação de
  intervalo, foco e ausência de rolagem horizontal. Capturas em `test-results/dashboard/`.
- Capturas usam fixtures explícitas da API no Playwright, sem dados reais.
  Não constituem prova de integração com PostgreSQL.
- Suíte completa/banco local: bloqueada pelo harness, que recusou instância/volume
  preexistente sem comprovante de isolamento. Não houve remoção ou adoção do banco.
- Não houve alteração de contrato, esquema, migrations ou escrita remota no banco.

O workflow **Evidências do Dashboard Gestor** publica as capturas como artefato
`dashboard-gestor-390-768-1280` por 14 dias. A CI completa permanece independente.

## Limites preservados

Disponibilidade de motoristas permanece indeterminada quando faltam jornada e
elegibilidade confiáveis. Veículos disponíveis seguem o recorte administrativo
do contrato. O alerta documental usa a janela legada de 30 dias, ainda sujeita à
validação de negócio. Histórico mostra somente eventos persistidos disponíveis.
Decisões e edições continuam nas telas existentes, sob as permissões da API.

Reverter o código não reverte dados nem operações anteriores. Merge e publicação
ficam com o responsável.
