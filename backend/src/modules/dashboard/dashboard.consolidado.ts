import { vencimentosRf46 } from '../documentos/documentos.rf46.js';
import { obterIndicadoresAbastecimentosDoDashboard } from '../abastecimentos/abastecimentos.indicadores.js';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { obterIndicadoresConsolidados } from './dashboard.service.js';
import { dashboardConsolidadoSchemas } from './dashboard.consolidado.schemas.js';
import { comValidacaoTemporal } from '../solicitacoes/solicitacoes.erros.js';
import { parametrosSolicitacoes } from '../solicitacoes/solicitacoes.schemas.js';
import { consultaDashboardSchema } from './dashboard.indicadores.schemas.js';
import {
  consultarDashboardSvo, consultarDashboardSvoPersonalizado, consultarFilasSvo, consultarAtividadesSvo,
} from '../svo/svo.dashboard.repository.js';

/** Consolida leituras autorizadas dos módulos, sem reconstruir métricas nem ocultar falha como zero. */
export async function obterDashboardConsolidado(perfil:string,params:URLSearchParams){
  if(perfil==='ATENDENTE_SVO'){
    const consulta = consultaDashboardSchema.safeParse(parametrosSolicitacoes(params));
    if (!consulta.success) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe um período válido para os indicadores.');
    const { periodo, inicio, fim } = consulta.data;
    const painel = periodo === 'personalizado'
      ? comValidacaoTemporal(() => {
        if (!inicio || !fim) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe início e fim do período.');
        return consultarDashboardSvoPersonalizado({ inicio, fim });
      })
      : consultarDashboardSvo(periodo);
    const [operacional, filas, atividades] = await Promise.all([painel, consultarFilasSvo(), consultarAtividadesSvo(10)]);
    return dashboardConsolidadoSchemas.DashboardConsolidado.parse({data:{visao:'SVO',operacional,filas,atividades:atividades.data}});
  }
  if(!['ADM','GESTOR_FROTA'].includes(perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  const { gestao, motoristasCandidatos } = await obterIndicadoresConsolidados(params);
  const periodo=gestao.periodo;
  const complemento=await sql.begin('isolation level repeatable read read only',async tx=>{
    const porStatus = await tx<{status:string|null;total:number}[]>`
      SELECT status, count(*)::int AS total FROM public.viagem
      WHERE data_inicio >= (${periodo.inicio}::text::timestamptz AT TIME ZONE 'America/Maceio')
        AND data_inicio < (${periodo.fim}::text::timestamptz AT TIME ZONE 'America/Maceio')
      GROUP BY status ORDER BY status`;
    const proximas=await tx`SELECT v.id::text,s.id::text AS "solicitacaoId",to_char(s.data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US') || '-03:00' AS saida,
      v.status,v.veiculo_id::text AS "veiculoId",v.motorista_id::text AS "motoristaId" FROM public.viagem v
      JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE v.status='AGENDADA' AND s.status IN ('AGENDADA','PRONTA_PARA_INICIAR')
      AND s.data_hora_saida>=(${periodo.inicio}::text::timestamptz AT TIME ZONE 'America/Maceio') AND s.data_hora_saida<(${periodo.fim}::text::timestamptz AT TIME ZONE 'America/Maceio')
      AND s.data_hora_saida>=CURRENT_TIMESTAMP AT TIME ZONE 'America/Maceio'
      ORDER BY s.data_hora_saida,v.id LIMIT 10`;
    const [docs] = await tx`SELECT count(*) FILTER (WHERE fase = 'VENCIDO')::int AS vencidos,
      count(*) FILTER (WHERE fase = 'HOJE')::int AS hoje,
      count(*) FILTER (WHERE fase <> 'VENCIDO')::int AS alertas
      FROM (${vencimentosRf46(tx)}) alertas`;
    return {viagens:{criterio:'dataInicio',quantidade:porStatus.reduce((n,r)=>n+r.total,0),porStatus,proximas},
      documentos:{criterio:'ESTADO_ATUAL',vencidos:docs.vencidos,vencemHoje:docs.hoje,alertas:{estado:'DISPONIVEL',valor:docs.alertas}}};
  });
  const abastecimentos = await obterIndicadoresAbastecimentosDoDashboard(periodo);
  gestao.indicadores.indicadoresIndisponiveis = gestao.indicadores.indicadoresIndisponiveis.filter(item => !['IND-02', 'IND-08', 'IND-09'].includes(item.indicador));
  return dashboardConsolidadoSchemas.DashboardConsolidado.parse({data:{visao:'GESTAO',gestao,
    viagens:complemento.viagens,documentos:complemento.documentos,abastecimentos:abastecimentos.data,
    disponibilidadeMotoristas: {
      estado: 'PROVISORIA',
      candidatos: motoristasCandidatos,
      motivo: 'SEM_ESCALA_E_MATRIZ_CNH',
    }}});
}
