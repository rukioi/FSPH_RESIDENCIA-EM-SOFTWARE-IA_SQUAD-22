# Encerramento do backend — Sprint 7 / Épico 03

## Escopo e fonte de decisão

Esta revisão encerra o código implementável conforme as descrições das dez SCRUMs fornecidas e as decisões expressas do responsável. Não equivale ao aceite da equipe no Jira nem à implantação no Supabase. O inventário de rotas está em docs/api/inventory.md; contratos detalhados em docs/api/solicitacoes*.md e dashboard.md. SQL, metadados e DER refletem PostgreSQL isolado, sem leitura do banco compartilhado.

Cancelamento foi explicitamente retirado desta implementação pelo responsável ao autorizar a SCRUM-155: **“Não implementar cancelamento nesta etapa; documentar a divergência entre a tarefa e o protótipo.”** Essa exclusão foi reiterada ao solicitar o fechamento das quatro SCRUMs restantes. Trata-se de evidência da decisão de escopo nesta entrega; sua atualização formal no Jira depende da equipe. Não existe CANCELADA ou endpoint de cancelamento inventado. Execução de viagens pertence ao Épico 04.

A autorização posterior da SCRUM-164 determina disponibilidade indeterminada de motoristas quando faltarem dados confiáveis de jornada/escala, CNH e conflitos. Não há tabela de jornada/escala ou matriz aprovada de categoria × veículo nos documentos/modelo disponíveis. Os campos de CNH existentes são preservados; status e ausência de reservas não comprovam disponibilidade completa. Não foi criada gestão de jornada de outro épico, nem alterada a política do SVO por suposição.

## Critérios de aceite por tarefa

| SCRUM | Critérios verificados no backend | Evidência executável / contrato |
| --- | --- | --- |
| 137 | POST exclusivo de solicitante interno; identidade da sessão, origem/destino/finalidade/saída/passageiros estritos; PENDENTE; código único TRP-id; GET paginado por status e isolamento. Sem retorno obrigatório na criação. Legado com finalidade null preservado. | solicitacoes-http, solicitacoes-aceite, solicitacoes-temporal; schemas/service/repository; contratos de criação e consulta. |
| 138 | ADM/gestor decidem somente PENDENTE; APROVADA distinta de AGENDADA; REPROVADA exige motivo; ator da sessão; operação/log atômicos; decisão duplicada/concurrente bloqueada. 400/403/404/409 documentados. | solicitacoes-http, solicitacoes-aceite; contrato de decisões e enum real. |
| 139 | Agendamento APROVADA → AGENDADA com motorista, veículo e retorno posterior; intervalo [saída,retorno); recursos existentes/disponíveis por status e reservas; bloqueio conservador SVO ativo. Locks compartilhados e auditoria atômica. | HTTP institucional e despacho SVO concorrentes em solicitacoes-aceite; falha/rollback em solicitacoes-http; contrato de agendamento. |
| 140 | Serviço de auditoria reutilizado; seis ações com ator e FK; instante após locks; falha de log reverte as seis ações; acesso e cronologia protegidos; sem logs fabricados ou associação por descrição. Repetição incompatível não cria novo log. | solicitacoes-http, solicitacoes-aceite; serviço de auditoria existente e histórico somente leitura. ACL remota é condição de implantação, não certificada pela API. |
| 154 | Inventário de campos/enum; matriz explícita de transições; finalidade, decisão distinta de agendamento, recusa, autoria e instante pelos logs; reserva temporal e fuso; separação institucional/SVO/execução. SQL atribuído à 163 conforme atualização de responsabilidade. | sprint7-modelo-e-aceite.md, matriz abaixo, schemas reais e contratos. Decisões sobre CNH/jornada não existentes não são substituídas por inferência. |
| 155 | PATCH exclusivo ADM/gestor; cinco campos, corpo não vazio e estrito; PENDENTE permanece, APROVADA volta a PENDENTE; outros estados 409. Sem trocar reserva/recursos pelo PATCH; log e edição atômicos com lock. Cancelamento excluído por decisão registrada acima. | solicitacoes-http, solicitacoes-aceite, solicitacoes-temporal; contrato de edição. |
| 156 | Agenda AGENDADA com interseção de período, paginação/limite; disponibilidade informativa por intervalo, status e reservas; reagendamento AGENDADA futuro, troca de recursos em ordem determinística, própria reserva excluída, revalidação transacional e rollback integral. Sem horário fictício de liberação SVO. | solicitacoes-http, solicitacoes-temporal e solicitacoes-aceite; contrato de agenda/disponibilidade/reagendamento. |
| 157 | Detalhes e histórico paginado: gestão lê todos, solicitante só próprios; inacessível/inexistente 404; dados mínimos e finalidade null legada; FK exclusiva do histórico; cronologia data_hora/id; sem reconstruir logs antigos. | solicitacoes-http e solicitacoes-aceite; contrato de detalhes/histórico; migration histórica de FK/índice. |
| 163 | Quatro migrations históricas e hashes intactos; finalidade, APROVADA, retorno/CHECK, FK/índice de auditoria; cinco índices adicionais medidos; snapshot/metadados/DER reais; integridade, legado, concorrência e rollback transacional testáveis. Reversão de aplicação preserva dados/enum aditivos; não promete down destrutivo. | testes database de schema, migrations, compatibilidade, índices e preflight; sprint7-indices.md; runbooks de reconciliação e rollout de auditoria. |
| 164 | Endpoints existentes evoluídos; períodos Hoje/7d/30d/personalizado, precisão PostgreSQL, coorte por saída, fila atual separada, status e decisões/atividade reais limitadas; veículos livres conforme status/intervalo/SVO. Motoristas null + motivo quando faltam dados, 0 apenas se nenhum motorista existe. IND-02/08/09 explicitamente indisponíveis; RBAC e DTOs gerados. | dashboard-indicadores HTTP/SQL e unitários; testes de precisão; docs/api/dashboard.md e schemas OpenAPI. Contagens APROVADA/REPROVADA por estado atual são proposta de contrato, ainda sem aceite da equipe. |

