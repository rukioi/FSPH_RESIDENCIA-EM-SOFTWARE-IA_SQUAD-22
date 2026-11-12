# SCRUM-185 — reconciliação RF40

Fontes: SCRUM-179/185, RF40 (km quando disponível; motorista não obrigatório)
e baseline/incrementos já publicados. Migration:
`20261111000000_db_s9_01_abastecimentos_rf40.sql`.

## Modelo

- Mantém FK de veículo, data civil, `numeric(10,2)`, posto opcional e registros antigos.
- Motorista e km passam a aceitar NULL; km presente aceita zero e rejeita negativos.
- Litros/valor devem ser positivos e finitos (NaN rejeitado; precisão limitada pelo numeric).
- `criado_por_id` referencia usuário. Legado fica NULL, sem autor inventado; o backend
  deve registrar o usuário autenticado em cada novo cadastro (SCRUM-186).
- Veículo SVO usa a mesma FK; não há tabela, contador ou fluxo de abastecimento paralelo.
- Índices `(veiculo_id, data_abastecimento DESC, id DESC)` e
  `(data_abastecimento DESC, id DESC)` suportam consultas por veículo/período.
- Preserva a relação privada `abastecimento_comprovante`, tanque completo e download
  existente. Não duplica storage. Metadados/anexos compartilhados e PDF dependem da
  SCRUM-194, ainda sem contrato publicado; SCRUM-187 não está concluída.
- Não altera odômetro de veículo/viagem nem grava KPI estático.

## Aplicação e rollback

Somente o harness oficial foi utilizado: `db:test:start`, `db:test:prepare`,
`db:docs:generate`, `db:docs:check`, `test:db`. Nenhum banco compartilhado foi acessado.
O runner valida identidade, histórico e hashes; cada migration é transacional.
Legado com valor inválido impede a aplicação sem apagar/corrigir esse registro.
Um rollout externo exige inspeção/aprovação do responsável, não está autorizado aqui.

O rollback versionado está em `backend/src/database/supabase/rollbacks/`.
Ele recusa a reversão se houver motorista/km ausentes ou autoria preenchida:
não preenche dados falsos, não apaga registros e não descarta autoria. Deve ser
executado em transação e com coordenação do backend; não há comando de reset/repair.
Adquire `ACCESS EXCLUSIVE` **antes** dessa verificação e mantém o bloqueio até o
fim da transação. A revisão encontrou uma janela de concorrência entre a consulta
e o `ALTER TABLE`: uma gravação poderia incluir autoria após a consulta. O novo
teste falhou com o rollback anterior e passou com o bloqueio antecipado, preservando
a autoria concorrente. A migration de avanço já aplicada não foi alterada.

O teste `backend/tests/database/abastecimentos-s9.test.ts` exercita forward/down
em schema transacional baseado na DDL real da baseline, vazio e com registro legado.
Não esvazia `public`, não muda o histórico do harness e desfaz seus dados ao terminar.
Também cobre FKs, data inválida, NULL/zero/km presente, SVO e rejeição de litros/valor
inválidos; são 22 verificações reais no PostgreSQL isolado. O ensaio concorrente
usa conexões verificadas e um schema próprio, removido pela fixture ao terminar.

## Documentação e impactos

O comando oficial agora gera/verifica também `dicionario.md` a partir do catálogo;
não mantém manualmente uma tabela que ainda afirmava motorista/km obrigatórios.
Os quatro artefatos incluem as migrations de comprovantes/notificações de 09/11
que já estavam na main, mas ausentes do snapshot anterior. Não há nova DDL de
notificações nesta entrega. O teste de catálogo passa a exigir explicitamente RLS
em comprovantes, como já definido pela migration publicada, preservando os demais
checks integrais e o teste de drift de privilégios.

Ao publicar o DTO nullable, Gustavo precisa tratar `quilometragem === null` como
“Não informada” em `frontend/src/pages/abastecimentos/Abastecimentos.tsx` (formatação
da célula de km). O usuário reservou esse ajuste ao Gustavo; a tela não foi alterada.
Não substituir NULL por zero nem afrouxar o tipo para ocultar esse impacto.

## Validação e limites da entrega DB/BE — 11/11/2026

