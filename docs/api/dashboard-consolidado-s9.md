# Dashboard consolidado — SCRUM-195 (parcial)

`GET /api/dashboard` deixa de retornar `{data:{}}` e retorna uma visão tipada:

- ADM/GESTOR_FROTA: `{data:{visao:'GESTAO',gestao,viagens,abastecimentos,documentos}}`.
  `gestao` reutiliza SCRUM-164 (frota, filas, distribuição, atividade mínima).
  `viagens` consulta registros de viagem reais, quantidade/distribuição e até
  dez próximas AGENDADA; não conta pedido sem viagem como execução.
  `abastecimentos` reutiliza os agregados NUMERIC da SCRUM-188, sem fórmula nova.
  `documentos` conta vencidos/hoje no banco e mantém alertas RF46 indisponíveis.
- ATENDENTE_SVO: `{data:{visao:'SVO',operacional,filas,atividades}}`, reutilizando
  os três repositórios da SCRUM-149; não recebe CNH, combustível ou dados da gestão.

Motorista/solicitante: 403. Sem sessão válida: 401. O acesso do SVO foi acrescentado
**somente** ao caminho raiz. `/gestor`, `/graficos` e `/pendencias` continuam
restritos à gestão e com os contratos anteriores. Frontend não foi alterado.

Gestão: `periodo=hoje|7d|30d|personalizado`. Personalizado exige inicio/fim ISO com
offset, intervalo [início,fim) de até 31 dias, conforme SCRUM-164, America/Maceio.
Pedidos/viagens usam a saída institucional; combustível usa os dias civis abrangidos
pela janela (não possui horário do abastecimento). Documentos/filas são estado
atual e não desaparecem em um período histórico vazio. SVO mantém seu contrato
hoje/7d/30d; personalizado retorna 400, sem inventar suporte no módulo.

Cada consulta do módulo mantém seu snapshot; a composição não promete um único
snapshot global entre módulos. Falha de qualquer fonte é 500, nunca zero ou sucesso
vazio. Zero só vem de agregação real sem registros. Nenhuma métrica usa memória
de sessão/React. A reconsulta retorna o estado persistido atualizado.

O total de motoristas disponíveis continua null quando faltam jornada/escala
aprovadas, conforme SCRUM-164. Consumo por distância permanece null/regra pendente.
Alertas RF46: `{estado:'INDISPONIVEL',valor:null,motivo:'REGRA_RF46_PENDENTE'}`;
nenhum contador fictício de documentos vencendo.

**SCRUM-195 não está concluída**: falta a decisão RF46/SCRUM-193 e a regra de
consumo/SCRUM-188 para a parte dependente. Indicadores independentes foram
implementados sem alterar regras de disponibilidade/viagem dos módulos donos.

Provas: `dashboard-consolidado-s9.test.ts` (SQL antes/depois, período vazio,
reconsulta, combustível real, SVO reutilizado e RBAC), contratos e testes do
Dashboard legado. Teste de falha isolada do agregador é unitário com falha injetada;
não é apresentado como prova integrada de banco.
