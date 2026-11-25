# Ensaio de backup e restauração da SCRUM-204

Em um checkout com Docker disponível, execute na raiz:

```sh
npm ci
npm run db:test:start
npm run db:test:prepare
npm run db:test:restore
npm run db:docs:check
npm run test:db
```

O comando exige o container e o marcador do banco de teste reconhecidos pelo harness. Verifica o histórico de migrations e a presença do seed sintético. O CI executa o ensaio logo após preparar o PostgreSQL.

O arquivo de backup e o banco de restauração ficam dentro do container verificado. O destino é um banco novo, criado de `template0`, em que `pg_restore` roda em uma única transação. O script compara a definição SQL do esquema e confronta as expressões `CHECK` pelo catálogo para tolerar diferenças de formatação. Para cada tabela de `public` e do histórico do harness, valida a contagem e o SHA-256 das linhas completas ordenadas pelo hash individual. A saída registra a versão do PostgreSQL e os tempos medidos de dump e restore. O arquivo e o destino descartável são removidos ao final.

O ensaio cobre a recuperação lógica do esquema e dos dados sintéticos da revisão instalada. O teste de upgrade desde uma revisão anterior e o ensaio de rollback de migrations têm evidências próprias na SCRUM-204. Backup de produção e recuperação de serviços gerenciados do Supabase exigem plano e validação no ambiente autorizado.
