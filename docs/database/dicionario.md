# Dicionário estrutural — T1 (#27)

A fonte verificável de colunas, tipos completos, defaults, nulabilidade, enums,
constraints e ACL/RLS é o arquivo gerado [schema-metadata.json](./schema-metadata.json).
O [schema.sql](./schema.sql) descreve o DDL e o [DER](./der.mmd) mostra chaves,
nullabilidade, unicidade e ações de exclusão. Não infira regra de negócio do nome.

| Tabela | Estrutura comprovada |
| --- | --- |
| usuario | Identidade, email único, hash, perfil obrigatório; ativo admite NULL. |
| motorista | CNH/CPF e usuario_id únicos; conta opcional e FK ON DELETE CASCADE. |
| veiculo | Placa única; tipo/status em enums; vínculo obrigatório com CHECK validado. |
| documento_veiculo | Vencimento date obrigatório; veículo e status_regular opcionais; bytes de arquivo. |
| abastecimento | Veículo, motorista, quilometragem e data obrigatórios; numeric(10,2) em litros/valor. |
| solicitacao_viagem | Código único, saída sem fuso, origem/destino; veículo/motorista com SET NULL. |
| viagem | Solicitação única opcional; km, horários sem fuso e status; FKs NO ACTION. |
| solicitacao_obito | Código único e dados de atendimento; não exportados como fixtures reais. |
| ordem_coleta | Solicitação de óbito única opcional, recursos, km e horários sem fuso. |
| log_atividade | Duas FKs em usuario_id: uma SET NULL e outra NO ACTION, ambas preservadas. |

DEFAULT não implica NOT NULL. BIGINT permanece tipo do banco; esta tarefa não
define serialização HTTP. Colunas de hora são timestamp without time zone, sem
inferência de origem histórica. Campos date permanecem datas civis.

São pendentes, conforme D1–D4 (#23–#26): disponibilidade e alocação compartilhada;
papel do backend e proteção da Data API; revogação; semântica de status_regular;
obrigatoriedade de login de motorista; exclusão e histórico; limites numéricos e
tratamento de NULL/zero; fuso histórico e fronteiras temporais. T1 preserva o
estado auditado e não substitui essas respostas humanas.
