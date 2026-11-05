# Modelo institucional e aceite da Sprint 7

## Decisões implementadas (SCRUM-154)

Solicitação institucional é public.solicitacao_viagem, separada de viagem e
solicitacao_obito/ordem_coleta. Finalidade é obrigatória na API nova e nullable
no banco para preservar o legado. Origem e destino são textos obrigatórios;
quantidade de passageiros é inteiro positivo. Observações adicionais não foram
confirmadas como necessárias: não há coluna ou payload fictício.

Código utiliza a sequência BIGINT existente e unicidade de codigo: TRP-id
armazenado, #TRP-id apresentado. O limite varchar(20) é verificado pela aplicação.
Solicitante e responsáveis são sempre obtidos da sessão, com perfil efetivo.
Autor e instante das decisões ficam nos logs estruturados, não em colunas
inventadas da solicitação. Os logs antigos sem vínculo não são associados por texto.

| Operação | Estado de entrada | Estado de saída | Perfil |
| --- | --- | --- | --- |
| Criar | Ausente | PENDENTE | SOLICITANTE_INTERNO |
| Aprovar | PENDENTE | APROVADA | ADM/GESTOR_FROTA |
| Reprovar com motivo | PENDENTE | REPROVADA | ADM/GESTOR_FROTA |
| Editar cinco campos permitidos | PENDENTE | PENDENTE | ADM/GESTOR_FROTA |
| Editar cinco campos permitidos | APROVADA | PENDENTE | ADM/GESTOR_FROTA |
| Agendar com recursos e retorno | APROVADA | AGENDADA | ADM/GESTOR_FROTA |
| Reagendar com intervalo e recursos | AGENDADA | AGENDADA | ADM/GESTOR_FROTA |

Edição em outros estados e decisões incompatíveis retornam 409. Não há transição
nova para PRONTA_PARA_INICIAR, EM_ANDAMENTO ou CONCLUIDA: execução pertence ao
Épico 04. Cancelamento foi excluído por decisão explícita do responsável.
Não existe estado ANALISADA: a decisão positiva é APROVADA, separada de AGENDADA.

Saída recebe ISO com offset explícito e é normalizada para America/Maceio antes
de persistir timestamp without time zone. Retorno é definido no agendamento.
Reserva usa [saída, retorno), com retorno posterior. Horários históricos são
interpretados como locais apenas para apresentação, sem conversão de registros.
O instante civil do log não possui offset nem é prova de UTC: não anexar Z ou
usar uma conversão de fuso sem conhecer a sessão que o gravou.

Disponibilidade atual verifica status dos recursos, reservas institucionais
ativas e SVO em EM_DESLOCAMENTO/EM_TRANSPORTE. SVO não tem retorno previsto:
seu bloqueio é conservador. Recursos são bloqueados primeiro por motorista e
depois por veículo, em ordem numérica, incluindo antigos/novos no reagendamento.

## Decisões ainda necessárias

O schema tem validade_cnh e categoria_cnh, mas não contém escala/jornada ou
matriz aprovada categoria × veículo. O status DISPONIVEL não comprova esses
critérios. Não adicionar escala fictícia, inferir jornada por ausência de reserva
ou anunciar elegibilidade completa no dashboard. A ampliação de disponibilidade
aguarda decisão funcional e, se necessária, modelagem versionada separada.

Os textos completos de BL08–BL14 e da documentação Dashboard IND-01/03/04/05/06/07
não constam das descrições recebidas: esta tabela comprova as regras explicitamente
autorizadas, não certifica requisitos desconhecidos nem substitui aceite da equipe.

## Auditoria e limites de repetição (SCRUM-140)

Seis eventos institucionais reutilizam auditoria.service/repository: criação,
aprovação, reprovação, edição, agendamento e reagendamento. Cada evento referencia
solicitacao_viagem_id, autor da sessão e instante de inserção após os locks.
Operação e evento compartilham a transação: falha obrigatória não é ignorada.

solicitacoes-http.test.ts injeta uma falha PostgreSQL real no INSERT do log para
atores próprios e verifica rollback das seis operações. O trigger de ensaio é
criado somente após verifiedSql confirmar o banco exclusivo e removido ao final.
O teste também verifica que POST/PATCH/PUT/DELETE do histórico retornam 405 para
todos os perfis. Leitura própria/alheia, cronologia após lock e decisões
concorrentes têm testes HTTP reais no mesmo arquivo.

