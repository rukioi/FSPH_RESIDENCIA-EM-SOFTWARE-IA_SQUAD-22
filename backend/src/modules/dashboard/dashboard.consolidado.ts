import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { obterIndicadores } from './dashboard.service.js';
import { dashboardSchemas } from './dashboard.schemas.js';
import { dashboardConsolidadoSchemas } from './dashboard.consolidado.schemas.js';
import { obterIndicadoresAbastecimentos } from '../abastecimentos/abastecimentos.service.js';
import { filtroDashboardSvo } from '../svo/svo.dashboard.schemas.js';
import { consultarDashboardSvo,consultarFilasSvo,consultarAtividadesSvo } from '../svo/svo.dashboard.repository.js';

/** Consolida leituras autorizadas dos módulos, sem reconstruir métricas nem ocultar falha como zero. */
export async function obterDashboardConsolidado(perfil:string,params:URLSearchParams){
  if(perfil==='ATENDENTE_SVO'){
    for(const key of params.keys())if(params.getAll(key).length!==1)throw new ErroHttp(400,'DADOS_INVALIDOS','Período inválido.');
    const q=filtroDashboardSvo.safeParse(Object.fromEntries(params));
    if(!q.success)throw new ErroHttp(400,'DADOS_INVALIDOS','O painel SVO suporta hoje, 7d e 30d.');
    const [operacional,filas,atividades]=await Promise.all([consultarDashboardSvo(q.data.periodo),consultarFilasSvo(),consultarAtividadesSvo(10)]);
    return dashboardConsolidadoSchemas.DashboardConsolidado.parse({data:{visao:'SVO',operacional,filas,atividades:atividades.data}});
  }
  if(!['ADM','GESTOR_FROTA'].includes(perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  const gestao=dashboardSchemas.DashboardGestorIndicadores.parse(await obterIndicadores(params,true)).data;
  const periodo=gestao.periodo;
  const complemento=await sql.begin('isolation level repeatable read read only',async tx=>{
    const [janela]=await tx`SELECT (${periodo.inicio}::timestamptz AT TIME ZONE 'America/Maceio') AS inicio,
      (${periodo.fim}::timestamptz AT TIME ZONE 'America/Maceio') AS fim,
      to_char(${periodo.inicio}::timestamptz AT TIME ZONE 'America/Maceio','YYYY-MM-DD') AS dia_inicio,
      to_char((${periodo.fim}::timestamptz AT TIME ZONE 'America/Maceio')-interval '1 microsecond','YYYY-MM-DD') AS dia_fim`;
    const porStatus=await tx<{status:string|null;total:number}[]>`SELECT v.status,count(*)::int AS total FROM public.viagem v
      JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id
      WHERE s.data_hora_saida>=${janela.inicio} AND s.data_hora_saida<${janela.fim} GROUP BY v.status ORDER BY v.status`;
    const proximas=await tx`SELECT v.id::text,s.id::text AS "solicitacaoId",to_char(s.data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US') AS saida,
      v.status,v.veiculo_id::text AS "veiculoId",v.motorista_id::text AS "motoristaId" FROM public.viagem v
      JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE v.status='AGENDADA'
      AND s.data_hora_saida>=${janela.inicio} AND s.data_hora_saida<${janela.fim}
      AND s.data_hora_saida>=CURRENT_TIMESTAMP AT TIME ZONE 'America/Maceio'
      ORDER BY s.data_hora_saida,v.id LIMIT 10`;
    const [docs]=await tx`WITH validades AS (SELECT data_vencimento AS validade FROM public.documento_veiculo UNION ALL SELECT validade_cnh FROM public.motorista)
      SELECT count(*) FILTER(WHERE validade<CURRENT_DATE)::int AS vencidos,count(*) FILTER(WHERE validade=CURRENT_DATE)::int AS hoje FROM validades`;
    return {viagens:{criterio:'dataHoraSaida',quantidade:porStatus.reduce((n,r)=>n+r.total,0),porStatus,proximas},
      documentos:{criterio:'ESTADO_ATUAL',vencidos:docs.vencidos,vencemHoje:docs.hoje,alertas:{estado:'INDISPONIVEL',valor:null,motivo:'REGRA_RF46_PENDENTE'}},
      diaInicio:janela.dia_inicio as string,diaFim:janela.dia_fim as string};
  });
  const abastecimentos=await obterIndicadoresAbastecimentos(new URLSearchParams({inicio:complemento.diaInicio,fim:complemento.diaFim}));
  // Esta visão fornece viagens reais; o endpoint legado continua com seu contrato sem mudança.
  gestao.indicadores.indicadoresIndisponiveis=[{indicador:'IND-09',estado:'indisponivel',motivo:'Janela e repetição RF46 dependem de decisão de negócio; vencidos/hoje são contagens reais disponíveis.'}];
  return dashboardConsolidadoSchemas.DashboardConsolidado.parse({data:{visao:'GESTAO',gestao,
    viagens:complemento.viagens,documentos:complemento.documentos,abastecimentos:abastecimentos.data}});
}
