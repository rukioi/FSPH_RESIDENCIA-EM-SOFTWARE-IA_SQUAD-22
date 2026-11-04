# SCRUM-215 — Docker Compose para desenvolvimento local

Este ambiente **não é produção**, não usa credenciais reais e não substitui o harness
`fsph-t1-isolated-2026` da SCRUM-162. A documentação TAKEOFF §§4.1–4.2 prevê
frontend, backend e PostgreSQL orquestrados pelo Docker Compose.

## Pré-requisitos

Docker Desktop com engine Linux/WSL 2 e portas **3000/5173** livres. O Compose
não publica a porta 5432 no host. O PostgreSQL fica restrito à rede Docker e usa
volume **`fsph_compose_dev_db_data_2026`**, diferente do banco de testes em 55432.
Configure **Docker Desktop → Settings → Resources → Advanced → Disk image location**
para uma unidade com espaço antes de baixar as imagens, caso o disco C: esteja cheio.
Não mova manualmente os arquivos internos do WSL.

A partir da raiz do checkout, na branch da SCRUM-215:

```powershell
# Inspecione o projeto e as portas antes de iniciar:
docker compose config --services
docker compose up --build -d

docker compose ps
# http://127.0.0.1:5173 (frontend)
# http://127.0.0.1:3000/api/auth/sessao (401 JSON sem token)
```

O primeiro start inicia o PostgreSQL, carrega somente os papéis locais sintéticos,
executa as migrations ordenadas e o seed fictício em uma **transação com lock**,
inicia o backend e então o frontend. O serviço `db-migrate` é uma tarefa de uma
execução: **Exited (0)** é normal. A partir do segundo start, o histórico SHA-256
impede reaplicar migrations, evita duplicação e recusa alteração de SQL já aplicado.
A preparação recusa outro hostname, porta, banco ou ausência da identidade local
registrada no comentário do PostgreSQL. Não lê `.env` do desenvolvedor.

Os usuários e senhas especificados no Compose e na rotina de bootstrap são
**fixtures públicas exclusivas de desenvolvimento**. Jamais reutilizar para
produção ou expor o PostgreSQL na rede pública. O proxy Vite no Compose usa
`http://backend:3000`; fora do Docker continua usando `http://127.0.0.1:3000`.
O frontend importa schemas Zod de `backend/src`; seu Dockerfile inclui essa
arvore e o Compose a monta em modo somente leitura para acompanhar mudancas locais.
O healthcheck do frontend tambem valida a transformacao de seu servico SVO,
pois a resposta HTTP 200 da pagina HTML isolada nao comprova que os imports
foram resolvidos.

O backend escuta em `0.0.0.0` apenas quando `NODE_ENV=development` e
`FSPH_LOCAL_COMPOSE=1`, mantendo o loopback nos demais contextos.

## Provas de funcionamento

```powershell
docker compose ps
docker compose logs --tail=40 db-migrate backend frontend
Invoke-WebRequest http://127.0.0.1:5173/ -UseBasicParsing
# A consulta sem token abaixo deve responder HTTP 401 e JSON:
try { Invoke-WebRequest http://127.0.0.1:3000/api/auth/sessao -UseBasicParsing } `
  catch { $_.Exception.Response.StatusCode.value__ }
# Confirmar que as tabelas existem no banco local, não no Supabase remoto:
docker compose exec -T db psql -U postgres -d fsph_compose_dev -Atc "select count(*) from information_schema.tables where table_schema='public' and table_name='solicitacao_obito'"
# Confirmar o histórico de migrations:
docker compose exec -T db psql -U postgres -d fsph_compose_dev -c 'SELECT filename, applied_at FROM fsph_compose_meta.migrations ORDER BY filename;'
```

A URL `/api/auth/sessao` deve retornar 401 ao usuário sem token; isso não
representa erro de saúde do backend. Se mudar migrations versionadas, execute
`docker compose run --rm db-migrate` e reinicie backend somente após sucesso.
Nunca edite migration já aplicada ou apague o histórico para contornar erro.

## Parada, reinício e solução de problemas

```powershell
docker compose stop
docker compose start
docker compose down
```

`docker compose down` preserva o volume. **Não execute `down -v`, `volume prune`,
`system prune`, `db reset`, `db push` ou `db repair`** sem autorização específica.
Se houver falha na preparação, consulte somente os logs de `db-migrate` e do
PostgreSQL; mantenha o volume para diagnóstico. Conflitos de porta 3000/5173
podem vir de `npm run dev` já em execução; encerre apenas o processo que você
controla. No Windows, confira WSL 2 ativo com `wsl --status` e o daemon com
`docker info`. Uma instalação inicial exige espaço para duas imagens Node e uma
imagem PostgreSQL, mesmo com código em outra unidade.

O harness independente da SCRUM-162 permanece disponível via `npm run db:test:start`
e `npm run db:test:prepare` no terminal do host. Não o aponte para o volume Compose.
A aplicação tradicional continua com `npm run dev`, sem Docker obrigatório.

## Verificações para o PR

Executar no host, com o harness isolado intacto:

```powershell
npm run db:test:start
npm run db:test:prepare
npm run db:docs:check
npm run test:db
npm run api:check
npm run client:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Registrar os resultados reais e os comandos não executados. Testar restart sem
perda da tabela local e comprovar frontend → proxy `/api` → backend, além de
PostgreSQL. Não executar migrations nem fazer deploy no Supabase compartilhado.