Decisão repetida e segundo agendamento são conflitos de estado, não novas ações.
Não existe promessa de idempotência de criação: repetir POST após perda de resposta
pode criar outro pedido. PATCH/reagendamento podem ser ações repetidas válidas;
não deduplicar textos de log nem inventar chave de idempotência nesta revisão.
O requisito de não duplicar retries idempotentes não equivale a tornar todos os
POST idempotentes. Mudança desse contrato exige decisão explícita.

Proteção HTTP não comprova ACL remota. A baseline mantém grants amplos e RLS
desativada. A proteção contra acesso SQL direto continua dependente do papel
runtime e da reconciliação de segurança descrita em docs/seguranca.md. Sem acesso
ao ambiente remoto, não declarar imutabilidade do log ou rollout seguro comprovados.

## Banco, compatibilidade e reversão (SCRUM-163)

As quatro migrations institucionais e seus hashes são preservados. Reversão
segura de aplicação mantém as alterações aditivas: remover finalidade, retorno,
vínculo de auditoria ou rótulo APROVADA destruiria dados ou invalidaria registros.
Não existe down automático destrutivo. A aplicação antiga pode escrever seus
campos sem remover os novos; ela precisa conhecer/recusar APROVADA corretamente
antes de assumir o fluxo. O ensaio de compatibilidade verifica dados legados,
campos novos preservados por UPDATE antigo e rollback de escrita com falha.

Reconciliação manual e rollout escalonado de FK/índice estão descritos em
[reconciliação](../database/sprint7-reconciliacao.md) e
[rollout de auditoria](../database/sprint7-auditoria-rollout.md).
Esses procedimentos não foram executados no Supabase compartilhado.

Inventário e medição de índices foram concluídos em PostgreSQL isolado e geraram
o incremento aditivo de 05/11, preservando as migrations históricas. Ver
[análise de desempenho e rollout](../database/sprint7-indices.md). Nenhum índice
redundante de status ou composto de histórico foi adicionado sem benefício observado.

## Decisão confirmada para SCRUM-164

O responsável autorizou indisponibilidade explícita: número de motoristas elegíveis é
null com motivo enquanto faltarem escala/jornada e regras confiáveis de CNH.
Isso resolve a apresentação honesta do dashboard, mas não implementa a elegibilidade
completa. O modelo conceitual não presume que DISPONIVEL ou ausência de reserva
sejam equivalentes a jornada autorizada. Não foi criada escala nem alterado o SVO.

Os endpoints existentes /dashboard/gestor e /dashboard/graficos foram evoluídos,
com impacto de contrato e consumidores documentado em [dashboard](../api/dashboard.md).
A fila atual é separada da distribuição por saída no período, e os dados vêm do
PostgreSQL. Eventos usam exclusivamente a FK estruturada; não há mock operacional.

## Comparação dos critérios completos

| SCRUM | Entregue e verificável | Limites para aceite integral |
| --- | --- | --- |
| 140 | Serviço único, seis eventos, sessão, FK, operação/log atômicos; testes reais de falha dos seis atos, repetição sem novos logs de decisão/agendamento, concorrência, HTTP 401/403/405 e isolamento do histórico | Proteção da API não certifica ACL/imutabilidade remota; retenção vigente preservada; Jira/responses e rollout pelo responsável. Criação não promete idempotência sem chave. |
| 154 | Campos obrigatórios, distinção APROVADA/AGENDADA, matriz de transições, finalidade nullable legada, período [saída,retorno), fuso e vínculo de auditoria documentados | Matriz CNH/categoria/escala e rastreabilidade individual dos textos integrais BL08–BL14 exigem aceite/documentos da equipe. Não abrange execução. SQL é responsabilidade da 163. |
| 163 | Quatro increments imutáveis, novo incremento de índices justificados, catálogo/snapshot/DER reais, CHECK/FK/UNIQUE, teste de legado e rollback transacional, reservas concorrentes pela API | Reversão de aplicação mantém campos/enum/dados; sem down destrutivo. Reconciliar alterações manuais e hashes antes do rollout remoto. Não há constraint de exclusão contra SQL externo ao protocolo de locks. |
| 164 | Períodos validados, fila atual, status da coorte, logs/decisões recentes, veículos livres, motorista indeterminado com motivo, widgets fora do escopo indisponíveis, RBAC e DTOs reais | Elegibilidade completa deliberadamente indisponível; componente FE fora da entrega, compatibilidade externa exige aceitar null. Coorte vazia testada e banco novo sem dados operacionais comprovado pelo runner --no-seed e HTTP real, sem limpeza. Fórmulas/títulos IND completos e evidências Jira exigem validação da equipe. |

Cancelamento continua excluído por decisão expressa. Esta matriz não marca tarefas
como concluídas automaticamente nem trata teste aprovado como aceite funcional.
