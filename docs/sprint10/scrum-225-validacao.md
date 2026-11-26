# SCRUM-225 — validação independente de relatórios

Data: 26/11/2026. Responsável pela validação: Matheus Souza Nunes (tarefas conferidas no Jira, sem edição remota).

Base inicial: `6d45e135cd30fb5c2c58563bc38f5b4564cde761`. Após autorização explícita, as duas branches avançaram somente por fast-forward para `1a1a7b2366a757da625b976b14d1c012bf4e538c` (PRs #98/#99/#100), sem conflitos nem commit de merge. Backup em `/tmp/fsph-s10-matheus-20261126/pre-fast-forward/manifest.json`: SHA-256 dos nove arquivos locais idênticos antes/depois do avanço. Não houve commit, push, PR ou deploy. Resultados anteriores e posteriores estão separados abaixo.

Os testes usam Node 22.22.2 e ambiente explícito, sem dotenv do desenvolvedor. O harness confere container, volume, checkout, porta e marcador antes de SQL. Nenhuma conexão ou escrita no Supabase compartilhado. Artefatos, capturas, arquivos baixados, logs e traces permanecem locais e ignorados pelo Git.

## Decisão

**LIBERADA tecnicamente no escopo SCRUM-250/251.** Filtros, totais SQL/API/UI e exportações foram comprovados no Chrome e nos testes. Após o fast-forward, o Vitest global passou1265/1265 e os seis E2E passaram. A própria main corrigiu o acesso a window no router; nenhuma correção da branch SCRUM-203 foi copiada. Isso não representa homologação humana FSPH nem liberação dos fluxos bloqueados da SCRUM-203.

Branch: `feat/s10-scrum-225-relatorios-matheus`.
Banco isolado: perfil `s9-full`, container/volume `fsph-s9-full-2026`, porta 55495. Provisionamento oficial `npm run db:test:s9-full:provision`; prepare e db:docs aprovados.

## Escopo e arquivos

A implementação da main foi preservada; nenhuma tela, serviço, rota, contrato ou migration foi alterada.

- `backend/tests/integration/relatorios-s10.fixture.ts`: cenário sintético transacional com IDs reservados, rollback em colisão e limpeza restrita, protegido pelo harness.
- `backend/tests/integration/relatorios-s10.test.ts`: 14 verificações HTTP/SQL dos sete tipos, limites, datas, privacidade, zero/null e RBAC.
- `tests/e2e/relatorios-reais.spec.ts`: quatro cenários com login UI, API e PostgreSQL reais; três resoluções e SVO separado.
- `tests/e2e/relatorios-resiliencia.spec.ts`: dois cenários CONTROLADOS; falha/atraso somente do módulo JS de exportação, sem fabricar respostas operacionais da API.
- `docs/sprint10/scrum-225-validacao.md`: este relatório.

## Critérios e evidências

| Critério | Resultado | Evidência e limite |
| --- | --- | --- |
| Menu Gestor, filtros, geração e reload | PASSOU | Chrome real e quatro E2E sem interceptação de API; perfil Gestor autenticado pela tela |
| Tipos RF71–75 efetivamente publicados | PASSOU | viagens, motoristas, solicitações, veículos, ocorrências, abastecimentos e SVO; não foi criado tipo adicional |
| Recorte por veículo/motorista/status/período | PASSOU | SQL/HTTP e navegação Chrome; ocorrências/abastecimentos não recebem status incompatível |
| Até 366 dias inclusivos | PASSOU | Ano bissexto 2096 aceito; 367 dias, datas invertidas e data inexistente recusados com 400 |
| Limite de 5.000 | PASSOU na API real | 5.001 registros sintéticos → 422 RELATORIO_MUITO_GRANDE, sem truncamento. Esse caso não foi repetido manualmente no Chrome |
| Paginação e total | PASSOU | 60 registros/3 páginas; exportação a partir da página 2 contém todos os 60 |
| Total SQL/API/tela | PASSOU | 59 viagens concluídas, uma agendada, 580 km; nenhum odômetro tratado como distância |
| Zero/null/vazio | PASSOU | S10-REL-2 tem distância zero; S10-REL-1 tem null; vazio retorna 0 registros e distância indisponível |
| SVO | PASSOU | Login oficial positivo e menu SVO no E2E; no Chrome, ordem real #OC-12 concluída aparece com 15 km. Esta última evidência foi capturada no ambiente 203, com fontes de produção idênticas |
| Acesso indevido | PASSOU | API real recusa perfil cruzado 403 e ausência de sessão 401 (suíte existente); não depende de esconder menu |
| Exportações desabilitadas com filtros editados | PASSOU | Chrome e E2E; exige Gerar relatório novamente |
| CSV completo/UTF-8/fórmulas | PASSOU | 61 linhas incluindo cabeçalho, 11 colunas, 60 códigos exatos; acentos/aspas/separador; texto =1+1 protegido com apóstrofo |
| XLSX completo e precisão | PASSOU | Arquivo reaberto por ExcelJS: aba Dados com 61 linhas, Informações presente, todos os códigos na ordem; string não vira fórmula; 10.25 L e 60.99 preservados |
| PDF completo e legível | PASSOU | PDF real com 2 páginas, 60 códigos exatos, cabeçalhos repetidos, 580 km; duas páginas renderizadas e inspecionadas visualmente |
| Falha do exportador | PASSOU — CONTROLADO | Módulo XLSX abortado; alerta sem arquivo/falso sucesso; reload recupera exportação |
| Cancelamento ao sair | PASSOU — CONTROLADO | Atraso no módulo XLSX, saída pelo menu e liberação posterior não produzem download tardio |
| 390/768/1280 e teclado | PASSOU no recorte executado | Página sem overflow; tabela possui rolagem própria; Enter, menus, foco e filtros utilizados; não equivale a certificação WCAG completa |
| Console/HTTP | PASSOU no recorte | Sem pageerror no E2E real e sem warnings/errors observados no console do Chrome; falhas injetadas estão identificadas separadamente |

## Arquivos baixados e abertos de verdade

Diretório local: `/tmp/fsph-s10-matheus-20261126/225/`.

- `relatorio-viagens-2097-05-01-2097-05-03.csv`.
- `chrome-viagens-60.xlsx` e `chrome-abastecimentos.xlsx`.
- `chrome-viagens-60.pdf`; inspeção visual em `pdf-inspecao-1.png` e `pdf-inspecao-2.png`.
- Capturas válidas: `chrome-reload-390.jpg`, `chrome-reload-768-real.jpg`, `chrome-reload-1280.jpg`, `chrome-pagina3-zero-null.jpg`, `chrome-svo-real-768.jpg`.
- Não usar `chrome-reload-768.jpg`: o nome foi criado antes de corrigir o viewport e não comprova 768 px.

São evidências de teste com registros sintéticos temporários, não prints de produção nem dados permanentes. As fixtures foram limpas; para reproduzir, executar os testes versionados e seus helpers no harness. Os screenshots de Chrome não usam interceptação, sessão fabricada ou preview.

## Comandos e resultados

Cada execução tem `.log` e `.result.json` locais com comando, perfil, duração e exit code. Não somar as linhas desta tabela: há sobreposição.

| Comando na raiz, com FSPH_TEST_PROFILE=s9-full | Resultado | Exit |
| --- | --- | --- |
| npm run db:test:prepare | PASSOU | 0 |
| npm run db:docs:check | PASSOU, sem drift | 0 |
| npm run lint | PASSOU | 0 |
| npm run typecheck | PASSOU | 0 |
| npm run build | frontend/backend PASSOU | 0 |
| npm run api:check / npm run client:check | PASSOU | 0 |
| npm test (após fast-forward) | 1265/1265, 127 arquivos; inclui os 14 novos testes HTTP/SQL e 165 DB | 0 |
| npm run test:db | 165/165 | 0 |
| npx vitest run backend/tests/integration/relatorios.test.ts backend/tests/integration/relatorios-s10.test.ts | 17/17 HTTP/SQL | 0 |
| npx vitest run --config vitest.relatorios.config.ts | 29/29 relacionados | 0 |
| npx playwright test --config playwright.relatorios.config.ts | 6/6 CONTROLADOS, não integração real | 0 |
| npx playwright test tests/e2e/relatorios-reais.spec.ts tests/e2e/relatorios-resiliencia.spec.ts --workers=1 --trace=on --output=test-results/s10-pos-ff | 6/6 após fast-forward: 4 reais + 2 controlados | 0 |
| git diff --check | PASSOU | 0 |

Na base anterior, 1241 testes passaram e uma suíte falhou antes da coleta por `ReferenceError: window is not defined`. Na base atual1a1a7b2, a guarda SSR incorporada ao router pela main eliminou a falha:1265/1265 passaram. Os14 testes novos HTTP/SQL estão incluídos nesse total. A linha jsdom local da branch203 não foi copiada para esta entrega.

As tentativas iniciais de desenvolvimento dos testes incluem seletor de menu incorreto, configuração de execução e colisão de fixture. Antes da publicação, a configuração de dois workers do CI reproduziu a colisão entre os dois arquivos novos (4 passaram, 2 falharam em motorista_cnh_key). A fixture agora adquire uma trava consultiva exclusiva (225, 250) na conexão única verificada, até o teardown. Setup e limpeza fecham a conexão também em falha, liberando a trava. Isso serializa apenas o cenário sintético compartilhado, sem alterar aplicação, asserções, timeout ou configuração do runner. A repetição dos seis cenários com dois workers passou 6/6. Não é falha de produção; era uma falha dos testes desta entrega, corrigida antes do commit.

## Pendências

- A integração foi autorizada e feita somente por fast-forward; não há dependência da correção local da branch203 para o Vitest desta branch.
- Divergência civil de horário do SVO vem dos dados/backend existentes; o relatório conserva o horário publicado conforme contrato. Registrar com o responsável backend, sem corrigir fuso por inferência no frontend.
- Não houve homologação humana, staging ou Supabase; este relatório não alega esses resultados.


## Revalidação final após o fast-forward

- HEAD e origin/main: `1a1a7b2366a757da625b976b14d1c012bf4e538c`. Conflitos:0. Cinco arquivos locais preservados byte a byte durante a integração; somente este relatório recebeu os resultados posteriores.
- Lint, typecheck, build frontend/backend, api:check, client:check, db:docs:check e diff-check: exit0. Vitest1265/1265 inclui os14 testes novos de API real e165 DB; não somar essas baterias.
- Playwright específico pós-atualização:6/6 (4 cenários com API/PostgreSQL reais e2 falhas CONTROLADAS do exportador), exit0. Os arquivos gerados foram reabertos e conferidos pelas assertions de conteúdo integral.
- Chrome na base nova: logout/login real de Gestor→menu Relatórios→recorte01–03/05/2097, veículoREL5A10, todos os status→Gerar por teclado. Após F5 a sessão permaneceu válida; filtros transitórios voltam ao padrão por comportamento publicado, e a regeneração do mesmo recorte recuperou60registros/580km. Não afirmar que os filtros ficam persistidos no navegador.
- SQL somente de leitura confirmou os mesmos60registros/580km (`sql-pos-ff.json`). A conferência manual de CSV/XLSX/PDF anterior permanece válida: fonte do exportador não mudou; downloads e leitura dos arquivos foram repetidos pelos E2E posteriores.
- `chrome-pos-ff-390.jpg`, `chrome-pos-ff-768.jpg`, `chrome-pos-ff-1280.jpg`: capturas estáveis das três larguras após a atualização. `chrome-pos-ff.json`: sem overflow, sem warn/error, menu fechado com `inert`, fora da navegação por teclado. Capturas iniciais durante a transição de viewport foram substituídas por capturas estáveis; não eram defeito de produto.
- `pos-ff-cleanup.log`: os60registros da fixture foram removidos pelo teardown, contagem final0. Não houve escrita no Supabase.

**SCRUM-250: PASSOU. SCRUM-251: PASSOU. SCRUM-225: LIBERADA tecnicamente.** Não houve commit, push, PR, alteração de Jira ou deploy. Limites: não há aceite humano/staging; o problema de horário da fonte SVO foi registrado com o responsável e não foi mascarado no relatório.

## Verificação de concorrência antes da publicação

- `npx playwright test tests/e2e/relatorios-reais.spec.ts tests/e2e/relatorios-resiliencia.spec.ts --workers=2 --trace=retain-on-failure --output=test-results/s10-publicacao-ci2-corrigido`: 6/6, exit 0.
- `npm run lint` e `npm run typecheck` repetidos após a correção da fixture: exit 0.
- O código de produção e os registros/assertions do cenário permaneceram iguais; as evidências manuais do Chrome continuam aplicáveis. A mudança limita-se à coordenação entre workers e à garantia de fechamento da conexão em caso de falha na limpeza.
- `npx playwright test --workers=2 --trace=retain-on-failure --output=test-results/s10-publicacao-completo`: **195/195**, exit 0 (suíte completa desta branch, 3,7 minutos). Inclui os seis cenários novos; não somar com a rodada específica.
- `npm test` repetido após a correção da fixture: **1265/1265**, 127 arquivos, exit 0; inclui os 14 testes HTTP/SQL novos e os 165 testes DB.
