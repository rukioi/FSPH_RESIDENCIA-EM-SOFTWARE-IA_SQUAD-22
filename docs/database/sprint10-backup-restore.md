# Ensaio de backup e restauração da SCRUM-204

Em um checkout com Docker disponível, execute na raiz:

```sh
npm ci
npm run db:test:start
npm run db:test:prepare
npm run db:test:restore
npm run db:test:upgrade
npm run db:docs:check
npm run test:db
```

O comando exige o container e o marcador do banco de teste reconhecidos pelo harness. Verifica o histórico de migrations e a presença do seed sintético. O CI executa o ensaio logo após preparar o PostgreSQL.

O arquivo de backup e o banco de restauração ficam dentro do container verificado. O destino é um banco novo, criado de `template0`, em que `pg_restore` roda em uma única transação. O script compara a definição SQL do esquema e confronta as expressões `CHECK` pelo catálogo para tolerar diferenças de formatação. Para cada tabela de `public` e do histórico do harness, valida a contagem e o SHA-256 das linhas completas ordenadas pelo hash individual. A saída registra a versão do PostgreSQL e os tempos medidos de dump e restore. O arquivo e o destino descartável são removidos ao final.

## Upgrade com dados e recuperação

O ensaio fixa a revisão anterior em `20261111000000_add_tipo_evento_log_atividade.sql`. Ela já aceita os status do seed e os formatos de arquivo legados em documentos, comprovantes de abastecimento e evidências de viagem. O script aplica as migrations até esse ponto em um banco novo, carrega o seed T1 e as [fixtures de arquivo](../../backend/tests/database/fixtures/scrum-204-legacy-files.sql) e captura o backup antes de avançar.

| Pendência na revisão anterior | Dependência e resultado esperado |
| --- | --- |
| `20261112000000` | Cria anexos, histórico e anotações com vínculos ao modelo existente. Os bytes legados continuam nas tabelas de origem. |
| `20261113000000` | Amplia o modelo RF40 preservando motorista e quilometragem já cadastrados. A autoria legada permanece nula. |
| `20261114000000` | Valida as restrições adicionadas na etapa anterior. |

O upgrade compara o esquema resultante com a instalação limpa e confere as linhas completas das tabelas legadas. Os hashes incluem IDs, vínculos, status e bytes. O campo novo de autoria é verificado separadamente. Cada migration é confirmada em sua própria transação.

Para ensaiar a reversão RF40, o script insere um abastecimento válido no modelo novo e tenta os dois scripts de retorno em ordem inversa, em uma transação. A recusa esperada preserva o esquema e todas as linhas, incluindo o registro novo. Em seguida o script restaura o backup anterior em outro banco descartável e confere esquema, permissões, contagens e hashes contra o estado pré-upgrade. A restauração de um ponto anterior exige preservar ou reconciliar separadamente as gravações feitas depois do backup. Os logs do CI registram a revisão, a lista de migrations, os resultados de integridade e os tempos observados de dump e restore.

Backup de produção e recuperação de serviços gerenciados do Supabase exigem plano e validação no ambiente autorizado.
