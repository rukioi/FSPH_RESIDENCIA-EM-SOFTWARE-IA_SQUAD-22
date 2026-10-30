# Validação da consolidação — #33

Data: 30/10/2026. Branch chore/reorganizacao-global-2026; base main.
PR único: [#34](https://github.com/rukioi/FSPH_RESIDENCIA-EM-SOFTWARE-IA_SQUAD-22/pull/34).
Mapa das entregas no [plano](./plan.md). Nenhuma issue é fechada automaticamente.

## Ambiente e preservação

Node local 22.16.0, npm 10.9.2; CI configurado com Node 24 e runner Ubuntu novo.
`npm ci` executado antes das edições, com árvore rastreada limpa da agregadora;
somente .ignore e graft/ preexistentes não rastreados, preservados/excluídos do commit.
Checkout main alheio não alterado: .gitignore, package-lock.json, frontend/dist e
arquivos não rastreados permanecem fora da entrega. Fetch executado; origin/main
era ancestral e não havia conflito a resolver.

Banco exclusivo fsph_t1_baseline / projeto fsph-t1-isolated-2026, porta 55432.
Container, checkout, nonce e comentário do banco são confirmados antes de acesso.
Start reutilizou a instância já confirmada; prepare aplicou seed idempotente, sem
reset/repair. Sem URL arbitrária, dotenv real, segredos ou escrita remota.

## Comandos desta execução

| Verificação | Resultado |
| --- | --- |
| npm ci | passou; 0 vulnerabilidades reportadas pelo npm nesta execução |
| db:test:start / db:test:prepare | passou no alvo confirmado |
| db:docs:check | passou, comparação de metadados/schema/DER |
| api:check / client:check | passaram, regeneração em memória e conteúdo |
| lint / typecheck | passaram |
| test:db | 16 testes passaram |
| npm test | 199 testes passaram em 30 arquivos |
| npm run build | frontend/backend passaram |
| npm run test:e2e | 24 cenários passaram em 1,3 minuto |
| git diff --check | passou após retirada dos compilados do índice |
| Workflow YAML | parsing e presença dos comandos obrigatórios conferidos |
| CI remoto | resultado por revisão nos checks do PR; não inferir aprovação remota da prova local |

Sete provas negativas alteraram temporariamente um arquivo por vez: OpenAPI,
inventário, DTOs, bindings, metadados, schema e DER. Cada check recusou a deriva;
`finally` restaurou os bytes originais e o mesmo check voltou a passar. Nenhuma
alteração temporária ficou na árvore. O teste existente de ACL também revogou
SELECT de anon exclusivamente no isolado, detectou drift e restaurou o grant.

Os checks existentes bastam: não foram adicionados scripts paralelos nem novas
dependências. Manifesto é lista exata por método/caminho com razões; o dispatcher
usa o mesmo registro das 29 operações. Testes negativos rejeitam exceção extra,
remoção/duplicação, rota/status removido e tipo incompatível. Isso não prova todos
os caminhos dos controllers; testes HTTP/banco completam o recorte existente.

## Banco e compatibilidade

Snapshot fiel: 10 tabelas, 99 colunas, sete enums, 36 constraints e 19 índices;
ACL/RLS auditados preservados. Testes reais provam FK/UNIQUE/CHECK, rollback,
seed idempotente, recusa de alvo arbitrário e histórico divergente. Integração
real cobre sessão/perfil ativo, eventos transacionais, contratos e abastecimento.
Não se criou organização/vínculo para satisfazer checklist.

Quebras deliberadas da #29: status exige corpo ativo booleano; segredo com menos
de 32 bytes é recusado. #30 classifica entrada técnica de abastecimento como 400
e referência inexistente como 404. API/frontend mudam juntos. Formatos legados,
paginação opcional da auditoria, BIGINT/NUMERIC e horários existentes permanecem.

## Capturas e CI

E2E grava em test-results/ os fluxos de veículos, motoristas, usuários,
dashboard/auditoria/SVO demonstrativos e login em 390/768/1280. O workflow publica
esse diretório e eventual playwright-report/ no artefato `evidencias-<sha>` por
14 dias, inclusive em falha. O PR aponta ao run/artefato após execução.
Capturas não entram no Git; não comprovam acessibilidade completa. Tabelas/modais
conservam rolagem interna e os recortes preexistentes registrados na #30.
Nesta execução foram inspecionadas visualmente motoristas em 390 px, dashboard
em 768 px e SVO em 1280 px; permanecem o dia anterior na CNH, filtros abreviados
e legenda ilustrativa cortada já registrados na #30. E2E cobre os demais tamanhos
e confirma ausência de rolagem horizontal da página; não houve alteração de tela.
Avisos ECONNREFUSED do proxy ocorreram durante a espera explícita pelo backend;
nenhum cenário precisou de retry de operação de negócio.

## Retorno e limites

Runtime anterior à #33 é d38be98: esta tarefa altera somente instruções/docs/CI
e rastreamento de compilados, sem mudar fontes de aplicação, contratos ou esquema.
`git diff --exit-code d38be98 -- backend/src frontend/src scripts tests backend/tests`
confirmou identidade das fontes antes da publicação. Compilados continuaram no
disco após `git rm --cached`; `git ls-files backend/dist frontend/dist` ficou vazio
e `git check-ignore` confirmou as regras já existentes, sem alterar .gitignore.
O ensaio usa essas fontes anteriores idênticas no banco isolado, com login/bootstrap,
HTTP/persistência e encerramento; não é ensaio de publicação/backup remoto.
Procedimento separado de código/banco em [rollback](./rollback.md).

CODEOWNERS ausente por falta de responsáveis confirmados; settings remotos não
foram alterados. Proteção de branch e rollout são decisões do responsável.
Sem validação de CA real, Data API/papel runtime remoto, migração de banco existente,
segurança de produção, desempenho/SLA 24x7 ou completude funcional. Pendências em
[deferred](./deferred.md). Nenhum merge/deploy foi executado.