- `db:test:prepare`: aplicado no Docker identificado pelo harness, sem banco remoto.
- Testes DB: 88/88; inclui 22 casos específicos de forward/rollback e RF40.
- `db:docs:check`: sem drift nos quatro artefatos.
- Cadastro/consultas/indicadores/comprovante + testes de contrato: 58/58.
  Há 23 testes HTTP/DB novos e 17 de regressão do módulo existente; os demais
  verificam os contratos/gerados e as restrições de compatibilidade.
- `api:check`, `client:check`, lint, diff-check, typecheck backend/testes/scripts
  e build backend: aprovados.
- `npm run typecheck` e build frontend: bloqueados pela célula de km em
  `Abastecimentos.tsx:311`; somente esse erro permanece. Correção reservada ao Gustavo.
- Suíte completa executada anteriormente: 764/774 aprovados; não foi repetida no
  fechamento. Oito falhas são de mocks antigos dos testes
  `solicitacoes.detalhes`/`solicitacoes.agenda` após a integração de notificações.
  Foram reproduzidas com a auditoria original de `origin/main` e os demais arquivos
  idênticos à main, por configuração temporária; nada desses fluxos foi corrigido.
  Duas falhas de bootstrap dependem da porta fixa 3000, ocupada por processo existente
  (PID observado 53898), que não foi interrompido. Não declarar suíte toda verde.
- E2E de abastecimentos completo no fechamento: **3/5**. Os três casos de
  cadastro/comprovante/reload passaram, em 390/768/1280, com teclado e
  sem overflow. Para preservar o servidor existente, configuração temporária iniciou
  `createApp()` em porta efêmera e Vite 5199 com `envDir:false`, usando as mesmas
  verificações do harness e credenciais artificiais oficiais. Nenhuma proteção foi removida.
  O teste retarda o envio do POST com `route.continue()` para observar loading;
  não fabrica a resposta. Os testes HTTP/DB não usam interceptação.
- Os outros dois E2E falharam: `consulta inválida oferece nova tentativa` e
  `cadastro exige motorista e quilometragem e preserva formulário em erro do servidor`.
  São cenários de interface com resposta controlada, não provas FE → API → banco.
  No primeiro, a tela apresenta a segunda resposta válida antes da asserção de erro;
  a interceptação injeta erro somente na primeira chamada durante a montagem.
  No segundo, o campo Motorista não conserva o foco esperado quando também falta km.
  Ambos foram reproduzidos com todo o frontend e o schema de validação lidos de
  `origin/main`, mantendo a API real desta branch no harness. Essa reprodução isola
  o código cliente de referência; não é execução de todo o backend da main em outro banco.
  Esses fluxos não foram corrigidos nem tiveram expectativas afrouxadas nesta entrega.
- A fixture E2E passou a limpar seus cadastros entre resoluções e suas atividades
  na saída. O rollback/409 de cadastro é ensaiado por falha transacional provocada
  na fixture PostgreSQL; não é evidência de duplicidade nem de disputa real entre operadores.

## Fechamento técnico da branch

Referência consultada por `git fetch origin`: `origin/main` e `HEAD` em
`10f675190b968a674b705cf092741aeef9b87f43`. Não há commits desta entrega ainda;
`git diff origin/main...HEAD` está vazio. A revisão incluiu o diff da árvore de
trabalho e os arquivos novos: **32 arquivos (24 modificados e 8 novos)**, não 22.
O índice permaneceu vazio. Não foram encontrados arquivos indevidos, `.env`
rastreado, segredos, marcadores de conflito ou arquivos vazios nesse conjunto.
Os únicos arquivos frontend alterados são os dois gerados pelos comandos oficiais.

Os oito testes herdados foram repetidos: **21/29 passaram e 8 falharam**, usando
`auditoria.service.ts` original da main e testes/dependências idênticos à referência.
Sete falhas de `solicitacoes.detalhes` recebem resultado indefinido do mock na
consulta de notificações; uma de `solicitacoes.agenda` assume que a última consulta
é a auditoria, mas agora é a notificação. Os testes e a implementação de notificações
não são modificados aqui. Ressalva: `auditoria.service.ts` pertence ao diff, com duas
adições para o evento de abastecimento; não é correto afirmar que **nenhum** arquivo
da cadeia de chamadas foi alterado. A reprodução com sua versão original confirma
que essas adições não causam as oito falhas.

