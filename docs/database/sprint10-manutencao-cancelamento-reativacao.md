# Sprint 10 — Histórico de cancelamento e reativação (SCRUM-232)

A migration `20261123000100_be_s10_02_a_historico_cancelamento_reativacao.sql` estende a tabela de histórico da SCRUM-231. A ocorrência corrente já admite os dois destinos autorizados ao limpar o cancelamento ativo. O histórico anterior não tinha lugar para registrar esse instante. A evolução mantém a tabela, os registros, o CHECK de dias civis, RLS, ACLs, FKs e índices. As colunas novas ficam nulas nos eventos anteriores. A migration original fica intacta.

| Evento | Transição | Dados preservados |
| --- | --- | --- |
| CANCELAMENTO | AGENDADA → CANCELADA | Datas planejadas antes e depois. Cancelamento posterior obrigatório. Início e conclusão ausentes nos dois snapshots |
| REATIVACAO | CANCELADA → AGENDADA ou EM_ANDAMENTO | Cancelamento anterior obrigatório. Cancelamento e conclusão posteriores ausentes. Início posterior obrigatório apenas em EM_ANDAMENTO |
| Eventos anteriores | CONCLUSAO, CORRECAO_DATAS e REABERTURA | Mesmas transições e restrições da SCRUM-231. Cancelamento ausente em ambos os lados |

Os CHECKs de evento, estado e instantes são substituídos na mesma transação. Os instantes presentes devem ser finitos. A proteção de dias civis em America/Maceio permanece. O banco valida a forma de cada evento. Consistência entre a ocorrência corrente, os snapshots e reservas depende da operação transacional do backend e da SCRUM-233. A [especificação do modelo e contrato](./sprint10-manutencao-veiculo.md#consolidação-do-contrato--scrum-232) registra as matrizes de edição e transição.

## Auditoria de tipo e datas

O serviço existente recebe o ator da sessão e grava tipo de evento, descrição e instante na transação do chamador. Ele é adequado para uma trilha geral legível, sem vínculo estruturado para manutenção ou campos próprios de antes/depois. A adaptação mínima proposta no backend é um evento tipado com ID canônico da manutenção e enum anterior/posterior do tipo, em descrição estável gerada no servidor. Para data de entrada em andamento, usar evento tipado com ID e datas civis anterior/posterior, sem incluir demais campos do formulário. A atualização e a auditoria confirmam juntas. O timestamp do evento geral deve corresponder à mutação após os locks. Correção após conclusão mantém o evento estruturado CORRECAO_DATAS com os dois snapshots.

Se for exigida consulta estrutural por ocorrência ou dos valores de tipo em ciclos passados, a auditoria atual não atende a essa garantia. Propor separadamente um vínculo e valores tipados persistentes, após aprovação de escopo. Nenhum tipo anterior é inferido para eventos existentes.

## Rollback e validação isolada

O rollback bloqueia o histórico em transação, recusa novos eventos, snapshots preenchidos de cancelamento ou início anterior ausente. Quando compatível, remove apenas as duas colunas novas e restaura os três CHECKs e a nulabilidade anterior. Em caso de recusa, manter a versão em funcionamento, preservar e revisar os registros em ambiente autorizado e preparar correção incremental ou estratégia formal de recuperação que retenha os dados. O script não apaga linhas, não usa CASCADE e não altera o registro de versão ou checksum do runner.

Os testes estruturais foram executados nos perfis locais verificados. Os comportamentos de API, autoria real, escrita atômica e guardas de disponibilidade ficam para a implementação funcional. O gerador oficial confirmou o delta de catálogo e produziu schema, DER e metadados.

A homologação institucional formal e a confirmação do runtime compartilhado continuam pendentes. A escrita operacional depende das guardas da SCRUM-233.

## Evidências locais

| Perfil | Resultado |
| --- | --- |
| s10-upgrade / 127.0.0.1:55511 / fsph_s10_upgrade | Avançou de 15 para 16 versões pelo runner. Comparação integral preservou 5 veículos, 4 viagens, 7 solicitações, 5 ordens e uma ocorrência com três eventos sintéticos. Os eventos mantiveram IDs, autores e instantes. As únicas adições às linhas históricas foram os novos campos nulos. |
| s10-rollback / 127.0.0.1:55512 / fsph_s10_rollback | Em transações de teste, aplicou o incremento, reverteu com dados compatíveis, restaurou CHECKs e colunas da SCRUM-231 e reaplicou o incremento. A reversão com eventos novos foi recusada e preservou os dados. O runner manteve 15 versões, sem intervenção no controle. |
| s10-clean / 127.0.0.1:55510 / fsph_s10_clean | Avançou de 15 para 16 versões com checksums conferidos. As tabelas de manutenção ficaram vazias. A comparação de catálogo isolou o delta a duas colunas novas, nulabilidade de anterior_iniciada_em e três CHECKs. Geração e check oficiais concluídos. |

A migration original mantém o SHA-256
`f0938b86e1c666da36e5278680c1a0fd7adfc17067e1acf0f344b703640ec12f`.
O incremento registrado em upgrade e clean tem SHA-256
`002a3f3669feb84447b647df4a0aab4503a74f6a94b54933a06f87442fda7cc8`.

Os casos de nulidade testaram instantes ausentes quando obrigatórios e instantes
preenchidos quando vedados. Os CHECKs comparam expressões booleanas derivadas de
IS NOT NULL contra estados obrigatórios. Assim, nessas combinações a expressão
resulta em falso, em vez de UNKNOWN. A prova cobre cada evento isoladamente.
A ordem entre eventos e a atualização atômica da ocorrência cabem ao backend.

RLS, ownership, ACLs de tabela e sequência, FKs e índices permaneceram
idênticos. As provas reusaram o bloqueio de anon e authenticated e as
verificações de PUBLIC e do papel sintético da SCRUM-231. A auditoria funcional
futura preservará tipo e datas de antes e depois, identificador da manutenção,
autor real da sessão e instante da mutação na mesma transação da operação.

A regressão final aprovou 181 testes em s10-clean. Quatro casos filtrados
nesse perfil passaram em s10-rollback (dois da SCRUM-231 e dois da SCRUM-232).
Os 31 testes unitários dos perfis passaram. Total único: 216 aprovados, zero
reprovados e zero pendentes por filtro. Os 12 casos específicos executados
em s10-upgrade também integram a regressão. Todos os comandos finais
retornaram 0, incluindo verificação pelo harness, prepare, geração, check,
testes, typecheck e git diff --check. Na primeira prova de rollback, a
consulta preparada SELECT * reteve um plano com formato anterior ao DDL.
O teste passou ao projetar uma coluna JSONB estável, sem editar a migration.
