# Sprint 7: reconciliação antes do rollout

**Pendência operacional aberta:** o Supabase compartilhado não foi consultado nem corrigido por esta entrega. A informação de aplicação manual veio do responsável. Incluir a migration no Git não equivale a reconciliar seu histórico remoto.

## Decisão e escopo

Preservar as quatro migrations publicadas, inclusive
[20261104000002_add_retorno_previsto.sql](../../backend/src/database/supabase/migrations/20261104000002_add_retorno_previsto.sql).
Ela funciona após a baseline em banco novo. Em banco com o CHECK já existente,
repetir ADD CONSTRAINT falha com duplicate_object (42710). ADD COLUMN IF NOT EXISTS
não verifica o tipo de uma coluna existente. Não substituir isso por captura de erro,
DROP/ADD, nem por uma condição que ignore silenciosamente uma definição divergente.

Os runners de testes e Compose registram SHA-256 do SQL normalizado para LF.
Reescrever uma migration aplicada invalida esse histórico; adicionar uma migration
posterior não impede que a anterior pendente seja tentada primeiro. Nenhum arquivo
histórico foi alterado nesta correção. O histórico Supabase é separado dos históricos
locais fsph_test_harness.migrations e fsph_compose_meta.migrations: não copiar estes
registros para o remoto.

## Pré-verificação somente de leitura

O responsável deve confirmar o projeto/ambiente correto, obter autorização própria,
backup e janela de rollout. Usar sessão/usuário de leitura para os passos abaixo;
não usar os runners de testes ou Compose no banco compartilhado.

1. Inventariar primeiro as relações e o histórico, sem supor sua existência:

~~~sql
SELECT to_regclass('public.solicitacao_viagem') AS tabela,
       to_regclass('supabase_migrations.schema_migrations') AS historico;
~~~

Se o histórico existir, listar apenas as versões:

~~~sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
~~~

Se não existir, parar e planejar a adoção do histórico do projeto inteiro. Não
aplicar a baseline a um banco populado nem marcar todas as versões em lote.

2. Executar a consulta [inspect-retorno-previsto.sql](../../backend/src/database/scripts/inspect-retorno-previsto.sql).
Ela faz somente SELECT de catálogos. Confere tabela public comum, saída timestamp
without time zone NOT NULL, retorno do mesmo tipo sem precisão restrita, nullable,
sem default/identity/generated, CHECK local validado e expressão canônica exata
(retorno IS NULL OR retorno > saída), sem NO INHERIT. Mesmo nome não prova equivalência.

| Estado | Ação obrigatória |
| --- | --- |
| TABELA_AUSENTE | Verificar se é banco novo e suas dependências; nunca adotar como banco existente equivalente. |
| AUSENTE | Em banco novo com baseline compatível, executar normalmente a migration pelo processo aprovado. Em banco existente, revisar as demais dependências antes de qualquer DDL. |
| PARCIAL | Coluna compatível, mas sem CHECK: não marcar como aplicada. Planejar conclusão autorizada da mudança e repetir todas as verificações. |
| EQUIVALENTE | Candidato à reconciliação; ainda exige conferência de dados, dependências, versão e histórico. Não repetir o ADD CONSTRAINT. |
| DIVERGENTE | Bloquear rollout e qualquer marcação como aplicada. Registrar a diferença e preparar correção versionada específica com o responsável. |

A comparação usa pg_get_expr na forma canônica de PostgreSQL 17. Mudança de versão
ou outra expressão possivelmente equivalente deve parar para análise humana; não
remover operadores/parênteses para forçar um resultado positivo. NOT VALID também
é divergente, mesmo quando a expressão coincide.

3. Somente depois de confirmar a coluna, conferir violações sem retornar dados pessoais:

~~~sql
SELECT count(*) AS retornos_invalidos
FROM public.solicitacao_viagem
WHERE data_hora_retorno_previsto IS NOT NULL
  AND data_hora_retorno_previsto <= data_hora_saida;
~~~

O resultado deve ser zero e convalidated deve ser true. Não corrigir registros
históricos automaticamente. Conferir adicionalmente finalidade TEXT nullable,
APROVADA na posição esperada do enum, FK/índice da auditoria e a evolução SVO.
Comparar definições com os artefatos versionados, incluindo grants/RLS, sem aplicar
schema.sql como uma migration. Os snapshots locais não provam o estado remoto.

## Reconciliação controlada pelo responsável

Somente após todas as equivalências e dependências confirmadas, autorização
explícita de escrita e identificação inequívoca do alvo:

1. Se a versão 20261104000002 já estiver registrada e o schema conferir, não executar
   novamente seu SQL nem alterar o registro.
2. Se a versão estiver ausente, mas todos os seus efeitos forem equivalentes,
   o responsável poderá registrar **somente essa versão** como aplicada usando o
   procedimento oficial Supabase migration repair com status applied. Isso escreve
   no histórico remoto, não executa o SQL nem comprova equivalência por si só.
   Conferir os parâmetros de alvo e workdir da CLI fixada no projeto antes de usar.
