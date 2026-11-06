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
- `npx vitest run -c vitest.dashboard.config.ts`: 26 testes passaram. Cobrem cache,
  expiração, sessão, invalidação, resposta antiga e transporte HTTP.
- `npx playwright test -c playwright.dashboard.config.ts`: quatro testes passaram,
  um por largura. Conferem navegação, filtro, atualização automática, validação de
  intervalo, foco e ausência de rolagem horizontal. Capturas em `test-results/dashboard/`.
- Capturas usam fixtures explícitas da API no Playwright, sem dados reais.
  Não constituem prova de integração com PostgreSQL.

## Recuperação de falhas

Leituras com erro de rede, timeout HTTP ou status 500/502/503/504 recebem duas
novas tentativas silenciosas, após 1 e 3 segundos. Cancelamento interrompe também
as esperas. Autenticação, autorização, entrada inválida e resposta incompatível
não são repetidas. Após falha definitiva, a tela mantém o conteúdo anterior e
exibe um aviso discreto com “Recarregar”. Foco/visibilidade simultâneos são
agrupados para reduzir consultas duplicadas; polling não substitui consulta ativa.
Isso trata a experiência diante de falhas transitórias, sem afirmar correção da
causa de erros 500 do servidor, que exige diagnóstico pelos logs correlacionados.

Os cenários antigos de bootstrap foram atualizados para validar dados reais no
dashboard, em vez da antiga demonstração. O teste de redirecionamento com token
fictício isola também os GETs operacionais, evitando 401 fora do cenário da guarda.
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
