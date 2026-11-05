# SCRUM-163 — consultas e índices institucionais

## Evidência real e limites

Medição em 05/11/2026, exclusivamente pelo harness do PostgreSQL Docker da árvore
de entrega. Versão: PostgreSQL 17.11 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit. Foram gerados 50.000 pedidos e 150.000 logs
sintéticos em tabelas temporárias. Nenhum pedido ou log operacional foi alterado.

Comando reproduzível, após verificar identidade com db:test:start:

~~~sh
npx tsx backend/src/database/scripts/measure-solicitacoes-indexes.ts
~~~

O programa lê o SQL exato do novo incremento e usa apenas tabelas temporárias.
A baseline de índices é reconstruída explicitamente (PK/UNIQUE da solicitação,
PK e índice do vínculo do log), mesmo se o novo incremento já estiver aplicado.
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) executa cada consulta três vezes e registra
a mediana. Os planos completos ficam em .test-db/s7-indicadores/index-performance.json,
evidência local ignorada pelo Git. Não houve desativação de seqscan ou alteração
de configuração do PostgreSQL. Buffers locais podem exceder local_buffers:
esses tempos não são SLA, previsão de produção ou prova de cache totalmente quente.

| Consulta | Antes ms | Depois ms | Blocos locais antes | Blocos locais depois | Índices escolhidos depois |
| --- | ---: | ---: | ---: | ---: | --- |
| fila | 12.258 | 0.029 | 1112 | 3 | solicitacao_viagem_fila_pendente_idx |
| historico | 0.046 | 0.026 | 3 | 3 | s7_perf_logs_solicitacao_viagem_id_idx |
| autor | 0.522 | 0.045 | 103 | 22 | solicitacao_viagem_autor_id_idx |
| status | 0.047 | 0.027 | 5 | 5 | s7_perf_solicitacoes_pkey |
| periodo | 6.725 | 0.391 | 1112 | 160 | solicitacao_viagem_saida_status_idx |
| agenda | 17.943 | 1.959 | 1112 | 4256 | solicitacao_viagem_saida_status_idx |
| motorista | 12.054 | 0.077 | 1112 | 34 | solicitacao_viagem_motorista_reserva_idx |
| veiculo | 9.958 | 0.066 | 1112 | 27 | solicitacao_viagem_veiculo_reserva_idx |
| conflito | 10.004 | 0.094 | 1112 | 61 | solicitacao_viagem_motorista_reserva_idx, solicitacao_viagem_veiculo_reserva_idx |

O índice temporal reduziu o tempo medido da agenda, mas aumentou as visitas a
blocos nesse cenário: não é garantia de melhoria para toda janela/seletividade.
O benefício principal comprovado desse índice é o agrupamento por período.
Os índices de motorista/veículo permitem BitmapOr no conflito dos dois recursos.
As desigualdades e as reservas sem fim continuam sendo verificadas; índice não
substitui transação, locks ou validação.

## Decisões de modelagem

- PK(id): busca/lock por solicitação, sem novo índice redundante.
- UNIQUE(codigo): unicidade existente, sem novo índice.
- idx_log_atividade_solicitacao_viagem_id: vínculo do histórico e JOIN de atividade.
  O candidato composto por vínculo/data/id não foi escolhido com três eventos por
  pedido; não foi entregue. Reavaliar se o volume de eventos por pedido aumentar.
- solicitacao_viagem_autor_id_idx(solicitante_id,id DESC): escopo do solicitante
  com paginação e contagem por autor.
- solicitacao_viagem_saida_status_idx(data_hora_saida,status,id): coorte do dashboard
  e consulta por data da agenda. Não limita nem altera o intervalo de reserva.
- solicitacao_viagem_motorista_reserva_idx e solicitacao_viagem_veiculo_reserva_idx:
  índices parciais dos estados ativos, com retorno incluído; ambos são necessários
  porque a consulta de conflito usa motorista OU veículo.
