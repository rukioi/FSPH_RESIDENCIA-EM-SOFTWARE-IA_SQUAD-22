import { z } from 'zod';
import { dados,id } from '../../shared/contract/schemas.js';
import { dashboardSchemas } from './dashboard.schemas.js';
import { abastecimentosSchemas } from '../abastecimentos/abastecimentos.schemas.js';
import { svoDashboardSchemas } from '../svo/svo.dashboard.schemas.js';
const quantidade=z.number().int().nonnegative();
const indisponivel=z.object({estado:z.literal('INDISPONIVEL'),valor:z.null(),motivo:z.literal('REGRA_RF46_PENDENTE')});
const gestao=z.object({visao:z.literal('GESTAO'),gestao:dashboardSchemas.DashboardGestorIndicadores.shape.data,
  viagens:z.object({criterio:z.literal('dataHoraSaida'),quantidade,porStatus:z.array(z.object({status:z.string().nullable(),total:quantidade})),
    proximas:z.array(z.object({id,solicitacaoId:id,saida:z.string(),status:z.string(),veiculoId:id,motoristaId:id}))}),
  abastecimentos:abastecimentosSchemas.IndicadoresAbastecimentos.shape.data,
  documentos:z.object({criterio:z.literal('ESTADO_ATUAL'),vencidos:quantidade,vencemHoje:quantidade,alertas:indisponivel})});
const svo=z.object({visao:z.literal('SVO'),operacional:svoDashboardSchemas.DashboardOperacionalSvo,
  filas:svoDashboardSchemas.FilasOperacionaisSvo,atividades:svoDashboardSchemas.AtividadesRecentesSvo.shape.data});
export const dashboardConsolidadoSchemas={DashboardConsolidado:dados(z.discriminatedUnion('visao',[gestao,svo]))};
export const notaDashboardConsolidado='SCRUM-195: visão GESTAO para ADM/GESTOR; SVO para ATENDENTE apenas neste caminho. Reutiliza indicadores dos módulos. Gestão: hoje/7d/30d/personalizado, viagens pela saída institucional; combustível por dias civis abrangidos. SVO mantém hoje/7d/30d. Filas/documentos são atuais; RF46 e consumo por distância indisponíveis por regra pendente. Sem fallback zero após erro.';