Os dois testes de `backend/tests/integration/bootstrap.test.ts` iniciam, respectivamente,
`backend/src/server.ts` e `backend/dist/server.js`. Ambos acessam a porta 3000 fixa,
também fixada por `server.ts`; não existe opção oficial para trocar essa porta.
Foi observado Node PID **53898**, diretório de trabalho `backend`, ouvindo em
`127.0.0.1:3000`. O processo não foi interrompido. Esses dois testes **não foram
reexecutados**: precisam que o responsável libere a porta. Os E2E em porta efêmera
não substituem essa prova de bootstrap. Nenhum código de produção foi adaptado
para contornar o bloqueio.

A bateria afetada final executou **167/167**:

```sh
npm test -- backend/tests/database backend/tests/integration/abastecimentos-s9.test.ts backend/tests/integration/abastecimentos.test.ts backend/tests/contract/generation.test.ts frontend/src/shared/services/abastecimentos.service.test.ts frontend/src/shared/services/current-services.test.ts
```

São **88 DB + 40 HTTP/API + 18 contrato + 21 consumidores**. Lint, typecheck e build
backend, typecheck de testes/scripts, `api:check`, `client:check`, `db:docs:check` e
`git diff --check` passaram. Typecheck e build frontend foram repetidos e continuam
falhando exclusivamente em `Abastecimentos.tsx:311`, devido ao contrato correto
`number | null`. É uma dependência externa de integração reservada ao Gustavo,
não uma falha preexistente da main. A branch não está totalmente verde para integração
enquanto esse consumidor não tratar ausência explicitamente, sem converter para zero.

Consulta final pelo harness confirmou ausência dos usuários, veículos, motoristas,
abastecimentos, atividades, schema e função temporária pertencentes às fixtures S9/E2E.
Não foi necessário apagar resíduos manualmente.

Logs/configurações temporárias ficam em `/tmp/fsph-s9-*`; capturas técnicas em
`test-results/sprint9-abastecimentos/`, fora do Git. As fixtures são removidas ao
terminar; capturas não são evidência de um estado reproduzível por URL de apresentação.
Não houve alteração no Jira, commit, push ou PR.

SCRUM-185 está validada no banco. O backend da SCRUM-186 está implementado e validado;
aceite completo com os campos opcionais na tela depende da integração de Gustavo.
SCRUM-187 continua dependente da SCRUM-194. SCRUM-188 entrega somente os agregados
não ambíguos: consumo por distância continua pendente de regra aprovada, conforme
[contrato atualizado](../api/abastecimentos.md).

## Atualização do fechamento e Jira — 12/11/2026

A pedido explícito do responsável, o fechamento técnico de DB/backend foi separado
das dependências de integração do frontend. Não houve nova alteração funcional.

- `db:test:prepare` confirmou novamente a identidade e o histórico do Docker isolado.
- Bateria afetada repetida: **167/167** (88 DB, 40 HTTP/API, 18 contrato, 21 consumidores).
- Lint, typecheck/build backend, typecheck de testes/scripts, `api:check`, `client:check`,
  `db:docs:check` e diff-check aprovados novamente.
- Foram mantidas as evidências E2E anteriores: três fluxos reais aprovados nas três
  resoluções e dois cenários controlados de interface falhos. Sem mudança de tela,
  não foram repetidos nesta rodada. Os dois testes de bootstrap continuam bloqueados
  pelo mesmo processo na porta 3000, que não foi interrompido.
- A adaptação de `quilometragem: null` é dependência externa de integração FE do
  Gustavo, **não pendência do backend da SCRUM-186**. O contrato não foi mascarado
  e a tela não foi modificada. O build integrado continua dependendo desse ajuste.

O fetch encontrou `origin/main` em **29ff645**, três commits à frente do HEAD local
10f6751. O merge #60 adicionou a entrega DB de execução de viagem e o commit 4611e52
corrigiu os oito testes antes falhos e a gravação dos bytes do comprovante legado.
Esta branch já usa Buffer na gravação do comprovante. Os dois arquivos de testes
de solicitações e o módulo de auditoria foram carregados diretamente da referência
atual em configuração temporária: **29/29 passaram**. Os demais módulos usados
nessa comparação não mudaram entre as referências. Portanto, as oito falhas descritas
na seção de 11/11 são históricas e **não se reproduzem na referência atual**.
Não houve incorporação desses commits ou aplicação da nova migration de viagem:
merge continua não autorizado. Sincronização e conciliação dos snapshots serão
necessárias antes do PR; os resultados acima validam a árvore local atual.

