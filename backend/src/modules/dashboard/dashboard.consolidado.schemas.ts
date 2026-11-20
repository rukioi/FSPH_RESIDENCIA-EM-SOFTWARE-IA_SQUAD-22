import { indicadoresAbastecimentos, indicadoresAbastecimentosAntesDeConsumo } from '../abastecimentos/abastecimentos.schemas.js';
import { z } from 'zod';
import { dados,id } from '../../shared/contract/schemas.js';
import { dashboardSchemas } from './dashboard.schemas.js';
import { svoDashboardSchemas } from '../svo/svo.dashboard.schemas.js';
import { periodoDashboardSchema } from './dashboard.indicadores.schemas.js';
const quantidade=z.number().int().nonnegative();
const alertaAnterior=z.object({estado:z.literal('INDISPONIVEL'),valor:z.null(),motivo:z.literal('REGRA_RF46_PENDENTE')});
const gestao=z.object({visao:z.literal('GESTAO'),gestao:dashboardSchemas.DashboardGestorIndicadores.shape.data,
  viagens:z.object({criterio:z.literal('dataInicio'),quantidade,porStatus:z.array(z.object({status:z.string().nullable(),total:quantidade})),
    proximas:z.array(z.object({id,solicitacaoId:id,saida:z.string(),status:z.string(),veiculoId:id.nullable(),motoristaId:id.nullable()}))}),
  abastecimentos:indicadoresAbastecimentos.shape.data,
  documentos:z.object({criterio:z.literal('ESTADO_ATUAL'),vencidos:quantidade,vencemHoje:quantidade,alertas:z.object({estado:z.literal('DISPONIVEL'),valor:quantidade})})});
const svo=z.object({visao:z.literal('SVO'),operacional:svoDashboardSchemas.DashboardOperacionalSvo,
  filas:svoDashboardSchemas.FilasOperacionaisSvo,atividades:svoDashboardSchemas.AtividadesRecentesSvo.shape.data});
export const dashboardConsolidadoAntesPeriodoSvo = dados(z.discriminatedUnion('visao', [gestao, svo]));
const svoComPeriodoPersonalizado = svo.extend({
  operacional: svoDashboardSchemas.DashboardOperacionalSvo.extend({ periodo: periodoDashboardSchema }),
});
export const dashboardConsolidadoAntesDeCandidatos = dados(z.discriminatedUnion('visao', [gestao, svoComPeriodoPersonalizado]));
const gestaoComCandidatos = gestao.extend({
  disponibilidadeMotoristas: z.object({
    estado: z.literal('PROVISORIA'),
    candidatos: quantidade.describe('Motoristas com cadastro disponível, conta ativa e CNH vigente, sem bloqueio registrado na janela.'),
    motivo: z.literal('SEM_ESCALA_E_MATRIZ_CNH'),
  }).describe('Contagem indicativa de candidatos para consulta da gestão, sem confirmação de escala ou aptidão por veículo.'),
});
export const dashboardConsolidadoSchemas = {
  DashboardConsolidado: dados(z.discriminatedUnion('visao', [gestaoComCandidatos, svoComPeriodoPersonalizado])),
};
// Forma anterior, usada apenas pelo gate para reconhecer a troca exata da fonte de abastecimentos.
const gestaoAntesDeConsumo = gestao.extend({ abastecimentos: indicadoresAbastecimentosAntesDeConsumo.shape.data });
export const dashboardConsolidadoAntesDeConsumo = dados(z.discriminatedUnion('visao', [gestaoAntesDeConsumo, svo]));
const gestaoAntesRf46 = gestaoAntesDeConsumo.extend({
  documentos: gestao.shape.documentos.extend({ alertas: alertaAnterior }),
});
export const dashboardConsolidadoAntesRf46 = dados(z.discriminatedUnion('visao', [gestaoAntesRf46, svo]));
export const dashboardConsolidadoAntesDeAbastecimentos = dados(z.discriminatedUnion('visao', [
  gestaoAntesRf46.extend({ abastecimentos: alertaAnterior.extend({ motivo: z.literal('FONTE_SCRUM_188_PENDENTE') }) }),
  svo,
]));
export const notaDashboardAntesDeAbastecimentos='SCRUM-195: GESTAO para ADM/GESTOR e SVO para ATENDENTE. Gestão: hoje/7d/30d/personalizado, execução por início real e próximas por saída prevista. SVO: hoje/7d/30d. Filas e documentos são estado atual. RF46 e fonte SCRUM-188 pendentes.';
export const notaDashboardAntesRf46 = notaDashboardAntesDeAbastecimentos.replace('RF46 e fonte SCRUM-188 pendentes.', 'Abastecimentos por dias civis abrangidos. RF46 e consumo por distância pendentes.');
export const notaDashboardAntesDeConsumo = notaDashboardAntesRf46.replace(
  'RF46 e consumo por distância pendentes.', 'Documentos a vencer pela janela RF46. Consumo por distância pendente.',
);
export const notaDashboardAntesPeriodoSvo = notaDashboardAntesDeConsumo.replace('Consumo por distância pendente.', 'Consumo cheio a cheio em km/L.');
export const notaDashboardAntesDeCandidatos = notaDashboardAntesPeriodoSvo.replace(
  'SVO: hoje/7d/30d.', 'SVO: hoje/7d/30d/personalizado; inicio/fim ISO com offset e até 31 dias no personalizado.',
);
export const notaDashboardConsolidado = notaDashboardAntesDeCandidatos + ' Gestão inclui a contagem provisória de motoristas candidatos.';
