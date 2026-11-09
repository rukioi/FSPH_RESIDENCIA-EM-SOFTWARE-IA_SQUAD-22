# API — Dashboard institucional (SCRUM-164)

## Integração visual do gestor

O painel `/gestor/dashboard` consulta `/gestor` e `/pendencias` pelo cliente
autenticado comum, com validação dos schemas e cancelamento de leituras antigas.
Hoje/7/30 dias e intervalo personalizado usam o filtro do servidor. O cartão de
viagens programadas soma os estados AGENDADA e PRONTA_PARA_INICIAR da distribuição
completa, sem usar o tamanho da lista limitada de próximas viagens e sem afirmar
execução. Gráfico e legenda preservam todos os estados retornados.

Atualização manual e retorno do foco à janela recarregam as consultas. Links de
análise, atividade e viagens abrem o detalhe existente da solicitação; decisões
e edições continuam nesse fluxo autorizado. Motoristas indeterminados exibem o
motivo do servidor. A consulta documental legada usa 30 dias e a tela identifica
essa janela como provisória, sem declará-la regra validada.

O cabeçalho do gestor não exibe mais a contagem fictícia de notificações. Os
testes visuais usam fixtures exclusivamente no Playwright; não há fallback de
dados demonstrativos na página do gestor.

## Acesso e rotas

JWT/sessão atual e perfis ADM ou GESTOR_FROTA em todos os GETs existentes:

- `/api/dashboard`: envelope legado `{data:{}}`, sem indicadores operacionais.
- `/api/dashboard/pendencias`: consulta legada de documentos/CNH, preservada.
- `/api/dashboard/gestor`: resumo institucional, fila e atividades persistidas.
- `/api/dashboard/graficos`: distribuição por status e período.

Não há `/api/dashboard/kpis` nem endpoint novo. Ausência/inatividade da sessão:
401; perfil efetivo não permitido: 403. Outros métodos: 405 e `Allow: GET`.

## Compatibilidade e impacto nos consumidores

Antes da alteração, a busca em páginas, serviços e tipos confirmou que o frontend
versionado não chama `/gestor` ou `/graficos`: DashboardGestor.tsx usa a mensagem
`indicadoresIndisponiveis`, KpiCards recebe props opcionais e os widgets continuam
demonstrativos identificados. DashboardKpis é um modelo visual sem ligação ao DTO.
Ele não foi convertido em cliente nem a página foi implementada nesta entrega.
O fallback visual `?? '—'` já trata null, mas isso não comprova integração.

Preservados os nomes das rotas, envelope `data`, `veiculosPorStatus`,
`solicitacoesPorStatus` e projeção de `proximasViagens`. A mudança deliberada é
`motoristasDisponiveis: number | null`, com `motoristasDisponiveisMotivo: string | null`.
Consumidor externo que espera só número precisa aceitar null e exibir motivo/travessão,
sem coagir null para zero. Tipos/bindings foram gerados oficialmente. Os componentes
antigos do OpenAPI permanecem como referência de compatibilidade; as duas operações
apontam agora a GraficosPeriodo/DashboardGestorIndicadores. O gate permite somente
essa transição aprovada e protege todos os demais campos legados e a autorização.

Sem query, o padrão passa a ser Hoje; anteriormente as contagens eram globais.
Query desconhecida, duplicada ou inválida agora retorna 400 DADOS_INVALIDOS.
Essa mudança de significado também deve ser considerada pelo consumidor externo.
Os detalhes abaixo são o contrato backend; aceite da tarefa irmã FE-S7-03 permanece
separado e não foi declarado concluído.

## Período e significado das métricas