3. Repetir a listagem do histórico e a inspeção de schema; revisar a lista completa
   de migrations pendentes antes de autorizar o rollout. Não executar db push,
   baseline ou repair indiscriminadamente. Não remover histórico divergente para
   silenciar erro de hash. Aplicar o mesmo critério às outras alterações manuais.

Referência: [Supabase: migrations e alterações manuais](https://supabase.com/docs/guides/deployment/database-migrations).
Nenhum comando de escrita remota é executado pelos arquivos desta correção.

Se houver divergência, não há reconciliação automática segura. Uma correção de
schema exige plano próprio, preservação de dados e ensaio isolado; alterações em
CHECK existente podem exigir varredura e bloquear escritas. Avaliar janela e,
quando apropriado, uma nova mudança NOT VALID/VALIDATE, sem reescrever esta migration
nem considerar um CHECK não validado como equivalente ao contrato atual.

## Hashes imutáveis e ensaio isolado

SHA-256 de cada arquivo após normalização CRLF → LF, conforme os runners:

| Migration | SHA-256 |
| --- | --- |
| 20261104000000_add_finalidade_solicitacao_viagem.sql | c522963492a7507d27d40517d2122f1c60fa2d7be30fc761ebe9317f4559bc8c |
| 20261104000001_add_status_aprovada.sql | ac61d1d1d1048cfcbd730baecc7b36a2e0e66c783e32ebd3cc6d21d2e2784971 |
| 20261104000002_add_retorno_previsto.sql | a02ee5461e12acccf33207143e694b3e32e86904296e5988206568d72d6b0974 |
| 20261104000003_add_solicitacao_viagem_id_log_atividade.sql | eb948c721d2bee2c3bf4e094b6a83d02ad6c73851a975c7989d2e497bbbba6d5 |

O teste backend/tests/database/retorno-reconciliacao.test.ts usa verifiedSql(true):
identidade Docker, porta, checkout, nonce e marcador são verificados antes de DDL.
Fixtures criam tabelas em schemas efêmeros, em transações revertidas; só a qualificação
do schema é adaptada no SQL real da migration e na inspeção, sem editar o arquivo.

- A: tabela nova sem retorno/CHECK executa a migration, preserva null legado e rejeita retorno igual à saída.
- B: definição equivalente é reconhecida; replay falha 42710 e a definição continua intacta. A ação indicada é reconciliação humana, não DDL automático.
- C: definição divergente com >= recebe DIVERGENTE e não é substituída nem marcada como aplicada.
- Estados parcial, CHECK não validado e tipo divergente também são recusados como equivalentes.

Nenhum teste faz repair ou grava histórico Supabase. A criação real do banco completo
continua coberta por db:test:prepare com baseline e todos os incrementais ordenados;
db:docs:check confere o resultado contra schema, metadados e DER. Esses ensaios não
atestam nem corrigem o ambiente compartilhado.

Para a FK e o índice da auditoria em tabela populada, seguir também o
[rollout em etapas da auditoria](./sprint7-auditoria-rollout.md). Não usar o
runner transacional para CREATE INDEX CONCURRENTLY.

## Inventário completo antes da decisão de rollout

O responsável pode executar [inspect-sprint7.sql](../../backend/src/database/scripts/inspect-sprint7.sql) em uma sessão somente leitura do ambiente previamente identificado. O script consulta apenas catálogos: tipos, limites de caracteres, nulabilidade/defaults, ordem do enum, CHECK/UNIQUE/FKs validadas, definições e validade dos índices e existência dos históricos. Para codigo varchar(20), origem/destino varchar(255) e log_atividade.descricao text, todos NOT NULL, apresenta os valores esperados e classifica cada coluna como EQUIVALENTE, DIVERGENTE ou AUSENTE. As demais colunas exigem comparação manual. Não lê credenciais nem dados pessoais, não cria objetos e não registra versões. O teste solicitacoes-preflight.test.ts o executa em transação READ ONLY no PostgreSQL isolado.

Comparar cada linha com schema.sql/schema-metadata.json da mesma revisão: finalidade TEXT nullable; APROVADA após PENDENTE; retorno timestamp without time zone nullable, sem default e CHECK equivalente validado; vínculo BIGINT nullable da auditoria com FK e índice válidos. Conferir também os cinco índices do incremento 20261105000000, inclusive ordem de colunas, INCLUDE e predicados; nome igual não comprova equivalência. O script de retorno continua sendo a classificação conservadora da expressão CHECK.

Versão ausente com efeito equivalente exige reconciliação individual autorizada; efeito parcial/divergente bloqueia a marcação. Versão presente com efeito divergente também bloqueia rollout. Histórico Supabase ausente exige plano de adoção de todo o histórico. Nunca copiar hashes/linhas dos harnesses locais para ele. Arquivos já registrados permanecem imutáveis. A avaliação de locks/janela e o rollout em etapas da FK estão no runbook de auditoria; criação concorrente dos novos índices está no runbook de índices. Após qualquer ação autorizada pelo DBA, repetir o inventário, verificar histórico e integridade antes de liberar a aplicação. Nenhum desses passos foi executado no ambiente compartilhado.