- solicitacao_viagem_fila_pendente_idx(criado_em,id) WHERE status='PENDENTE': fila
  cronológica curta. O índice simples (status,id DESC) não foi escolhido no ensaio
  de listagem de pendentes, então não foi entregue.

As consultas sintéticas reproduzem os predicados/ordenações de interesse com
constantes e uma distribuição explícita: 45% PENDENTE, 5% APROVADA, 20% AGENDADA,
5% REPROVADA e 25% CONCLUIDA. Elas não certificam planos genéricos de prepared
statements, dados reais, toda combinação opcional de filtros ou custo de escrita.
Os índices adicionam armazenamento e manutenção a INSERT/UPDATE: antes do rollout,
comparar pg_stat_user_indexes, pg_relation_size, seletividade e carga do ambiente
alvo. Não foi criada regra de disponibilidade, estado ou coluna adicional.

## Incremento e reversão

20261105000000_add_solicitacoes_query_indexes.sql adiciona somente os cinco índices
justificados. As quatro migrations de 04/11 são imutáveis e têm testes de hash.
O runner continua verificando todo o histórico antes de executar incrementos e
cada migration confirma em sua própria transação. O incremento não usa IF NOT EXISTS:
objeto de mesmo nome deve ser conferido, nunca aceito silenciosamente.

No isolado/banco novo, a migration transacional tem lock_timeout de 5s e
statement_timeout de 60s. Timeout provoca rollback de todos os índices do incremento;
o runner não deve registrar o hash de uma aplicação incompleta. Não aumentar esses
limites automaticamente para forçar uma base populada a aceitar o DDL.

A reversão de aplicação mantém os índices: não afetam compatibilidade dos dados.
O teste solicitacoes-indices.test.ts aplica o SQL exato em tabela temporária com
registro legado, verifica preservação da linha e rollback dos objetos. Não há down
que remova dados, enum ou constraints. Eventual remoção de índice exige análise
separada, autorização do responsável e comprovação de que não atende outra carga.

## Rollout em base populada — operacional, não executado

Não executar este incremento automaticamente no Supabase compartilhado. Primeiro
reconciliar as quatro alterações manuais anteriores e confirmar o histórico, hashes,
papel proprietário, tamanho da tabela, transações longas e janela de manutenção.

O responsável pode escolher uma janela em que o CREATE INDEX transacional caiba
nos limites documentados. Para operação sem bloqueio prolongado de escrita, preparar
os mesmos cinco índices com CREATE INDEX CONCURRENTLY, cada comando fora de BEGIN,
em procedimento explicitamente autorizado. O runner atual não executa CONCURRENTLY
porque envolve cada migration em transação; não introduzir COMMIT interno nem editar
migrations históricas para contornar isso.

Após criação concorrente, o responsável deve comparar cada definição abaixo com o
incremento, incluindo colunas, ordem DESC, INCLUDE e predicados; conferir indisvalid,
indisready e unicidade. Índice ausente, inválido ou divergente impede reconciliar o
histórico. Falha de CONCURRENTLY pode deixar índice inválido: não reaplicar usando
IF NOT EXISTS e não removê-lo automaticamente. Investigar e autorizar a correção.
Somente após equivalência integral, reconciliar a versão/hash pelo mecanismo real de
migrations do ambiente e com autorização específica. Nenhum histórico foi reparado
por esta entrega e não existe instrução de gravar diretamente tabelas de controle.

Consulta de inspeção somente leitura para o responsável:

~~~sql
SELECT c.relname AS indice, i.indisvalid, i.indisready, i.indisunique,
       pg_get_indexdef(i.indexrelid) AS definicao,
       pg_get_expr(i.indpred, i.indrelid) AS predicado
FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
WHERE i.indrelid='public.solicitacao_viagem'::regclass
ORDER BY c.relname;
~~~
