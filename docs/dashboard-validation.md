# Dashboard e navegação: validação

Entrega solicitada na conversa: cores semânticas, hierarquia compartilhada, sidebar retraído clicável com preferência em memória, brasão fornecido e lazy loading de páginas.

## Resultados

- `npm run lint`, `npm run typecheck`, `npm run build`: passaram.
- `npm run api:check` e `npm run client:check`: passaram.
- `npx vitest run --config vitest.apresentacao.config.ts`: 163 testes passaram em 18 arquivos, com respostas/mocks explícitos e sem conexão SQL.
- `npx playwright test --config playwright.aparencia.config.ts`: 20 testes passaram. API fictícia interceptada no navegador, Vite sem leitura de ambiente, nenhum backend/banco iniciado.
- Regressões reproduzidas antes da correção: navegação por teclado no sidebar retraído e preferência entre layouts.
- Capturas em `test-results/aparencia/`: dashboard 390/768/1280, sidebar retraído, formulários e relatórios. Conferidas as capturas do dashboard e sidebar; sem rolagem horizontal nos cenários testados. Evidências locais ficam fora do Git.

## Carregamento e limites

Teste de rede confirma que Veiculos.tsx e Auditoria.tsx não são solicitados na abertura do dashboard; Veiculos.tsx é solicitado ao navegar. Build gerou entrada JS de 259,87 kB (78,27 kB gzip), com chunks separados por página. Bibliotecas de exportação continuam grandes, carregadas sob demanda.

A verificação de sessão a cada rota foi preservada. Não foi medido tempo de resposta da API/Supabase nem ganho em segundos em produção.

Por instrução expressa do usuário, não executar banco local. `npm test`, `npm run test:e2e` e checks de banco dependem do harness e não foram reexecutados nesta etapa. Os testes de UI e mocks não comprovam integração SQL, persistência nem configuração do Supabase. Nenhuma migration, escrita remota ou alteração de dados foi realizada nesta etapa.

A consulta ao catálogo 21st retornou HTTP 401; foram reutilizados componentes e tokens existentes. Revisão 21st identificou o backdrop sem semântica, convertido em botão. Os valores de cores semânticas estão centralizados em tokens.
