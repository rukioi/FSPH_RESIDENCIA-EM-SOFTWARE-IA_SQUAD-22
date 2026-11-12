# Sprint 9 — base documental e evidências (SCRUM-192)

Escopo: [SCRUM-182](https://unit-tiradentes.atlassian.net/browse/SCRUM-182),
[SCRUM-192](https://unit-tiradentes.atlassian.net/browse/SCRUM-192) e dependências
da [SCRUM-183](https://unit-tiradentes.atlassian.net/browse/SCRUM-183).
Este documento registra a base DB e, ao final, a continuação das APIs dependentes.
O estado atual está no fechamento abaixo. Telas e tasks de frontend do Gustavo
permanecem intactas; somente os dois artefatos gerados foram autorizados.

## Inventário e compatibilidade

| Estrutura existente | O que já existe | Lacuna confirmada |
| --- | --- | --- |
| `documento_veiculo` | Veículo, tipo, validade civil e arquivo BYTEA opcional; POST JSON/multipart e listagem | Sem versão, autor/instante de alteração ou download compartilhado autorizado |
| `motorista` | CNH/categoria/validade, mantidas pelo cadastro da gestão | Sem histórico documental; motorista não ganha edição da própria CNH |
| `abastecimento_comprovante` | JPEG/PNG até 1 MiB, bytes vinculados ao abastecimento e download protegido | Contrato legado não satisfaz sozinho SCRUM-187/194 |
| `viagem_evidencia` | Foto inicial/final versionada, autoria e bytes privados | Preservar regras S8; integração compartilhada pertence à SCRUM-194 |
| `ordem_coleta` | Referências textuais de fotos | Não equivalem a evidências privadas validadas |
| `notificacao` | Destinatário e chave única, leitura e sincronização existente | Regra nova RF46 depende de decisão; não criar outro mecanismo de avisos |

A migration é **aditiva**: não reescreve bytes, CNHs, tabelas legadas, autores,
datas ou notificações. Não copia arquivos antigos para preencher uma timeline
artificial. Os novos vínculos não substituem os contratos antigos nesta etapa.

## Modelo implementado

`anexo` guarda arquivo e metadados na mesma transação PostgreSQL, aproveitando a
estratégia BYTEA já usada no projeto. Não depende de disco efêmero, bucket novo,
credencial adicional ou URL pública. A chave UUID identifica o objeto privado;
conhecê-la não concede acesso. SHA-256 e tamanho precisam corresponder aos bytes.
O limite técnico comum é 5 MiB, com assinatura PDF/JPEG/PNG, conforme o upload
de documentos existente. As APIs poderão manter limites menores de cada domínio.
Assinatura não equivale a antivírus nem à decodificação integral do documento.

Cada anexo referencia **exatamente um** registro por FK explícita: solicitação
de viagem, solicitação SVO, viagem, ordem de coleta, abastecimento, veículo,
motorista ou documento de veículo. Não há par tipo/ID sem integridade referencial.
Bytes iguais em registros diferentes continuam com chaves/vínculos distintos;
não há deduplicação global que permita inferir ou acessar o arquivo de outro usuário.

`documento_historico` registra versões de documento veicular ou CNH: validade
civil, campos documentais mínimos, autor e instante com fuso. A combinação
registro/versão é única. FKs compostas impedem associar à versão o anexo de outro
documento/motorista. O cadastro atual continua em suas tabelas existentes.
Na SCRUM-193, escrita do cadastro e inclusão da versão deverão compartilhar
transação, bloqueio e conferência de versão. A tabela sozinha não captura as
escritas legadas automaticamente. Nenhum autor/instante antigo foi inventado.

`anotacao` prepara RF48 com texto de até 2.000 caracteres, autor, instante e uma
FK para solicitação, viagem, ordem ou veículo. Não muda estado/decisão do registro.
As regras de autoria, leitura e validação HTTP serão implementadas na SCRUM-196.

Índices por vínculo/instante/ID suportam leitura determinística dos anexos/notas.
Índices de validade preservam datas civis nas tabelas existentes; não materializam
contadores, não escolhem janelas RF46 nem inferem fuso dos timestamps legados.

## Segurança e limites

As três tabelas têm RLS habilitada sem policies públicas, revogação de grants de
PUBLIC/anon/authenticated e revogação de UPDATE/DELETE/TRUNCATE de postgres e
service_role. Assim como na entrega S8, o histórico é append-only para esses
papéis. O proprietário e administradores do banco continuam capazes de manutenção;
não se afirma imutabilidade contra superusuário.

A proteção direta do banco **não substitui RBAC por registro na API**. A SCRUM-194
deverá validar sessão atual, perfil, vínculo e ação a cada upload/listagem/download;
a SCRUM-193 preservará CNH pela gestão; a SCRUM-196 aplicará o mesmo escopo às
notas. Nenhuma permissão HTTP foi ampliada nesta migration. Antes de rollout,
confirmar o papel runtime e a exposição Data API como exige `docs/seguranca.md`.

## Decisão de negócio pendente — RF46

Em 12/11/2026 o responsável confirmou que não há definição aprovada no Jira para:

- “1 mês”: mês de calendário ou 30 dias;
- fuso do calendário de alertas;
- frequência de repetição/deduplicação e forma de disparo.

**Não escolher nenhuma dessas alternativas e não automatizar novos alertas.**
Preservar as consultas/sincronização existentes, sem apresentá-las como aceite
da nova RF46. A mesma limitação permanece na SCRUM-193 até decisão oficial.
Reutilizar `notificacao` quando a regra for publicada; não criar scheduler,
gatilho ou tabela paralela de avisos para antecipá-la.

## Migration, reversão e prova

Migration: `backend/src/database/supabase/migrations/20261112000000_db_s9_02_documentos_evidencias.sql`.
Reversão: mesmo nome em `backend/src/database/supabase/rollbacks/`.

O rollback é manual e exige transação. Obtém bloqueio exclusivo das três tabelas
**antes** de conferir se estão vazias. Havendo qualquer anexo, versão ou nota,
recusa a operação; não apaga história nem usa CASCADE. Sem dados novos, remove
somente as estruturas/índices introduzidos. A prova executa rollback/reaplicação
em transação no Docker isolado e desfaz o ensaio integralmente.

O harness confirmou container, checkout, porta 55432 e marcador de
`fsph_t1_baseline`. `db:test:prepare` aplicou o incremento oficial;
`db:docs:generate` regenerou schema, metadados, DER e dicionário. Os objetos
anteriores permanecem estruturalmente idênticos, exceto os dois índices de
validade explicitamente adicionados. Não houve acesso ao banco compartilhado.

`backend/tests/database/documentos-evidencias-s9.test.ts` cobre as oito FKs,
vínculo único, bytes/metadados, hash, limite exato/excedente, nome malicioso,
assinatura, autoria, versões, data inválida, vínculo cruzado, ACLs, notas e
rollback com/sem registros. As fixtures usam IDs próprios e transações revertidas;
não entram no seed geral. O teste de estrutura falhou antes da migration por
ausência das tabelas; passou depois da aplicação.

Uma particularidade constatada no teste de data: o serializador de objetos do
driver pode normalizar uma string inválida via `Date` antes de enviá-la ao SQL.
A API da SCRUM-193 deverá validar estritamente `YYYY-MM-DD` antes de qualquer
conversão; o ensaio DB usa texto convertido no PostgreSQL para comprovar rejeição
de 29/02 em ano não bissexto.

Validação de 12/11/2026:

| Comando/conjunto | Resultado |
| --- | --- |
| `db:test:start`, `db:test:prepare` | Identidade verificada e migration aplicada somente no isolado |
| `test:db` | 132/132, incluindo 30 testes novos da SCRUM-192 |
| Integração documentos, motoristas, abastecimentos, notificações e contratos relacionados | 109/109 |
| `lint`, `git diff --check` | Passaram |
| Typecheck/build backend e typecheck dos testes | Passaram |
| `api:check`, `client:check`, `db:docs:check` | Passaram |
| Typecheck/build globais | Bloqueados exclusivamente pelo `number \| null` em `frontend/src/pages/abastecimentos/Abastecimentos.tsx:311`, pendência já reservada ao Gustavo |

Não foi repetida a suíte E2E: esta etapa não mudou telas, rotas ou handlers HTTP.
Os testes HTTP existentes não comprovam endpoints futuros da SCRUM-194; eles
verificam compatibilidade dos consumidores atuais com a migration aditiva.

## Sequência de trabalho

1. **192:** base DB concluída e conferida novamente em 30/30 testes isolados;
   Jira atualizado em 12/11/2026 por autorização expressa. A decisão RF46 não
   foi automatizada; autorização por recurso é responsabilidade da API 194.
2. **194:** upload/listagem/download compartilhados com RBAC e transação reais.
3. **187:** integrar comprovante ao contrato compartilhado; manter legado compatível.
4. **193/196:** APIs documental/histórico e notas; RF46 continua limitada à decisão acima.
5. **195:** agregações reais, preservando o consumo por distância indisponível da
   SCRUM-188 até regra aprovada. Não completar indicadores com zeros artificiais.

Nenhum novo commit, push, PR, merge ou alteração nas tasks de frontend nesta etapa.

## Fechamento e continuação — 12/11/2026

- **SCRUM-192:** concluída no Jira (comentário 10050), com 30/30 provas específicas
  e suíte DB consolidada 132/132. Alerta RF46 continua decisão de negócio pendente.
- **SCRUM-194:** concluída no Jira (10051). Infraestrutura privada reutilizável,
  oito vínculos autorizados, upload/lista/download, assinatura e tamanho reais,
  auditoria atômica. 25/25 testes HTTP→API→PostgreSQL novos; ver `docs/api/anexos.md`.
- **SCRUM-187:** concluída no Jira (10052). Comprovante integra exatamente a 194,
  com fallback legado, reenvio preservando histórico e rollback real. 8/8 testes
  HTTP→API→PostgreSQL novos; ver `docs/api/abastecimentos.md`.
- **SCRUM-193:** parte independente implementada, 14/14 testes reais. Consulta
  paginada, detalhe, histórico, versão/409, CNH pela gestão e auditoria dos writes
  legados. Não concluir: falta RF46. Corrigida gravação BYTEA documental comprovada
  em teste que falhou antes e passou depois; sem reparo automático de legados.
- **SCRUM-196:** notas privadas implementadas e tecnicamente validadas em 10/10
  testes reais, sem alterar estado dos registros; ver `docs/api/anotacoes.md`.
- **SCRUM-195:** composição real disponível e 6/6 testes integrados novos. Gestão
  e SVO separados; preservados endpoints anteriores. Não concluir: decisões RF46
  e consumo por distância ainda impedem a parte dependente. Nenhum zero artificial.

### Verificação consolidada

`npm test` executou 914 testes: 911 passaram inicialmente. Um teste de inventário
precisou fornecer os vínculos agora obrigatórios de anexos/notas (o antigo laço
consultava todos os GETs sem query). Corrigido o teste, o arquivo passou 8/8,
incluindo a exigência de 400 sem vínculo e 200/schema válido com recurso real.
Resultado acumulado: **912 aprovados; dois bloqueados por ambiente**.

Os dois testes de bootstrap exigem a porta fixa 3000 e falharam por prazo; um Node
preexistente (PID 94389) escutava nela. A porta 5173 também estava ocupada (PID 24022).
Nenhum processo do usuário foi encerrado. O E2E oficial exige ambas livres e
**não foi executado nesta rodada**; não foi apresentado mock como evidência real.
Teardown de `tests/e2e/motoristas.spec.ts` foi atualizado para limpar somente o
histórico dos próprios motoristas sintéticos via admin verificado do harness.

Detalhamento: DB 132/132; contratos 37/37; provas novas HTTP/PG 63/63. Lint,
types backend/testes/scripts, build backend, api/client/db:docs e diff-check
passaram. Após o ajuste do inventário foram repetidos somente os testes afetados.

Typecheck/build globais continuam falhando exclusivamente no frontend do Gustavo,
`Abastecimentos.tsx:311`, por km `number | null`. Contrato não foi mascarado.
Uploads FormData/download PDF também precisam de integração pelo frontend; os
dois arquivos autorizados em `frontend/src/shared/api/generated/` foram gerados
por script. Nenhum código manual do frontend foi alterado.

Nenhuma regra RF46/consumo, banco compartilhado, `.env`, seed geral ou tarefa do
Gustavo foi alterada. Há evidência de API/SQL real, sem alegar E2E visual nesta rodada.
