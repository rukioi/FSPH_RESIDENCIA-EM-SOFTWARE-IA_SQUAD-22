# Gestão de Frota e Transporte

Sistema da Fundação de Saúde Parreiras Horta para gestão de frota, viagens institucionais e atendimento SVO. Frontend em React e backend em Node.js, ambos com TypeScript e no mesmo repositório.

Repositório principal: [FSPH_RESIDENCIA-EM-SOFTWARE-IA_SQUAD-22](https://github.com/rukioi/FSPH_RESIDENCIA-EM-SOFTWARE-IA_SQUAD-22).

## Início rápido

**Requisitos:** Node.js 22.13+ na versão 22, versão 24 ou 26+; npm 10+.

Na raiz do projeto, onde está este README:

```bash
npm ci          # instala as dependências no primeiro uso
npm run dev     # inicia frontend e backend juntos
```

| Serviço | Endereço |
| --- | --- |
| Frontend | http://127.0.0.1:5173 |
| Backend | http://127.0.0.1:3000 |

Mantenha as portas **5173 e 3000** livres. Use **Ctrl+C** para encerrar os dois serviços. Alterações no código são carregadas automaticamente.

## Estrutura

```text
frontend/src/
├── app/          # entrada, rotas e providers
├── layouts/
├── pages/        # login, responsável SVO, gerente, motorista e solicitante
├── features/     # funcionalidades por módulo
└── shared/       # componentes, serviços, hooks, tipos e utilitários

backend/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── modules/       # módulos de negócio
│   ├── database/      # migrations e seeds
│   ├── security/
│   ├── middlewares/
│   ├── config/
│   ├── jobs/
│   ├── errors/
│   └── storage/
└── tests/integration/

tests/e2e/        # testes de navegador
docs/api/         # espaço para contratos da API
uploads/          # arquivos locais, fora do Git
```

Pastas ainda sem implementação usam `.gitkeep` para serem preservadas pelo Git.

## Verificação

Execute na raiz:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Para os testes de navegador:

```bash
npx playwright install chromium  # preparação inicial
npm run test:e2e
```

Os testes E2E iniciam e encerram os serviços automaticamente; deixe as portas livres. As capturas em **390, 768 e 1280 px** ficam em `test-results/`.

O build gera `frontend/dist/` e `backend/dist/`. Para conferir os arquivos compilados, use `npm run preview --workspace frontend` e `npm run start --workspace backend`. O preview do frontend não inclui o proxy da API.

## Estado atual

A aplicação possui login baseado nos usuários de `public.usuario` no PostgreSQL. As senhas são comparadas com hashes bcrypt; configure `DATABASE_URL` e `JWT_SECRET` (mínimo de 16 bytes; recomenda-se 32 ou mais) no ambiente do backend.

O token de sessão fica apenas em `sessionStorage` durante a aba aberta. O backend valida autenticação e perfil em cada rota protegida; uma rota privada aberta sem sessão redireciona para `/login`. Não use credenciais de conexão do PostgreSQL como credenciais de login da aplicação.

As funcionalidades e permissões ainda evoluem por módulo; consulte a documentação de [segurança](./docs/seguranca.md), [permissões](./docs/permissoes.md) e [API](./docs/api/README.md).

Os documentos abaixo trazem os padrões iniciais. Contratos de negócio e permissões serão detalhados por funcionalidade.

## Documentação

| Guia | Conteúdo |
| --- | --- |
| [Decisões](./docs/decisions.md) | Base técnica e evolução com entregas pequenas. |
| [API](./docs/api/README.md) | Endpoints, dados e respostas. |
| [Permissões](./docs/permissoes.md) | Controle de acesso e matriz a preencher. |
| [Segurança](./docs/seguranca.md) | Cuidados essenciais por funcionalidade. |
| [Testes](./docs/testing.md) | Comandos, cobertura e evidência no PR. |

## Colaboração

Antes de cada tarefa, leia o [AGENTS.md](./AGENTS.md) e sincronize sua `main` local com o GitHub:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/nome-da-tarefa
```

Cada integrante trabalha em sua branch (`feat/`, `fix/`, `chore/`, `docs/` ou `test/`) e envia um pull request com destino à `main`. O responsável do projeto revisa e faz o merge. Não faça push direto na `main`. Veja o [template de pull request](./.github/pull_request_template.md).