`periodo=hoje|7d|30d|personalizado` (opcional, padrão `hoje`). Hoje, 7d e 30d usam
dias institucionais completos, incluindo hoje, com início à meia-noite e fim na
meia-noite seguinte ao dia atual. Não recebem `inicio`/`fim` adicionais.
Personalizado exige ambos em ISO 8601 com offset explícito, `fim > inicio`, até
31 dias, inclusive na precisão de microssegundos do PostgreSQL. Datas normalizadas
para America/Maceio, sem alterar registros existentes. Intervalos são `[inicio,fim)`.

Exemplo: `/api/dashboard/gestor?periodo=personalizado&inicio=2026-11-05T00:00:00-03:00&fim=2026-11-06T00:00:00-03:00`.
Use URLSearchParams para codificar offsets positivos e evitar interpretar `+` como espaço.

`data.periodo` informa período, início/fim com -03:00, fuso e
`criterio: "dataHoraSaida"`. A coorte é formada por pedidos cuja saída pertence
à janela; não é a quantidade de ações que aconteceram dentro do período.

- `solicitacoesPorStatus`: situação atual dos pedidos dessa coorte; só a tabela
  institucional, nunca solicitação de óbito ou ordem SVO.
- `indicadores.aprovadas` e `reprovadas`: quantidade atualmente APROVADA/REPROVADA
  na coorte. AGENDADA não é recontada como APROVADA; não representam todos os
  eventos de aprovação/reprovação nem taxa histórica de decisão.
- `indicadores.pendentes`: fila atual global de pedidos PENDENTE, independente da
  data de saída. Pedido antigo ainda pendente não desaparece por filtro de período.
- `filaAguardandoAnalise`: os cinco primeiros dessa fila, por criado_em ASC NULLS LAST
  e id ASC; ID, código, apresentação, origem/destino, instante civil e ação ANALISAR.
  A ação sinaliza acesso administrativo; aprovação ainda exige seu endpoint/RBAC.
- `proximasViagens`: até cinco AGENDADA/PRONTA_PARA_INICIAR na coorte, por saída/id.
  Não afirma que viagens foram executadas. Campos legados explicitamente projetados.
- `atividadeRecente`: até dez logs vinculados por solicitacao_viagem_id a pedidos
  da coorte; data_hora DESC NULLS LAST e id DESC. `decisoesRecentes`: até cinco logs
  com os modelos de descrição de aprovação/reprovação realmente emitidos pelo
  serviço existente, também com vínculo estruturado. Não extrai ID da descrição,
  não infere decisão de agendamento e não associa eventos antigos sem FK.
- `veiculosPorStatus`: inventário geral legado, sem filtro temporal, preservado.
  Não confundir esse inventário com recursos administrativamente livres na janela.

`criadoEm`, `criado_em` e `dataHora` da auditoria são timestamps civis sem offset,
não UTC. Não anexar Z, -03:00 ou converter dados históricos por suposição. Ordenação
usa o valor armazenado e id, não comprova cronologia absoluta entre sessões de fusos
diferentes. Atividade é filtrada pelo pedido/saída; não por um fuso presumido do log.
Saída operacional recebe offset -03:00 conforme a convenção institucional existente.

## Disponibilidade sem fabricação de dados

Se houver motoristas cadastrados, `motoristasDisponiveis` é null e o motivo explica
que faltam jornada/escala confiáveis e a regra completa de elegibilidade por CNH.
Nem status DISPONIVEL, CNH válida ou ausência de reserva comprovam elegibilidade.
Se não houver nenhum motorista cadastrado, zero é uma contagem verdadeira do
conjunto vazio e o motivo é null. Não se retorna zero em falha de consulta.

`indicadores.veiculosDisponiveis` conta veículos `is_svo=false` com status DISPONIVEL
e livres para toda a janela, usando a consulta compartilhada de reservas. Veículos
marcados SVO ou com marcação indeterminada não são incorporados ao recorte
administrativo sem decisão. Verifica reservas institucionais ativas e bloqueio
conservador de SVO EM_DESLOCAMENTO/EM_TRANSPORTE, sem inventar liberação futura.
Não atribui motorista, garante reserva ou certifica capacidade/documentação sem
as regras correspondentes aprovadas. O agendamento revalida dentro da transação.

