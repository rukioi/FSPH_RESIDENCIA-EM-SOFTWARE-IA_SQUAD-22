# Sprint 10 — Migration e segurança de manutenção (SCRUM-231)

DB-S10-02-B implementa a estrutura aditiva descrita na [SCRUM-230](./sprint10-manutencao-veiculo.md). As cinco definições técnicas abaixo foram confirmadas para esta etapa. A homologação institucional formal e a aplicação compartilhada seguem em fluxo próprio.

- **Custo** usa `NUMERIC` sem precisão ou escala fixa. A coluna aceita `NULL` para desconhecido e zero para valor conhecido. Negativos, infinitos e NaN são rejeitados.
- **Dias completos** usam `America/Maceio`. Entrada e previsão são datas civis inclusivas representadas por `TIMESTAMPTZ` de meia-noite local. A janela planejada corresponde a `[meia-noite da entrada, meia-noite do dia posterior à previsão)`, calculada por calendário civil. Entrada e previsão no mesmo dia são válidas. Início, conclusão e cancelamento efetivos registram instantes. A consulta de disponibilidade deverá manter o bloqueio vigente para manutenções agendadas vencidas e em andamento.
- **Reabertura** de concluída admite `AGENDADA` ou `EM_ANDAMENTO`. A linha corrente limpa a conclusão e usa início ausente ou preenchido conforme o destino. A tabela própria de histórico guarda registros de conclusão e as datas anteriores às correções e reaberturas. A edição após conclusão mantém o histórico consultável.
- **Correções** de datas operacionais após conclusão devem validar ordem, data civil e estado. A aplicação grava os estados e as datas anteriores e posteriores com `CORRECAO_DATAS` e o ator da sessão na mesma transação da atualização da linha corrente. Para reabertura, revalida disponibilidade, preserva reservas e ordens SVO e grava `REABERTURA` e a nova situação na mesma transação. Ao concluir, grava `CONCLUSAO` com os instantes efetivos. A migration valida o estado da linha e do snapshot. A garantia de que cada operação emita o evento pertence à implementação transacional do backend.
- **Autoria e integridade** usam FKs sem cascata e PKs BIGINT com sequência, padrão suportado pelo gerador. As tabelas têm RLS ativa. A ACL concede ao papel local `postgres` leitura, inserção e atualização da ocorrência e somente leitura e inserção do histórico. O papel efetivo e a exposição da Data API precisam de confirmação antes de rollout. Nenhuma alteração em veículos existentes ou preenchimento retroativo por `EM_MANUTENCAO`.

## Arquivos e validação local

- Migration e rollback `20261123000000_db_s10_02_manutencao_veiculo.sql` sob `backend/src/database/supabase/migrations/` e `rollbacks/`.
- Provas candidatas em `backend/tests/database/manutencao-veiculo-s10.test.ts`. Rodar depois de aprovação, com identidade comprovada pelo harness e somente fixtures sintéticas. Usar `s10-clean` para instalação completa, `s10-upgrade` para comparação com a última versão anterior e `s10-rollback` para recusa com dados e reversão vazia. Registrar integridade, ACL e logs da reversão. Preservar o histórico do runner ao montar ensaios de reaplicação.
- A aplicação, as provas de banco e a geração oficial foram executadas exclusivamente nos perfis locais verificados. A evidência local não confirma privilégios remotos.

O rollback declara transação explícita, roda manualmente como script autônomo, bloqueia as duas tabelas e recusa reversão quando houver registros. Em cenário vazio, remove apenas os objetos da entrega. Alterações no Supabase compartilhado cabem exclusivamente ao responsável, manualmente pelo SQL Editor, após revisão e autorização.

## Revisão de integridade, índices e acesso

O histórico armazena o evento, estados anterior e posterior e dois snapshots tipados das datas afetadas. Cada registro inclui ator e o instante padrão de inserção por relógio do servidor. A duplicação se limita aos dados necessários para reconstruir cada operação sem depender de mutações posteriores ou da presença de eventos intermediários. A tabela corrente concentra os demais atributos. O gerador oficial suporta colunas tipadas, enums, BIGSERIAL, CHECKs, índices e ACL usados aqui. A geração e a conferência oficiais passaram no catálogo local.

O índice por veículo atende o histórico da frota e o parcial apoia disponibilidade por veículo. Consultas gerais das SCRUM-232 e SCRUM-234 têm candidatos sem prefixo de veículo: entrada e ID para período e ordem estável, e status, previsão e ID para filtragem geral e de atrasos. Os planos reais devem orientar ajustes posteriores. Indicadores agregados sem filtro podem preferir varredura, portanto não há índice dedicado a eles.

Os grants explícitos a postgres reproduzem o papel de teste local. No harness o papel tem BYPASSRLS. Ownership e superusuário também podem contornar RLS, enquanto herança pode ampliar ACL. Não há garantia de imutabilidade frente a papéis administrativos. Um runtime sem BYPASSRLS e sem ownership precisa de policies além dos grants. Os testes preparam um papel sintético sem esses privilégios e policies limitadas à sua própria transação para provar operações permitidas e recusa de mutações do histórico. A migration deixa a RLS sem policies e a confirmação do runtime compartilhado continua condicionando o rollout.

DROP TABLE remove as sequências BIGSERIAL que pertencem às tabelas. O rollback não altera registros do runner, que guarda versão por nome e checksum SHA-256. A reaplicação de prova usa uma transação externa em cópia sintética ou um alvo isolado com histórico compatível. O teste reutiliza o corpo do script sob sua transação para evitar que o COMMIT do rollback confirme as fixtures.

## Evidências da validação local

| Perfil | Prova | Resultado |
| --- | --- | --- |
| s10-clean | Instalação completa e comparação de catálogo | 15 versões com SHA-256 conferidos, duas tabelas com RLS, dois enums, duas sequências, 19 constraints e sete índices incluindo PKs. Zero ocorrências e zero históricos fictícios. |
| s10-upgrade | Corte em 20261114000000 e avanço isolado | Aplicada somente 20261123000000. Veículos, viagens, solicitações e ordens de coleta foram comparados antes e depois. O veículo sintético em EM_MANUTENCAO foi preservado. O catálogo legado ficou idêntico e as tabelas novas, vazias. |
| s10-rollback | Recusa com dados, reversão vazia e reaplicação em transação de teste | Duas provas passaram. A tentativa recusada preservou ocorrência e histórico. A reversão vazia removeu os objetos da entrega e a reaplicação preservou a frota legada. O registro do runner permaneceu íntegro. |

SHA-256 da migration registrada nos três perfis: `f0938b86e1c666da36e5278680c1a0fd7adfc17067e1acf0f344b703640ec12f`.

Os testes específicos no s10-clean tiveram 31 aprovações. As duas provas de rollback foram executadas exclusivamente no s10-rollback. A suíte geral no s10-clean aprovou 169 testes, com as duas provas de rollback selecionadas apenas no perfil dedicado. Os 31 testes unitários dos perfis passaram. A geração e a comparação oficiais passaram, com diferença de catálogo limitada aos objetos novos.

O runner oferece `db:test:prepare -- --through=20261114000000` para o perfil s10-upgrade. Ele valida a versão de corte e recusa voltar a uma versão anterior a registros já aplicados. Nenhum registro foi removido para repetir o upgrade ou o rollback.
