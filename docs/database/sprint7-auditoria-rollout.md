# Rollout da auditoria institucional em banco populado

**Pendência operacional:** nenhum alvo compartilhado foi inspecionado ou alterado.
O responsável deve confirmar quais bancos têm logs e ainda precisam da versão
20261104000003. A migration histórica e seu hash permanecem imutáveis; os runners
locais continuam adequados à reconstrução de banco novo, não ao rollout online.

## Inspeção somente de leitura e critérios de parada

Antes de DDL ou reparo de histórico, confirmar ambiente, autorização própria,
backup, volume de logs, transações longas e janela de execução. Consultas iniciais:

~~~sql
SELECT c.reltuples AS linhas_estimadas, pg_total_relation_size(c.oid) AS bytes
FROM pg_class c WHERE c.oid = to_regclass('public.log_atividade');
SELECT a.attname, format_type(a.atttypid,a.atttypmod) AS tipo, a.attnotnull,
       pg_get_expr(d.adbin,d.adrelid) AS valor_default
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
WHERE a.attrelid=to_regclass('public.log_atividade')
  AND a.attname='solicitacao_viagem_id' AND NOT a.attisdropped;
SELECT conname, contype, convalidated, condeferrable, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid=to_regclass('public.log_atividade');
SELECT c.relname, i.indisvalid, i.indisready, pg_get_indexdef(i.indexrelid)
FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
WHERE i.indrelid=to_regclass('public.log_atividade');
~~~

Inspecionar o histórico conforme [reconciliação da Sprint 7](./sprint7-reconciliacao.md).
Objetos equivalentes exigem coluna BIGINT nullable sem default, FK validada para
public.solicitacao_viagem(id), MATCH SIMPLE, NO ACTION e não deferrable, além de índice
btree não único, não parcial, apenas nessa coluna, pronto e válido. Nomes coincidentes
não bastam. Divergência, FK não validada ou índice inválido bloqueiam a marcação
como aplicada e o rollout da API dependente. Não remover objetos/dados para contornar.

Se coluna/FK/índice já forem equivalentes e a versão já estiver registrada, não
reaplicar DDL. Se equivalentes mas sem histórico, reconciliar somente após aprovação.
Se houver tabela populada e objetos ausentes, não executar a migration histórica
em uma transação longa: sua adição de coluna segura lock forte até o commit, a FK
valida dados existentes e o CREATE INDEX comum bloqueia escritas durante a construção.

## Etapas propostas, apenas para alvo explicitamente autorizado

Estes exemplos não são migration automática nem autorização para executar no remoto.
Confirmar ausência de cada objeto antes de sua etapa; nunca ignorar divergências com
IF NOT EXISTS. As transações curtas ainda exigem locks: definir limites e monitorar.

1. Somente se a coluna estiver ausente:

~~~sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.log_atividade ADD COLUMN solicitacao_viagem_id BIGINT;
COMMIT;
~~~

2. Somente se não houver FK equivalente, adicionar sem varrer o legado:

~~~sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.log_atividade
  ADD CONSTRAINT log_atividade_solicitacao_viagem_id_fkey
  FOREIGN KEY (solicitacao_viagem_id) REFERENCES public.solicitacao_viagem(id) NOT VALID;
COMMIT;
~~~

3. Conferir órfãos por contagem, sem expor linhas pessoais, e validar separadamente.
Não preencher nem associar logs antigos automaticamente. Orfandade exige plano de dados próprio.

~~~sql
SELECT count(*) AS orfaos FROM public.log_atividade l
LEFT JOIN public.solicitacao_viagem s ON s.id=l.solicitacao_viagem_id
WHERE l.solicitacao_viagem_id IS NOT NULL AND s.id IS NULL;
BEGIN;
SET LOCAL lock_timeout = '2s';
ALTER TABLE public.log_atividade VALIDATE CONSTRAINT log_atividade_solicitacao_viagem_id_fkey;
COMMIT;
~~~

VALIDATE usa lock menos restritivo, mas não é operação sem custo: dimensionar
statement_timeout da sessão/janela e monitorar a varredura. FK NOT VALID já verifica
novas escritas; convalidated=false não atende ao estado final exigido.

4. Somente se o índice estiver ausente, em conexão dedicada **fora de BEGIN**:

~~~sql
CREATE INDEX CONCURRENTLY idx_log_atividade_solicitacao_viagem_id
ON public.log_atividade (solicitacao_viagem_id);
~~~

Não colocar esse comando em migration dos runners atuais, que encapsulam cada arquivo
em uma transação. Se a construção falhar, pode sobrar índice inválido; não usar
IF NOT EXISTS para silenciar isso. Parar e solicitar plano explícito ao DBA, sem
DROP automático. Não executar duas construções concorrentes na mesma tabela.

5. Repetir a inspeção, exigir FK validada/índice válido e comparar o estado final
com schema-metadata.json. Só então autorizar reconciliação da versão 20261104000003
no histórico remoto, sem replay do ADD COLUMN com REFERENCES ou do CREATE INDEX comum.
Uma migration posterior não evita a execução de uma anterior pendente. Se a equipe
exigir artefato executável por alvo, produzir um pacote de rollout separado com
escopo e runner não transacional explícitos, após identificar o alvo; não reescrever
esta migration nem acrescentar DDL universal que ignore o histórico existente.

## Evidência e limites

O teste auditoria-rollout.test.ts executa as etapas em tabelas de fixture populadas
em schema exclusivo do PostgreSQL verificado, incluindo CREATE INDEX CONCURRENTLY
fora de transação. Não remove bancos/volumes nem altera a tabela pública ou o histórico
Supabase. O ensaio comprova sintaxe, fronteiras transacionais e estado final;
não prova a duração dos locks ou a capacidade de um banco compartilhado desconhecido.

Referências: [ALTER TABLE PostgreSQL 17](https://www.postgresql.org/docs/17/sql-altertable.html)
e [CREATE INDEX CONCURRENTLY](https://www.postgresql.org/docs/17/sql-createindex.html).
