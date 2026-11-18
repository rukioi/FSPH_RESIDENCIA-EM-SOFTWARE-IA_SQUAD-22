import {comValidacaoTemporal} from '../solicitacoes/solicitacoes.erros.js';
import {ErroHttp} from '../../shared/http/errors.js';
import {parametrosSolicitacoes} from '../solicitacoes/solicitacoes.schemas.js';
import {consultaDashboardSchema,graficosPeriodo} from './dashboard.indicadores.schemas.js';
import {dashboardSchemas} from './dashboard.schemas.js';
import {consultarIndicadores} from './dashboard.repository.js';

function consultarPorPeriodo(params: URLSearchParams, resumo: boolean, incluirMotoristasCandidatos = false) {
  const query=consultaDashboardSchema.safeParse(parametrosSolicitacoes(params));
  if(!query.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Informe um período válido para os indicadores.');
  return comValidacaoTemporal(() => consultarIndicadores(query.data, resumo, incluirMotoristasCandidatos));
}

/** Rejeita query ambígua antes de SQL e valida o DTO completo antes de publicá-lo. */
export async function obterIndicadores(params:URLSearchParams,resumo:boolean){
  const resultado = await consultarPorPeriodo(params, resumo);
  return resumo?dashboardSchemas.DashboardGestorIndicadores.parse({data:resultado.resumo}):graficosPeriodo.parse({data:resultado.graficos});
}

/** Obtém o resumo legado e o indicador provisório no mesmo snapshot. */
export async function obterIndicadoresConsolidados(params: URLSearchParams) {
  const { resumo, motoristasCandidatos } = await consultarPorPeriodo(params, true, true);
  return { gestao: dashboardSchemas.DashboardGestorIndicadores.parse({ data: resumo }).data, motoristasCandidatos };
}