Atualizações confirmadas no Jira, sem alterar descrição, prioridade, sprint ou responsável:

| Task | Status mantido/aplicado | Evidência ou limite registrado |
| --- | --- | --- |
| SCRUM-185 | Concluído | RF40, migration/rollback, constraints, índices e documentação; 88/88 DB. |
| SCRUM-186 | Concluído | Backend validado; km nulo registrado como dependência de integração FE. |
| SCRUM-179 | Em andamento | O item 4 e o aceite BL22–BL25 exigem integração compartilhada de comprovantes/entrega mais ampla; não estão integralmente comprovados apenas pela 185. |
| SCRUM-187 | A fazer | Bloqueada pela SCRUM-194; legado JPEG/PNG não equivale à entrega completa. |
| SCRUM-188 | A fazer | Agregados inequívocos disponíveis; fórmula de consumo por distância pendente. |
| SCRUM-180 | A fazer | Não concluída enquanto 187/188 tiverem pendências. |

Comentários de evidência/bloqueio: 10044 (185), 10045 (186), 10046 (179), 10047 (187),
10048 (188) e 10049 (180). Foi explicitado no Jira que a implementação permanece
local na branch `feat/be-db-s9-abastecimentos`, **sem commit, push, PR ou merge**.
Nenhuma alteração na infraestrutura da SCRUM-194, fórmula de consumo, frontend do
Gustavo, `.env` ou banco remoto.

## Sincronização autorizada com a main — 12/11/2026

A branch avançou por **fast-forward de 10f6751 para 29ff645**, sem criar commit,
stash, reset, push ou PR. A cópia prévia dos 32 arquivos locais, patches, versões
base/main e hashes foi preservada em `/tmp/fsph-s9-sync-20261112-8vxxen1g`.
As fontes foram conciliadas antes do avanço e reaplicadas imediatamente. Não houve
perda de migration, rollback, testes ou código da Sprint 9.

Foram nove arquivos sobrepostos, dos quais **oito tiveram conflitos de conteúdo**
na comparação de três versões. Todos foram resolvidos:

| Arquivo | Resolução |
| --- | --- |
| `backend/src/modules/abastecimentos/abastecimentos.controller.ts` | Mantida separação HTTP/service/repository da S9; a correção Buffer da main já está no validador/repositório e continua coberta por persistência/download real. |
| `backend/tests/database/schema.test.ts` | Mantida versão da main: inclui RLS dos comprovantes e das novas tabelas de viagem, cobrindo também a exigência S9. Por isso saiu do diff local. |
| `backend/tests/database/seed.test.ts` | Mantida classificação das quatro tabelas e identificação de PK da main, preservando a verificação integral das linhas das tabelas sem seed da S9. |
| `backend/tests/integration/abastecimentos.test.ts` | Mantido setup/cleanup administrativo seguro da main; preservadas limpeza de auditoria e entradas RF40 da S9. |
| `docs/database/schema.sql`, `schema-metadata.json`, `der.mmd`, `dicionario.md` | Regenerados exclusivamente pelo comando oficial a partir do banco combinado; sem mesclar manualmente os gerados. |

`docs/database/README.md` combinou automaticamente o complemento de viagem da main
com a documentação RF40 e a geração do dicionário da S9. Os 23 arquivos locais sem
sobreposição permaneceram inicialmente idênticos à cópia; somente este relatório
recebeu depois o registro da sincronização. Hashes confirmaram preservação integral
da migration/rollback S9 e de todo o frontend autoral do Gustavo. Não houve ampliação
da SCRUM-187/188 nem alteração das decisões pendentes.

O harness aplicou no Docker isolado a migration de viagem trazida pela main,
preservando os hashes das migrations existentes. `db:docs:generate` e `db:docs:check`
confirmaram os quatro artefatos combinados. A bateria final passou **210/210**:

- DB: **102/102**, incluindo os 14 testes de viagem recebidos da main e os 22 RF40.
- HTTP/API abastecimentos: **40/40**; contrato: **18/18**; consumidores: **21/21**.
- Solicitações corrigidas na main: **29/29**, agora executadas diretamente na branch.
- Lint, typecheck/build backend, typecheck testes/scripts, api/client e diff-check: OK.

Não foi identificada regressão causada pela atualização. Os dois testes de bootstrap
da porta fixa 3000 não foram executados: Node PID **75069** está ouvindo nela e foi
preservado. Não são testes de interface E2E. Os dois cenários controlados de interface
documentados anteriormente também não foram corrigidos nem repetidos nesta sincronização.

