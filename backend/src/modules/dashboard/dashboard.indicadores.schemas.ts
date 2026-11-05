import {z} from 'zod';
import {id} from '../../shared/contract/schemas.js';
import {dataHoraInstitucionalSchema,intervaloTemporalValido} from '../solicitacoes/solicitacoes.datas.js';

export const periodoDashboardSchema=z.enum(['hoje','7d','30d','personalizado']);
export const consultaDashboardSchema=z.strictObject({
  periodo:periodoDashboardSchema.default('hoje'),
  inicio:dataHoraInstitucionalSchema.optional(),
  fim:dataHoraInstitucionalSchema.optional(),
}).superRefine((value,ctx)=>{
  if(value.periodo==='personalizado'){
    if(!value.inicio||!value.fim||!intervaloTemporalValido(value.inicio,value.fim,31))
      ctx.addIssue({code:'custom',path:['fim'],message:'Informe início e fim válidos, com offset, de até 31 dias.'});
  }else if(value.inicio!==undefined||value.fim!==undefined){
    ctx.addIssue({code:'custom',path:['inicio'],message:'Início e fim são exclusivos do período personalizado.'});
  }
});
export type ConsultaDashboard=z.infer<typeof consultaDashboardSchema>;
export const parametrosPeriodoDashboard=[
  {name:'periodo',required:false,schema:periodoDashboardSchema},
  {name:'inicio',required:false,schema:dataHoraInstitucionalSchema},
  {name:'fim',required:false,schema:dataHoraInstitucionalSchema},
];
export const notasDashboardPeriodo='SCRUM-164: periodo=hoje|7d|30d|personalizado (padrão hoje). Personalizado exige inicio/fim ISO com offset, até 31 dias; demais períodos recusam inicio/fim. Query estrita. Período filtra saída institucional; fila pendente é atual, sem filtro temporal. Datas de auditoria são civis sem offset, não UTC. Motoristas indeterminados sem jornada/escala; nunca contar todos ou retornar zero fictício.';
export const periodoDashboard=z.object({
  periodo:periodoDashboardSchema,inicio:z.iso.datetime({offset:true}),fim:z.iso.datetime({offset:true}),
  criterio:z.literal('dataHoraSaida'),fuso:z.literal('America/Maceio'),
});
const contagens=z.array(z.object({status:z.string().nullable(),total:z.number().int()}));
export const graficosPeriodo=z.object({data:z.object({veiculosPorStatus:contagens,solicitacoesPorStatus:contagens,periodo:periodoDashboard})});
const atividade=z.object({id,solicitacaoId:id,codigo:z.string(),descricao:z.string(),dataHora:z.string().nullable(),responsavelId:id.nullable()});
export const indicadoresInstitucionais=z.object({
  periodo:periodoDashboard,
  pendentes:z.number().int().nonnegative(),
  aprovadas:z.number().int().nonnegative().describe('Estado atual APROVADA dos pedidos com saída no período; não conta eventos de decisão. Semântica provisória sujeita ao aceite da equipe.'),
  reprovadas:z.number().int().nonnegative().describe('Estado atual REPROVADA dos pedidos com saída no período; não conta eventos de decisão. Semântica provisória sujeita ao aceite da equipe.'),
  veiculosDisponiveis:z.number().int().nonnegative(),
  filaAguardandoAnalise:z.array(z.object({id,codigo:z.string(),codigoExibicao:z.string(),origem:z.string(),destino:z.string(),criadoEm:z.string().nullable(),acao:z.literal('ANALISAR')})),
  atividadeRecente:z.array(atividade),decisoesRecentes:z.array(atividade),
  indicadoresIndisponiveis:z.array(z.object({indicador:z.enum(['IND-02','IND-08','IND-09']),estado:z.literal('indisponivel'),motivo:z.string()})),
});
