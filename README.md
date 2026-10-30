# Gestão de Frota e Transporte

Aplicação da Fundação de Saúde Parreiras Horta: React/Vite e backend modular
Node.js/TypeScript com npm workspaces. A refatoração #22 organiza a base existente;
não entrega todos os requisitos funcionais.

## Desenvolvimento

Node.js ^22.13, ^24 ou >=26 e npm >=10 (CI usa Node 24). Na raiz:

```sh
npm ci
npm run dev
```

Frontend: http://127.0.0.1:5173; backend: http://127.0.0.1:3000. Mantenha as portas
livres. O processo backend recebe DATABASE_URL e JWT_SECRET (mínimo 32 bytes UTF-8);
server.ts carrega a configuração da raiz antes de importar a aplicação. Não use
credenciais do PostgreSQL como login da aplicação. Assistentes não acessam arquivos
de ambiente/credenciais existentes. Os testes usam somente fixtures explícitas.

## Organização atual

| Caminho | Responsabilidade |
| --- | --- |
| backend/src/modules/ | Operações atuais de auth, usuários, auditoria, dashboard, frota, documentos, abastecimentos e SVO |
| backend/src/database/ | Pool único, migrations, seeds e harness isolado |
| backend/src/security/ | JWT, sessão atual no banco e autorização por perfil efetivo |
| backend/src/shared/ | HTTP, erros/logger, contrato global puro e request ID |
| frontend/src/app/, layouts/, pages/, features/ | Entrada/rotas, apresentação e funcionalidades existentes |
| frontend/src/shared/api/, services/, types/ | Cliente comum, DTOs/bindings gerados, validação e estado remoto |
| docs/api/, docs/database/ | Contratos atuais e snapshot/metadados/DER gerados |
| tests/e2e/ | Fluxos com fixtures e capturas 390/768/1280 |

config/db.ts é apenas adaptador do pool único. Veículos é o piloto de validação
HTTP por schema; outros controllers mantêm validações/envelopes legados descritos
no [inventário](./docs/api/inventory.md). O frontend valida respostas antes de aplicar,
cancela leituras antigas e aguarda confirmação de escrita.

## Verificar do zero

Docker com engine Linux disponível; preparação e guardas em
[banco reproduzível](./docs/database/README.md). Não configure o harness com conexão remota.

```sh
npm ci
npm run db:test:start
npm run db:test:prepare
npm run db:docs:check
npm run api:check
npm run client:check
npm run lint
npm run typecheck
npm run test:db
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

O CI executa essa sequência com Chromium/dependências e banco exclusivo em runner
novo, sem segredos. Publica capturas em artefato do run por 14 dias; os caminhos
locais ficam em test-results/. Compilados backend/dist/ e frontend/dist/ são locais,
ignorados pelo Git. Preview do frontend não inclui proxy de API; publicação não
é definida por esse comando.

## Preview na Vercel

[vercel.json](./vercel.json) fixa Vite na raiz do monorepo, instala pelo lockfile,
compila somente o workspace frontend e publica frontend/dist. Isso substitui o
preset Node que procurava um entrypoint na raiz e falhava. Rotas da SPA recebem
index.html; /api e /api/* ficam fora desse fallback, sem devolver HTML como JSON.
A configuração segue os overrides documentados pela
[Vercel](https://vercel.com/docs/project-configuration/vercel-json).

Essa configuração publica o frontend estático. Não publica o servidor node:http
nem configura conexão de banco ou endereço externo de API. O proxy de /api no Vite
vale somente no desenvolvimento; login/dados em ambiente publicado dependem de
hospedagem/roteamento do backend aprovados separadamente. Build/preview aprovado
não comprova integração operacional com o Supabase ou prontidão de produção.

## Estado e limites

Login consulta public.usuario com bcrypt; JWT HS256/sub/exp, sessão atual sem cache
e listas de autorização preservadas. Somente token usa sessionStorage. Cinco eventos
existentes são gravados pela auditoria na transação do chamador; não é auditoria
avançada. Dashboard/auditoria visuais usam demonstração ou indisponibilidade explícita;
resumo SVO em memória identifica o recorte da sessão.

A baseline reproduz grants amplos/RLS desligada: não constitui configuração segura
para nova publicação. Data API/papel runtime remotos ainda exigem confirmação e
aprovação do responsável. Não aplicar a baseline em banco existente sem reconciliação.

Agenda/reservas, is_svo exclusivo, triagem/IML, novos estados, métricas, notificações,
revogação avançada, conversão de horários e reconciliação ADM/Gestor/RF40 ficam em
[pendências](./docs/reorganization/deferred.md). Não são gates de implementação
funcional desta refatoração.

## Colaboração e revisão

Leia [AGENTS](./AGENTS.md), [decisões](./docs/decisions.md),
[API](./docs/api/README.md), [permissões](./docs/permissoes.md),
[segurança](./docs/seguranca.md), [testes](./docs/testing.md) e
[checklist](./docs/review-checklist.md). Fluxo usual: main atualizada → branch da
tarefa → checks → PR para main → revisão/merge pelo responsável.

A iniciativa #22 usa excepcionalmente uma branch sequencial e o
[PR único #34](https://github.com/rukioi/FSPH_RESIDENCIA-EM-SOFTWARE-IA_SQUAD-22/pull/34).
[Plano/mapa de commits](./docs/reorganization/plan.md),
[validação](./docs/reorganization/validation.md) e
[rollback separado de código/banco](./docs/reorganization/rollback.md) registram a entrega.
Sem merge/deploy ou escrita no Supabase compartilhado por agentes nesta iniciativa.