## Matriz de estados e rastreabilidade BL08–BL14

| Ação | Entrada | Saída | Responsável | Reserva |
| --- | --- | --- | --- | --- |
| Criar | Ausente | PENDENTE | SOLICITANTE_INTERNO | Nenhuma |
| Aprovar | PENDENTE | APROVADA | ADM/GESTOR_FROTA | Nenhuma |
| Reprovar com motivo | PENDENTE | REPROVADA | ADM/GESTOR_FROTA | Nenhuma |
| Editar os cinco campos | PENDENTE / APROVADA | PENDENTE | ADM/GESTOR_FROTA | Nenhuma |
| Agendar | APROVADA | AGENDADA | ADM/GESTOR_FROTA | Motorista/veículo e [saída,retorno) |
| Reagendar | AGENDADA | AGENDADA | ADM/GESTOR_FROTA | Substituição atômica da reserva |
| Demais combinações de mutação | Estado incompatível | Sem alteração, 409 | Conforme RBAC | Preservada |

PRONTA_PARA_INICIAR, EM_ANDAMENTO e CONCLUIDA são preservados para compatibilidade; nenhuma transição de execução foi incluída. Reservas nesses estados continuam bloqueando recursos conforme o protocolo existente, inclusive legado sem retorno confiável. Solicitante nunca altera/aprova/aloca. Consultas próprias e gestão não mudam estado.

As descrições das tarefas relacionam transversalmente BL08–BL14 ao fluxo. A rastreabilidade verificável é: cadastro/consulta → 137; análise/decisão → 138; reserva → 139/156; autoria/auditoria → 140/157; modelo → 154; edição → 155; integridade/persistência → 163; indicadores → 164. Os textos individuais das sete BLs e fórmulas completas dos INDs não estão versionados no material disponível. Não atribuir títulos ou regras particulares a cada BL por suposição; sua homologação individual depende do responsável pelos requisitos. Todos os campos e transições explicitamente definidos foram mapeados acima.

## Segurança temporal e entradas PostgreSQL

Saída/retorno são timestamp without time zone: parâmetros de horários civis são vinculados como texto antes do cast para impedir conversão do serializador. ISO com offset é normalizado por America/Maceio; leitura preserva horário civil e apresenta -03:00. Não há deslocamento fixo aplicado aos registros. Auditoria histórica é timestamp civil sem offset, não uma afirmação de UTC.

Intervalos comparam microssegundos com o arredondamento PostgreSQL, incluindo empates/carry; as consultas preparadas são repetidas nos testes reais. Ano zero, valores fora do calendário institucional, intervalos inválidos, texto NUL e erros de representação temporal do PostgreSQL retornam 400. Falhas técnicas/obrigatórias de auditoria continuam falhas, sem sucesso fictício ou escrita parcial.

## Rollout, reversão e pendências externas

Não há ação remota automática. Primeiro, executar o preflight de catálogo somente leitura do runbook de reconciliação, comparar efeitos/histórico e hashes da revisão; qualquer divergência bloqueia rollout. Constraint existente equivalente não deve ser reaplicada nem silenciosamente ignorada. Reconciliação de histórico exige autorização própria do responsável pelo banco. FK/índice em banco populado têm procedimento em etapas e avaliação de locks; índices novos têm procedimento concorrente descrito separadamente. Não executar os harnesses locais contra Supabase.

| Classificação | Requisito/ação específica | Responsável e evidência necessária |
| --- | --- | --- |
| DECISÃO EXTERNA | Aceitar ou revisar a proposta de contagem de aprovação/recusa por estado atual da coorte de saída; não são decisões realizadas no período. | Equipe de produto/backend/frontend: aceite do contrato dashboard.md. |
| DECISÃO EXTERNA | Homologar rastreabilidade individual BL08–BL14 e fórmulas/títulos IND completos; formalizar exclusão do cancelamento na tarefa. | Responsável pelos requisitos/Jira, com documentos individuais e aceite; a decisão de escopo já está registrada nesta entrega. |
| DECISÃO EXTERNA | Disponibilidade completa de motoristas e integração visual FE-S7-03. | Equipe responsável por dados/regras de jornada, escala e elegibilidade; frontend deve consumir null + motivo. Backend já fornece o estado indeterminado autorizado. |
| IMPLANTAÇÃO | Conferir efeitos manuais, histórico, hashes, FK/CHECK/índices/ACL e janela/locks no Supabase; executar reconciliação/rollout autorizado. | Responsável pelo banco, com relatório do preflight e autorização própria. Nenhuma comprovação remota é alegada. |

Não há implementação de gestão de jornada ou cancelamento escondida nessa lista. Não declarar disponibilidade completa, aceite da equipe, implantação ou proteção SQL remota apenas porque os testes locais passaram. O resultado atualizado dos comandos fica no registro de validação desta revisão.
