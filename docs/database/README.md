# Banco reproduzível — T1 (#27)

O banco da aplicação permanece no Supabase. Esta entrega reproduz seu esquema
em uma instância **local descartável do Supabase CLI**, exclusivamente para testes.
Nenhum comando deste fluxo aplica migrations, seed ou reparo de histórico remoto.

## Preparação do zero

Requisitos: Node/npm conforme README da raiz, Docker Desktop com engine Linux
iniciada e portas 55430–55432 livres. A Supabase CLI está fixada no lockfile;
não é necessária instalação global nem conexão com uma conta Supabase.

Execute na raiz deste checkout:

```sh
npm ci
npm run db:test:start
npm run db:test:prepare
npm run db:docs:generate
npm run db:docs:check
npm run test:db
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

A CLI recebe sempre `--workdir backend/src/database`. Sua única raiz é
`backend/src/database/supabase`. A aplicação automática de migrations e seed na
CLI está desligada: o harness verifica a identidade antes de aplicar SQL.
O projeto Docker é `fsph-t1-isolated-2026`; o banco dedicado é `fsph_t1_baseline`,
na porta 55432. API, Studio, Auth, Storage e demais serviços estão desativados.

O primeiro start recusa container ou volume anterior com esse identificador.
Após provisionar, registra ID do container, caminho do checkout e nonce não secreto
em `.test-db/provision.json`; o nonce também identifica o banco via comentário.
Starts seguintes apenas verificam e reutilizam a mesma instância.
Se Docker/container estiver parado ou a identidade tiver sido perdida, o harness
falha sem adotar outro banco. Não apague volumes nem refaça marcadores para contornar
essa verificação; preserve a instância para diagnóstico.

Nenhum comando aceita URL arbitrária, mesmo localhost em outra porta ou outro banco.
Uma `DATABASE_URL` herdada diferente do alvo fixo é recusada antes de abrir conexão.
O harness verifica ID, label, nome, porta publicada e marcador antes de DDL/DML.
Não configure esses comandos com a conexão compartilhada.

## Aplicação incremental e fixtures

`db:test:prepare` aplica arquivos novos ordenados por nome, em uma transação com
advisory lock e histórico de SHA-256 em `fsph_test_harness.migrations` (finais de
linha normalizados para LF entre Windows/Linux). Arquivo já
aplicado com hash diferente provoca erro; não há reset, repair ou reaplicação de DDL.
O seed roda na mesma transação. A baseline falha se encontrar tabelas já existentes:
não é um mecanismo de reconciliação para banco existente.

Fixtures usam IDs negativos reservados de -27099 a -27001, nomes explícitos,
e-mails `example.invalid`, datas fixas e hash bcrypt exclusivamente artificial.
A senha das fixtures é `T1-fixture-2026!`. Elas cobrem todos os perfis e valores
dos sete enums; não representam combinações ou regras de alocação aprovadas.
O seed não avança sequências positivas e `ON CONFLICT (id) DO NOTHING` permite
repetição. Testes adicionais usam transações com rollback e IDs próprios.
Nenhuma linha operacional foi consultada ou exportada.

## Esquema auditado e proveniência

Fonte: catálogos do Supabase conectado, consultados em leitura pelo MCP em
30/10/2026, como `supabase_read_only_user`, PostgreSQL 17.11.
Foram capturados tipos completos via `format_type`, defaults, enums em ordem,
sequências (sem valores correntes), proprietários, ACLs de objetos/schema/defaults,
constraints com validação e ações, índices, RLS, policies e triggers não internos.
São 10 tabelas, 99 colunas, 7 enums, 36 constraints e 19 índices PK/UNIQUE.
Nenhum trigger público não interno ou policy pública foi encontrado.
Uma consulta complementar confirmou ausência de ACLs por coluna, rotinas em public
e defaults globais de ACL para postgres/supabase_admin fora do schema public.

Os tamanhos de varchar e `numeric(10,2)` foram confirmados no catálogo completo;
o resumo inicial da issue mãe não incluía todos os modificadores dos tipos.
As duas FKs divergentes de auditoria e o CHECK de vínculo VALIDADO são preservados.
RLS continua desligada e os grants amplos para anon/authenticated/service_role
são reproduzidos. **A baseline NÃO é configuração segura para nova publicação.**
A exposição efetiva da Data API não foi comprovada.

Os incrementais antigos foram consolidados na baseline, sem reaplicar ADD COLUMN:

- [arquivo de documentos original](https://github.com/rukioi/FSPH_RESIDENCIA-EM-SOFTWARE-IA_SQUAD-22/blob/fb3a885b033d7d3ab24ef8524a0be8fcabbea90f/backend/migrations/be-s6-02-arquivo-documentos.sql):
  `arquivo_dados`, `arquivo_nome`, `arquivo_tipo`.
- [vínculo de veículos original](https://github.com/rukioi/FSPH_RESIDENCIA-EM-SOFTWARE-IA_SQUAD-22/blob/fb3a885b033d7d3ab24ef8524a0be8fcabbea90f/backend/migrations/be-s6-02-vinculo-veiculos.sql):
  `vinculo`, `fornecedor_locacao` e `veiculo_vinculo_check`.
  O SQL histórico propunha NOT VALID; o catálogo atual comprova validação.

A baseline inicial foi renderizada pelo gerador a partir dessa captura de metadados.
Depois de aplicada localmente, `db:docs:generate` gera schema.sql,
schema-metadata.json e der.mmd exclusivamente dos catálogos locais; não edite esses
artefatos manualmente. `db:docs:check` compara todos os artefatos e detecta drift,
inclusive ACL/RLS, índices, tipos, nullabilidade, defaults e ações de exclusão.
O snapshot permite bootstrap sem MCP. Mudanças futuras usam nova migration local,
seguida de geração, revisão do diff e testes. Nunca use db pull, db push ou repair
remotos neste fluxo.

## Isolamento dos testes e limites do escopo

Vitest verifica o banco antes de carregar os testes e injeta URL fixa, nonce e
JWT_SECRET artificial. Os dois módulos atuais de conexão recusam bootstrap de
teste sem identidade explícita. O servidor e o pool legado deixam de carregar
dotenv em NODE_ENV=test. Playwright usa um bootstrap próprio com ambiente explícito
e não reutiliza servidor existente. Não há fallback para segredos do desenvolvedor.

Os arquivos connection.ts, config/db.ts e server.ts, além da lista inicial de #27,
receberam somente as guardas necessárias para cumprir esse isolamento. A unificação
de bootstrap/pool e o TLS fora dos testes pertencem a T2 (#28).

| Decisão pendente | Limite preservado em T1 |
| --- | --- |
| D1 (#23) | Não define disponibilidade, alocação ou métricas. |
| D2 (#24) | Não muda ACL/RLS nem revogação; snapshot fiel apenas. |
| D3 (#25) | Não remove FKs, muda exclusão/nullabilidade ou inventa checks. |
| D4 (#26) | Não converte timestamps sem fuso; datas civis permanecem date. |

A baseline não será aplicada em banco existente sem reconciliação revisada.
Reverter código no Git não reverte banco ou permissões. Não há down destrutivo.
O próximo ticket da sequência é T2 (#28); somente T7 abre/atualiza o PR final.

## Evidências desta entrega — 30/10/2026

- Docker Engine 29.6.2, Supabase CLI 2.122.0 e PostgreSQL local 17.11;
  projeto `fsph-t1-isolated-2026`, banco `fsph_t1_baseline`.
- Comparação integral da captura MCP com o resultado local: igualdade após apenas
  ordenar entradas das ACLs; nenhum tipo, default, grantor, privilégio, índice,
  constraint ou ação de exclusão foi descartado da comparação.
- O gerador preserva a expressão IN do CHECK original para manter a mesma árvore
  de expressão/deparse PostgreSQL. Uma primeira tentativa local de reconstrução
  ficou em outro banco descartável do mesmo container, sem remoção de dados.
- `db:test:start` executado e repetido; `db:test:prepare` executado e repetido,
  sem duplicação de fixtures ou avanço das sequências pelo seed.
- `db:docs:generate` e `db:docs:check` passaram. O teste de drift revoga SELECT
  de anon somente localmente, comprova a falha do check e restaura o privilégio.
- `test:db`: 16 testes reais passaram, incluindo FK (23503), UNIQUE (23505),
  CHECK (23514), caminho feliz, rollback, cobertura dos enums, seed idempotente,
  recusa de URL arbitrária e recusa de histórico de migration divergente.
- `npm test`: 102 testes passaram; `npm run typecheck` inclui agora os testes
  backend e passou; `npm run build` passou.
- `npm run test:e2e`: 5 testes passaram com o bootstrap isolado. Capturas da tela
  de login em 390/768/1280 px foram conferidas visualmente, sem corte/rolagem
  horizontal; ficam em `test-results/`, fora do Git.
- Os três erros de lint preexistentes foram corrigidos com autorização explícita
  do responsável nesta sessão: const em auditoria e dois catches sem parâmetro
  não usado em usuários. Esses controllers legados não mudaram comportamento ou
  contrato HTTP. Essa é a única ampliação adicional do escopo inicial de T1.
  Após essas correções, `npm run lint` passou sem erros.

Limites da prova: nenhuma publicação, migração em banco existente, escrita remota,
linha operacional ou teste da Data API compartilhada. As decisões D1–D4 continuam
pendentes. Os dois pools existentes permanecem para T2; nesta entrega receberam
somente o isolamento necessário aos testes. A infraestrutura de produção não foi
validada por estes testes locais.

## Limite de acesso direto — #29

O snapshot continua reproduzindo grants/RLS auditados; não foi criada migration
ACL porque o papel runtime do backend e a exposição Data API remotos não puderam
ser confirmados sem credenciais. A estratégia mínima é ensaiada exclusivamente
no harness, com papel runtime simulado sem privilégios de dono, revogações e
provas reais de acesso, tudo em transação com rollback. Nenhum gerado foi editado.
Pré-condições e limites de rollout em [segurança](../seguranca.md#identidade-e-autorização-atuais--29).