`indicadores.indicadoresIndisponiveis` informa IND-02 e IND-08 (execução de viagens)
e IND-09 (documentos) como `estado: "indisponivel"`, com motivo. Não há zero fictício.
Não foram inventadas fórmulas adicionais para títulos IND não fornecidos.

## Consistência, privacidade e falhas

Resumo/gráficos usam transação REPEATABLE READ READ ONLY, com um snapshot para
contagens, lista e recursos. Solicitante, motorista e atendente SVO não acessam
nenhuma dessas consultas. Logs de atividade retornam ID do autor, sem email, CPF,
telefone, nome ou payload administrativo. As respostas não expõem SQL/stack.

Falha de query ou DTO inválido retorna 500, nunca um painel com zeros. Preservados
`FALHA_INTERNA` em /graficos e `ERRO_INTERNO` em /gestor. O GET não grava auditoria.

Os limites timestamp são parâmetros textuais convertidos no servidor PostgreSQL.
Isso impede que o serializer de consultas preparadas converta horário civil pelo
fuso do processo Node/Windows. Consultas repetidas e limites adjacentes são cobertos
por teste real com TZ=America/Fortaleza, sem alterar configuração global.

## Evidências e limites de aceite

`dashboard-indicadores.test.ts` de integração confronta HTTP com PostgreSQL real:
coorte vazia, dois pendentes, aprovação/reprovação via API, atividades ordenadas,
limite inicial/final, 401/403/400, períodos Hoje/7d/30d, veículo reservado e SVO ativo.
Mesmo com motorista disponível e CNH válida, a resposta permanece indeterminada.
A suíte unitária prova 500 sem zero falso ou exposição de sentinela privada.
Além da coorte vazia automatizada, foi criada uma base nova exclusiva no container
verificado, com marcador próprio. O runner --no-seed aplicou todas as migrations
sem fixtures; SELECTs comprovaram zero usuários/pedidos/motoristas/veículos/logs.
Depois foi inserido somente um ADM fictício para autenticar os dois GETs reais:
ambos retornaram 200, arrays vazios, motoristasDisponiveis=0 com motivo null e
zero pendentes/veículos. A guarda foi restaurada e a base exclusiva preservada.
A prova local está em .test-db/s7-indicadores/empty-result.json. Não houve DELETE,
TRUNCATE, adoção de URL arbitrária ou acesso ao Supabase compartilhado nesse ensaio.

Escala/jornada real, matriz CNH × veículo, validação visual da tarefa FE e alinhamento
dos títulos integrais IND/BL ainda dependem da equipe. Esta entrega segue a decisão
explícita de indisponibilidade e não declara elegibilidade completa implementada.

## Complemento — precisão temporal e aceite dos indicadores

Os períodos personalizados agora são comparados em microssegundos inteiros,
na precisão efetivamente persistida pelo PostgreSQL. Um intervalo positivo de
um microssegundo é aceito; igualdade/inversão após arredondamento e duração maior
que 31 dias são recusadas com 400. Offsets explícitos são preservados na interpretação
do instante e normalizados apenas pelo PostgreSQL para America/Maceio. Frações
com mais de seis dígitos continuam aceitas e seguem o arredondamento do banco,
inclusive empates para par e virada de segundo, sem truncamento pelo Date do driver.

Mantida provisoriamente a contagem por estado: aprovadas/reprovadas representam
os estados atuais APROVADA/REPROVADA dos pedidos com saída no período. Não são
contagens de decisões realizadas nesse período. A fila pendente continua atual/global.
Essa semântica depende de aceite da equipe; a correção temporal não a transforma
em outra métrica. Detalhes e evidências em
[correção temporal](../solicitacoes/sprint7-correcao-temporal.md).
