# Sprint 10 — Interface de manutenção de veículos

A interface compartilha lista, formulários, detalhe e histórico entre ADM e
GESTOR_FROTA. Cada perfil usa seu menu e shell atuais. As rotas são
`/admin/manutencoes`, `/gestor/manutencoes` e seus detalhes `/:id`.
A rota `/gestor/veiculos/:id` resolve o cadastro pelo catálogo existente
e liga o histórico do veículo ao detalhe no shell da sessão.

A lista e os históricos usam paginação da API. O catálogo de veículos é
integral e inclui todos os estados. Os filtros de período usam a entrada
civil. Datas planejadas são civis e a correção de instantes operacionais
só aparece em Concluída, com fuso America/Maceio. Custo é decimal em
string. Campo vazio significa custo desconhecido e zero é um valor
informado. O cadastro corretivo permite início imediato.

Edição e transições enviam `data.versao` integralmente em `If-Match`.
O conflito de versão mantém o rascunho, exibe as diferenças e pede
revisão e nova confirmação. Ações de status seguem o estado efetivo.
O histórico estruturado apresenta o ID real do autor. Cadastro, edição comum e início são registrados na auditoria geral. O detalhe do veículo identifica o status cadastral e explica que a disponibilidade é verificada por operação. O contrato existente, a guarda
transacional e a homologação institucional pendente continuam descritos
na [API](./api/manutencoes.md) e nas [decisões](./decisions.md).

Para testar a partir da raiz, selecionar o perfil `s10-integracao-clean`
e validar sua identidade com `npm run db:test:start`. Usar o ambiente
Playwright isolado de `tests/e2e/fixtures/test-environment.ts` e
`npm run test:e2e -- tests/e2e/manutencoes.spec.ts --workers=1`. O harness
usa PostgreSQL em 127.0.0.1:55520 e sobe a interface e o backend em loopback
nas portas 5173 e 3000. Executar com fixtures sintéticas e emissão de alertas
desativada no processo de teste. A suíte guarda logs textuais e desativa
captura, vídeo e trace. O lint e os quatro E2E conhecidos do login do
motorista são pendências da main.