O backend está tecnicamente validado e sincronizado. O frontend permanece com a
dependência conhecida de tratamento de `quilometragem: null` pelo Gustavo; portanto,
isso ainda impede declarar o build integrado/PR totalmente verde. Não foi alterado
o Jira nesta sincronização. Nenhum arquivo foi adicionado ao staging.

## Complemento independente SCRUM-187/188 — 12/11/2026

Após releitura das duas subtasks e da SCRUM-194, não foi encontrada necessidade de
alterar a implementação já validada para o escopo disponível. Foram acrescentados
**22 testes** e detalhados os limites do [contrato de abastecimentos](../api/abastecimentos.md).
Não houve alteração funcional, migration nova, DTO especulativo, storage paralelo,
fórmula de consumo ou mudança no frontend do Gustavo.

Novos arquivos de evidência:

- `backend/tests/integration/abastecimentos-comprovante-indicadores.test.ts`: 16
  testes HTTP/PostgreSQL reais pelo harness. Vínculo/metadados/bytes JPEG/PNG legados,
  consultas repetidas, privacidade, perfil atual e conta inativa, 401/403/404,
  limites JSON 413/415 versus imagem inválida 400, FK/PK, interrupção do JSON e
  rollback de cadastro+imagem+auditoria em 500/409. Indicadores 0/1/3 independentes,
  decimais e custo ponderado, filtros inclusivos, SVO e km ausente/repetido/regressivo.
- `backend/tests/contract/abastecimentos-s9.test.ts`: 5 testes de OpenAPI/DTOs,
  incluindo os tipos gerados para consumidores. O download continua binário e
  protegido; não publica upload compartilhado inexistente. O schema recusa consumo
  numérico/disponibilidade fabricada e preserva BIGINT/NUMERIC/null.
- `backend/tests/unit/abastecimentos.indicadores.test.ts`: 1 teste com **injeção de
  falha unitária** no repositório, comprovando propagação do erro sem fabricar zero.
  Essa prova é distinta dos cenários HTTP/PostgreSQL e não é mock operacional.

O teste JPEG valida o comportamento de assinatura do legado, não a decodificação
completa de imagem/PDF. O 413/415 do JSON não foi apresentado como aceite dos futuros
erros de upload compartilhado. O atual vínculo não tem autoria/instante próprios de
anexo; a autoria de abastecimento não foi renomeada para simular esses metadados.

Resultado consolidado: **232/232**, em 22 arquivos de teste:

| Grupo | Resultado |
| --- | --- |
| PostgreSQL/DB | 102/102 |
| HTTP/API de abastecimentos | 56/56 |
| Contrato/OpenAPI | 23/23 |
| Consumidores existentes | 21/21 |
| Unitários (29 solicitações + 1 falha de indicadores) | 30/30 |

Lint, typecheck/build backend, typecheck de testes/scripts, `api:check`, `client:check`,
`db:test:prepare`, `db:docs:check` e diff-check aprovados. As fixtures próprias
91870/91871, arquivos e função de falha foram removidos normalmente; conferência
final por SELECT retornou zero resíduos. Não foi necessário repetir E2E de telas
inalteradas. Os limites anteriores de frontend/porta 3000 permanecem registrados.

**SCRUM-187:** entrega parcial; o legado disponível está comprovado. Falta receber
o contrato da SCRUM-194 (e modelo compartilhado), integrar upload privado PDF/JPEG/PNG,
metadados/autoria, reenvio e tratamento de falhas/413/415 desse fluxo, com testes reais.
Não há percentual global confiável enquanto esse contrato estiver indefinido.

**SCRUM-188:** parte independente da fórmula concluída tecnicamente. Falta aprovar
quais leituras/litros compõem o intervalo e suas unidades/arredondamento, implementar
essa regra e validá-la. A subtask inteira permanece não concluída; consumo por distância
continua explicitamente indisponível, inclusive com três leituras.

Nenhuma regressão nova foi identificada nesta etapa. O trabalho validado de DB/backend
está apto a **commit parcial com esses limites documentados**, sem equivaler à conclusão
das duas subtasks ou à aprovação do build integrado. O ajuste de km nulo no frontend
continua externo à entrega backend. Sem alterações no Jira, commit, push, PR ou merge.
