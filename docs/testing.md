# Testes e verificação

Teste o comportamento que pode quebrar a entrega. Prefira poucos testes úteis a testes que repetem a implementação.

## Comandos na raiz

Primeiro execute `npm ci`, `npm run db:test:start` e `npm run db:test:prepare`.
Docker/engine Linux e portas do harness devem estar disponíveis. O runner nunca
usa banco compartilhado ou configuração de segredos do desenvolvedor.

```bash
npm run db:docs:check
npm run api:check
npm run client:check
npm run lint
npm run typecheck
npm run test:db
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
- Use dados fictícios e o banco isolado do harness para a persistência existente. Nunca execute testes contra produção.
- Não use `.skip` nem enfraqueça expectativas para passar. Explique no PR qualquer teste antigo corrigido.

## Evidência no PR

Liste os comandos executados, o resultado e o que não foi verificado. Para documentação, rode lint, typecheck, testes e build conforme o AGENTS; E2E é dispensável se telas, rotas e fluxos não mudaram.

A autenticação possui testes unitários do contrato JWT e testes de integração da rota de sessão, incluindo 401 sem token, 403 para perfil não autorizado e sucesso com token válido. O E2E cobre o redirecionamento de rotas privadas para o login; ele exige Chromium instalado e pode ser dispensado quando a alteração não envolver telas ou fluxos.

## Infraestrutura e evidências da #28

As seções por ticket abaixo são registros históricos. O estado final e as contagens
atuais estão em [validation.md](./reorganization/validation.md). Menções a etapas
então futuras não substituem o procedimento atual da raiz.

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

## Evidências da #29 — 30/10/2026

Dependências conferidas por commits e implementação na branch agregadora:
#27 `ea68b16`, #28 `acd0f6c`. origin/main é ancestral da branch e fetch foi repetido.
O checkout agregador começou limpo; alterações preexistentes no checkout main
foram preservadas. Não houve PR individual, merge, deploy ou fechamento de issue.

### Arquivos e decisões

- security/jwt.ts centraliza enum reconhecido/aliases e exige HS256, sub, exp e
  segredo de 32 bytes UTF-8. session.ts consulta usuarios.repository.ts em toda
  requisição; authorization.ts aplica as listas existentes. Routes de auth,
  usuários, auditoria, dashboard, veículos, motoristas, documentos, abastecimentos
  e SVO reutilizam esse caminho. Sem cache ou infraestrutura nova de sessões.
- Os três controllers Express desconectados e authMiddleware não tinham imports
  no código fonte/testes; removidos após busca. node:http permanece ativo.
- usuarios.service.ts valida allowlist/códigos persistidos; routes preservam os
  envelopes existentes. Status explícito, bloqueio de linha e evento atômico;
  repetição não alterna nem duplica auditoria. Cadastro/edição seguem para #31.
- usuarios.service.ts do frontend valida dados desconhecidos e produz somente
  modelo de apresentação; o DTO HTTP duplicado anterior foi removido. Cadastro
  e edição traduzem Solicitante para SOLICITANTE_INTERNO. Tabela/formulário/modal
  aguardam resposta, mostram carregamento/erro e não antecipam estado confirmado.
- Segurança, permissões, decisões e contratos foram atualizados. Além do rol de
  docs do ticket, README corrige a orientação insegura de segredo com 16 bytes;
  contratos dos outros módulos registram a nova semântica comum de identidade;
  este guia conserva provas para o PR final. deferred.md é exigido pela #22.
- Não houve dependência, migration ou mudança de esquema. Schema/DER/snapshot
  continuam gerados e idênticos; dist recompilado foi excluído do commit e os
  arquivos rastreados de build foram restaurados ao estado inicial.

### Provas e comandos

| Comando | Resultado |
| --- | --- |
| npm run db:test:prepare | passou no alvo isolado previamente identificado pelo harness |
| npm run test:db | 16 testes passaram |
| npm run db:docs:check | passou, sem drift em metadados/schema/DER |
| npm run lint | passou |
| npm run typecheck | passou, incluindo testes backend |
| npm test | 134 testes passaram em 22 arquivos |
| npm run build | passou, frontend e backend |
| npm run test:e2e | 10 testes passaram, incluindo os fluxos autenticados de usuários |

Regressões foram executadas antes da correção: cinco falhas reproduziram segredo
insuficiente aceito, autorização pelo claim antigo, campos internos aceitos e toggle
sem corpo. Testes antigos de domínio receberam identidades fictícias compatíveis
com a consulta atual; as expectativas de autorização não foram afrouxadas.
Session-fixture isola identidade nesses testes com SQL de recurso mockado; a prova
real é separada em usuarios-sessao.test.ts. Nenhum teste foi desativado.

PostgreSQL real: projeto fsph-t1-isolated-2026, banco fsph_t1_baseline, identidade
Docker/marcador conferidos pelo harness #27. usuarios-sessao.test.ts prova cadastro
com enum real, edição, estado ativo/perfil efetivo, 401/403, rejeição de campos
internos, repetição e duas requisições concorrentes com um único evento por mudança.
Todas as famílias protegidas foram exercitadas sem token e com usuário desativado.
Fixtures próprias são apagadas somente nesse alvo confirmado.

security/session.test.ts prova perfil desconhecido/ativo null/false e falha de
consulta sem fallback/autorização nem exposição de sentinela privada.
security/direct-data-access.test.ts executa ACLs somente em transação isolada com
rollback: anon/authenticated são realmente impedidos de consultar usuário/dado
médico, escrever e usar sequência; runtime fictício sem superuser/BYPASSRLS/dono
consegue leitura/CRUD e não TRUNCATE. Default privileges são revogados no ensaio;
rollback restaura ACLs e remove o papel artificial, sem migration persistida.

E2E prova cadastro/edição dos perfis visuais, repetição do estado, falha sem
atualização otimista, carregamento/botão desabilitado até a confirmação, mudança de
perfil sem outro JWT e desativação no próximo request. A execução inicial do cenário
combinado excedeu 30s: separado em dois testes e conexão movida ao setup, sem mudar
limites dos testes. Uma repetição detectou frontend pronto antes do backend; o
setup agora espera explicitamente o 401 de sessão antes do login. A execução final
passou com os dez cenários. Não há retry de operação de negócio para ocultar falha.

Capturas de tabela e modal em 390/768/1280 px foram conferidas visualmente e ficam
em `test-results/usuarios-sessao-*/usuarios-<largura>.png` e
`novo-usuario-<largura>.png`, fora do Git, disponíveis localmente para anexar no PR
final da #33. Não há rolagem horizontal na página; a tabela mantém sua rolagem
interna preexistente no celular. Nenhuma paleta, layout ou CSS foi redesenhado.

### Compatibilidade e limites

O contrato PATCH exige agora {ativo:boolean}; o cliente foi atualizado junto.
Segredos de 16–31 bytes deixam de ser aceitos; a configuração externa deve cumprir
32 bytes antes do rollout e troca de segredo requer novo login. Aliases históricos
de perfil no JWT continuam aceitos, com autorização pelo perfil efetivo do banco.
As listas de acesso não foram expandidas pela equivalência ADM/Gestor dos requisitos.

Metadados auditados confirmam grants amplos/RLS desligada, mas não o papel runtime
remoto, memberships ou exposição efetiva da Data API. A prova local usa papel
simulado mínimo e não valida o ambiente remoto. Essa é a pendência de rollout
permitida pelo passo 8 da #29; nenhuma ACL remota ou policy inventada foi executada.
Pré-condições em seguranca.md. Não foram acessados segredos ou dados operacionais.

Próximo ticket: #31. Só #33 abre/reutiliza o PR agregado para main.

## Evidências da #32 — 30/10/2026

Dependências conferidas por commits/implementação na branch agregadora: #27
ea68b16, #28 acd0f6c, #29 58dcbbf e #31 0feb939. origin/main é ancestral;
fetch repetido antes da publicação. Sem PR individual, merge, deploy ou escrita
no Supabase compartilhado. O estado fechado da issue #32 já existia na consulta
inicial; esta execução não altera o estado de issues.

### Cobertura e arquivos

- `backend/src/shared/contract/`: registro, componentes comuns e OpenAPI puro;
  nove contribuições `backend/src/modules/*/*.schemas.ts`. Dispatcher em app.ts
  usa esse registro, mantendo os caminhos/métodos e as listas atuais de acesso.
- `backend/src/modules/veiculos/`: controller HTTP pequeno, serviço com as regras
  existentes e repository com projeções explícitas. `shared/http/errors.ts`
  oferece erro interno conhecido e adaptador sem expor detalhes de banco.
- `scripts/{generate-api,check-api,generate-client,check-client}.ts`: geração e
  comparação; `scripts/tsconfig.json` inclui esses arquivos no typecheck da raiz.
  OpenAPI/inventário, tipos e bindings são gerados, nunca editados manualmente.
- `frontend/src/shared/api/`: cliente/erro normalizados e gerados;
  `shared/services/veiculos.service.ts` valida com a fonte Zod do backend e usa
  tipos/bindings gerados. Auth reaproveita os tipos de login/sessão e mantém o
  adaptador Bearer/401; erro sem token agora também tem status/code comuns.
  Veiculos.tsx conserva formulário/modelo visual, sem DTO HTTP próprio.
- Docs API (global/veículos/inventário/manifesto), decisões e pendências registram
  os formatos atuais, limites e evolução. Pacotes declaram somente Zod para
  runtime e YAML/json-schema-to-typescript para geração local.

São 29 operações documentadas, cinco no piloto executável de veículos e 24
legadas explicitamente fechadas. Os validadores anteriores das outras operações
continuam ativos. Tipos gerados disponíveis não significam migração runtime de
todos os consumidores; o restante do frontend continua na #30.

### Comandos finais

| Comando | Resultado |
| --- | --- |
| npm run api:generate | passou, OpenAPI/inventário reproduzíveis |
| npm run api:check | passou, cobertura fechada e comparação de conteúdo |
| npm run client:generate | passou, DTOs e bindings da mesma especificação |
| npm run client:check | passou, sem drift dos gerados |
| npm run db:test:prepare | passou, identidade Docker/marcador confirmados pelo harness #27 |
| npm run test:db | 16 testes reais passaram |
| npm run db:docs:check | passou, metadados/schema/DER sem drift |
| npm run lint | passou |
| npm run typecheck | passou, frontend/backend/testes e scripts |
| npm test | 172 testes passaram em 28 arquivos |
| npm run build | frontend/backend passaram |
| npm run test:e2e | 14 testes passaram |

`backend/tests/contract/generation.test.ts` executa checks em subprocessos sem
DATABASE_URL/JWT_SECRET e com allowlist explícita de ambiente; prova ausência de
dependência em banco/segredos. Exercita remoção/duplicação/exceção nova no manifesto,
remoção de rota/status e mudança de tipo incompatível, limites do pathname,
parcialidade/defaults/condição de fornecedor e precedência dos códigos legados.
O gate compara com HEAD: na primeira entrega não havia baseline OpenAPI; o commit
da #32 estabelece esse baseline para as próximas tarefas. O gate é conservador e
não substitui revisão semântica de compatibilidade.

Os primeiros testes do cliente falharam enquanto o módulo ainda não existia;
depois passaram os cenários de JSON inválido, envelopes legados, 204 e aborto.
Seis mocks antigos de veículos não possuíam a projeção completa e usavam ID Number;
foram corrigidos para as strings/campos que PostgreSQL realmente retorna, mantendo
status de sucesso, validações e parâmetros SQL esperados. Não foram afrouxados
testes ou desativados casos. Um teste novo comparava a ordem das propriedades JSON;
passou a comparar o objeto decodificado, sem mudar campos/valores exigidos.
O teste combinado de dois subprocessos de geração excedeu os 5s padrão; foi
separado em dois casos independentes sem aumentar timeout ou usar retry.

### Prova real e compatibilidade

`backend/tests/integration/veiculos-contract.test.ts` usa somente o PostgreSQL
fsph_t1_baseline do projeto fsph-t1-isolated-2026. O harness verifica proveniência,
porta fixa, checkout e marcador antes da conexão. O snapshot versionado orientou
as colunas/enums/nullability; não foi consultado dado operacional remoto.

HTTP real cobre as 28 operações protegidas sem sessão (401), perfil efetivo
negado (403), conta inativa (401), SVO somente consulta de veículos, 405/Allow,
404 de rota inexistente, 400, cadastro/defaults, duplicidade 409, edição parcial,
vínculo/fornecedor, ausência 404 e exclusão 200 data.success. INSERT direto no alvo
isolado prova ID 9007199254740993 como string e campos nullable; resposta de edição
é confrontada com a linha realmente persistida. FK real de documento impede
exclusão e conserva 500 legado, sem SQL/constraint no retorno ou log. Limpeza remove
somente fixtures T32 próprias no alvo confirmado.

As consultas GET legadas de auth/usuários/auditoria/dashboard/SVO/motoristas/
documentos/abastecimentos também foram exercitadas contra PostgreSQL e validadas
com seus schemas; auditoria cobre array antigo e envelope paginado. Isso não
equivale a validar todas as escritas/coerções legadas ou todas as regras de domínio.
Organização/vínculo multitenant não existe no modelo; não foi criado para um teste.

`frontend/src/shared/{api,services}` cobre parsing, erro string/{erro}/{error},
correlação, aborto/204, signal, resposta incompleta/estado desconhecido, preservação
de ID e null e cadastro confirmado. Tipos não são usados como validação runtime.

`tests/e2e/veiculos.spec.ts` mantém cadastro real, filtros locais e detalhes em
390/768/1280 px. Bloqueia a resposta de POST para provar botão desabilitado e
ausência do card antes da confirmação; valida erro acionável para resposta fora
do schema e saída da sessão após 401. Capturas `veiculos-<largura>.png`,
`cadastro-<largura>.png`, `cadastro-acoes-<largura>.png` e `detalhes-<largura>.png`
ficam em `test-results/veiculos-*/`, fora do Git, conferidas visualmente para o PR
final #33. Não há rolagem horizontal da página; modal/tabelas conservam rolagem
interna e filtros abreviados no celular. Não houve alteração de CSS/layout.

O E2E completo também passou os fluxos anteriores de usuários/bootstrap. Mensagens
de proxy ECONNREFUSED ocorreram durante a espera explícita pelo backend iniciar;
nenhum cenário depende de retry de operação de negócio. A leitura de diagnósticos
do editor não respondeu; as verificações por CLI acima foram concluídas.

Limites: não houve migration, enum novo, ACL remota, conversão histórica, nova
paginação de frota, novo perfil/estado/fluxo ou GET individual. Permanecem o array
antigo de auditoria com email, conversões Number no SVO, coerções/NOT NULL de
abastecimento, 500 de FK na exclusão e validadores manuais fora do piloto. O
manifesto/deferred.md delimitam esses pontos; não são autorização para novos
legados. Artefatos de build rastreados são restaurados ao estado inicial e não
integram o commit; a pasta graft preexistente é preservada sem inclusão.

Próximo ticket: #30; somente #33 abre/reutiliza o PR final.
