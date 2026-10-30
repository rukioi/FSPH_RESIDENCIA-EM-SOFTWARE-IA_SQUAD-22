# Testes e verificação

Teste o comportamento que pode quebrar a entrega. Prefira poucos testes úteis a testes que repetem a implementação.

## Comandos na raiz

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e  # quando alterar telas, rotas ou fluxos
```

Para preparar o navegador uma vez: `npx playwright install chromium`. O E2E inicia os serviços; mantenha 3000 e 5173 livres.

## Onde e o que testar

| Tipo | Local | Cobertura mínima |
| --- | --- | --- |
| Unitário | `*.test.ts` junto ao código | Regra nova ou corrigida, incluindo casos limite. |
| Integração | `backend/tests/integration/` | HTTP, autorização, validação e persistência quando existir. |
| E2E | `tests/e2e/` | Caminho principal do fluxo alterado. |

- Bug: reproduza em um teste que falha, corrija e execute novamente.
- API protegida: cubra 401 sem sessão, 403 sem permissão ou com vínculo inativo quando houver esse conceito, 400 para entrada inválida e sucesso.
- Cubra acesso a registros fora do alcance do usuário. Teste outra organização somente se esse modelo for adotado; não crie multitenancy para satisfazer um checklist.
- Na alteração de tela, confira 390, 768 e 1280 px, foco e uso por teclado. Anexe capturas ao PR; o E2E atual salva em `test-results/`.
- Use dados fictícios e banco de testes isolado quando a persistência for implementada. Nunca execute testes contra produção.
- Não use `.skip` nem enfraqueça expectativas para passar. Explique no PR qualquer teste antigo corrigido.

## Evidência no PR

Liste os comandos executados, o resultado e o que não foi verificado. Para documentação, rode lint, typecheck, testes e build conforme o AGENTS; E2E é dispensável se telas, rotas e fluxos não mudaram.

A autenticação possui testes unitários do contrato JWT e testes de integração da rota de sessão, incluindo 401 sem token, 403 para perfil não autorizado e sucesso com token válido. O E2E cobre o redirecionamento de rotas privadas para o login; ele exige Chromium instalado e pode ser dispensado quando a alteração não envolver telas ou fluxos.

## Infraestrutura e evidências da #28

Os testes de infraestrutura ficam em:

- `backend/tests/integration/http-infrastructure.test.ts`: regressões reproduzidas
  antes da correção (400/413/415/429, despacho e recuperação), aborto após o servidor
  começar a ler o corpo, request ID e rejeição de forwarded headers para rate limit.
- `backend/tests/integration/http-errors.test.ts`: 500 de handler com log seguro
  correlacionado, requisição seguinte saudável, matriz de métodos/Allow das rotas
  existentes e JSON inválido após autorização de usuários/abastecimentos.
- `backend/tests/integration/bootstrap.test.ts`: compila o backend, inicia src via
  tsx e dist via Node com ambiente fictício explícito e identidade #27. Confere
  login real da fixture (consulta, bcrypt, JWT) e encerramento HTTP/pool por SIGTERM.
  Os subprocessos começam sem DATABASE_URL; dotenv interceptado injeta somente
  a URL fictícia e ativa a guarda de testes antes de qualquer pool da aplicação,
  provando a ordem de configuração sem ler o arquivo secreto do desenvolvedor.
  No Windows, o subprocesso traduz uma mensagem IPC do teste em SIGTERM; não é um
  novo protocolo do servidor. A leitura dotenv real usa somente fixture interceptada.
- `backend/tests/unit/http-infrastructure.test.ts`: pool/adaptador idênticos e
  fechamento idempotente; URL/TLS seguros; handshake PostgreSQL com certificado
  artificial rejeitado; sentinelas em message/detail/cause/código/campos privados;
  bytes UTF-8, stream interrompido, arquivo exatamente 5 MiB e byte excedente,
  dez campos de 4 KiB e excesso de campo/partes/corpo total, capacidade/expiração
  do rate limit. O certificado/chave versionado é exclusivamente fictício.

A prova de PostgreSQL continua no harness #27: alvo fixo, identidade Docker e
marcador conferidos antes do acesso; nenhuma URL arbitrária ou Supabase compartilhado.
Os testes unitários de falha não substituem essa prova. Não houve mudança de SQL,
constraint, migration ou cálculo nesta tarefa. O snapshot auditado versionado foi
usado como referência; não foram consultadas linhas operacionais remotas.

Os E2E atuais cobrem bootstrap, login sem sessão e proxy; não comprovam todos os
fluxos autenticados de negócio. Capturas de login em 390/768/1280 px são salvas em
`test-results/` e foram conferidas sem corte/rolagem horizontal. Nenhuma tela mudou.
A prova TLS é local com certificado não confiável, não uma validação da cadeia
real de produção. O limite de login é por processo e IP do transporte, sem confiar
em cabeçalhos de proxy, conforme [segurança](./seguranca.md).

Os builds recompilam artefatos dist ainda rastreados historicamente. Essas saídas
não integram o commit da refatoração; o código fonte é a referência. Novas saídas
ignoradas e capturas ficam locais. A remoção definitiva dos gerados rastreados
não faz parte da #28.

Verificação final da #28 (30/10/2026):

| Comando | Resultado |
| --- | --- |
| npm run db:test:prepare | passou, migrations/seed reaplicados idempotentemente no alvo isolado |
| npm run test:db | 16 testes reais passaram (constraints, rollback, seed e isolamento) |
| npm run db:docs:check | passou, sem drift em metadados/schema/DER |
| npm run lint | passou |
| npm run typecheck | passou, incluindo os novos testes backend |
| npm test | 123 testes passaram em 19 arquivos |
| npm run build | passou, frontend e backend |
| npm run test:e2e | 5 testes passaram; capturas 390/768/1280 px conferidas |

Antes das correções, os seis testes iniciais de regressão falharam com os
status inadequados/ausência de rate limit esperados. O teste do limite exato do
upload também reproduziu a rejeição do valor limítrofe antes do ajuste. Nenhuma
expectativa antiga foi afrouxada ou teste desativado.

A única ampliação documental do rol inicial é `docs/reorganization/deferred.md`,
explicitamente exigido pela coordenação para registrar divergências sem resolvê-las.
Nenhuma ferramenta global, configuração do usuário ou dependência foi alterada.
Próximo ticket: #29; somente #33 abrirá o PR agregado.
