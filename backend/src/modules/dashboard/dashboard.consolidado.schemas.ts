import { indicadoresAbastecimentos } from '../abastecimentos/abastecimentos.schemas.js';
import { z } from 'zod';
import { dados,id } from '../../shared/contract/schemas.js';
import { dashboardSchemas } from './dashboard.schemas.js';
import { svoDashboardSchemas } from '../svo/svo.dashboard.schemas.js';
const quantidade=z.number().int().nonnegative();
const alertaAnterior=z.object({estado:z.literal('INDISPONIVEL'),valor:z.null(),motivo:z.literal('REGRA_RF46_PENDENTE')});
const gestao=z.object({visao:z.literal('GESTAO'),gestao:dashboardSchemas.DashboardGestorIndicadores.shape.data,
  viagens:z.object({criterio:z.literal('dataInicio'),quantidade,porStatus:z.array(z.object({status:z.string().nullable(),total:quantidade})),
    proximas:z.array(z.object({id,solicitacaoId:id,saida:z.string(),status:z.string(),veiculoId:id.nullable(),motoristaId:id.nullable()}))}),
  abastecimentos:indicadoresAbastecimentos.shape.data,
  documentos:z.object({criterio:z.literal('ESTADO_ATUAL'),vencidos:quantidade,vencemHoje:quantidade,alertas:z.object({estado:z.literal('DISPONIVEL'),valor:quantidade})})});
const svo=z.object({visao:z.literal('SVO'),operacional:svoDashboardSchemas.DashboardOperacionalSvo,
  filas:svoDashboardSchemas.FilasOperacionaisSvo,atividades:svoDashboardSchemas.AtividadesRecentesSvo.shape.data});
export const dashboardConsolidadoSchemas={DashboardConsolidado:dados(z.discriminatedUnion('visao',[gestao,svo]))};
// Forma anterior, usada apenas pelo gate para reconhecer a troca exata da fonte de abastecimentos.
const gestaoAntesRf46 = gestao.extend({
  documentos: gestao.shape.documentos.extend({ alertas: alertaAnterior }),
});
export const dashboardConsolidadoAntesRf46 = dados(z.discriminatedUnion('visao', [gestaoAntesRf46, svo]));
export const dashboardConsolidadoAntesDeAbastecimentos = dados(z.discriminatedUnion('visao', [
  gestaoAntesRf46.extend({ abastecimentos: alertaAnterior.extend({ motivo: z.literal('FONTE_SCRUM_188_PENDENTE') }) }),
  svo,
]));
export const notaDashboardAntesDeAbastecimentos='SCRUM-195: GESTAO para ADM/GESTOR e SVO para ATENDENTE. Gestão: hoje/7d/30d/personalizado, execução por início real e próximas por saída prevista. SVO: hoje/7d/30d. Filas e documentos são estado atual. RF46 e fonte SCRUM-188 pendentes.';
export const notaDashboardAntesRf46 = notaDashboardAntesDeAbastecimentos.replace('RF46 e fonte SCRUM-188 pendentes.', 'Abastecimentos por dias civis abrangidos. RF46 e consumo por distância pendentes.');
export const notaDashboardConsolidado = notaDashboardAntesRf46.replace(
  'RF46 e consumo por distância pendentes.', 'Documentos a vencer pela janela RF46. Consumo por distância pendente.',
);
