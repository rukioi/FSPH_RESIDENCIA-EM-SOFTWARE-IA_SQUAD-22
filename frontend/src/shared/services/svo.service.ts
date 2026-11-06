import { svoSchemas } from '../../../../backend/src/modules/svo/svo.schemas';
import { svoConsultasSchemas } from '../../../../backend/src/modules/svo/svo.consultas.schemas';
import { svoDashboardSchemas } from '../../../../backend/src/modules/svo/svo.dashboard.schemas';
import { svoOperacionalSchemas } from '../../../../backend/src/modules/svo/svo.operacional.schemas';
import { executeApi } from '../api/client';
import { parseResponse } from '../api/validation';
import type { CriarSolicitacaoSvoRequest, StatusTriagemSvo, SalvarTriagemSvoRequest, FinalizarTriagemSvoRequest, FiltrosSolicitacoesSvo, FiltrosOrdensSvo, PeriodoDashboardSvo } from '../types/svo';
import { ApiError } from '../api/errors';

/** Valida a confirmação da solicitação sem reconstruir uma resposta local. */
export async function criarSolicitacaoSvo(body:CriarSolicitacaoSvoRequest) {
  const entrada = svoSchemas.CriarSolicitacaoSvo.safeParse(body);
  if (!entrada.success) throw new ApiError(400,'DADOS_INVALIDOS','Confira os campos obrigatórios, os limites e o formato do telefone.');
  return executeApi('svo_post__api_svo_solicitacoes',{body:entrada.data,parse:v=>parseResponse(svoSchemas.SolicitacaoSvo,v)});
}
/** Consulta somente o recorte e o filtro de status entregues pela SCRUM-130. */
export async function listarSolicitacoesSvo(status?: StatusTriagemSvo, signal?: AbortSignal) {
  return executeApi('svo_get__api_svo_solicitacoes', { signal,
    query: status ? new URLSearchParams({status}) : undefined,
    parse: value => parseResponse(svoSchemas.SolicitacoesSvo, value) });
}
/** Consulta paginada da SCRUM-146, omitindo filtros vazios e preservando o GET legado. */
export async function consultarSolicitacoesSvo(filtros: FiltrosSolicitacoesSvo, signal?: AbortSignal) {
  const query = new URLSearchParams({page:String(filtros.page),limit:'20'});
  for (const key of ['status','inicio','fim'] as const) if(filtros[key]) query.set(key,filtros[key]);
  return executeApi('svo_get__api_svo_solicitacoes_paginadas',{signal,query,
    parse:value=>parseResponse(svoConsultasSchemas.ListaSolicitacoesSvoPaginada,value)});
}
/** Consulta estados reais das ordens, sem restringir a listagem ao despacho pendente. */
export async function consultarOrdensSvo(filtros: FiltrosOrdensSvo, signal?: AbortSignal) {
  const query = new URLSearchParams({page:String(filtros.page),limit:'20'});
  if(filtros.status) query.set('status',filtros.status);
  return executeApi('svo_get__api_svo_ordens_coleta_paginadas',{signal,query,
    parse:value=>parseResponse(svoConsultasSchemas.ListaOrdensSvoPaginada,value)});
}
/** Recupera dados persistidos e rascunho de triagem sem produzir efeitos colaterais. */
export async function consultarSolicitacaoSvo(id: string, signal?: AbortSignal) {
  return executeApi('svo_get__api_svo_solicitacoes_id_',{id,signal,parse:value=>{
    const resposta=parseResponse(svoConsultasSchemas.DetalheSolicitacaoSvo,value);
    if(resposta.id!==id) throw new Error('Resposta incompatível.');
    return resposta;
  }});
}
/** Agregações oficiais do período; uma resposta de outro período nunca é aplicada. */
export async function consultarDashboardSvo(periodo: PeriodoDashboardSvo, signal?: AbortSignal) {
  return executeApi('svo_get__api_svo_dashboard',{signal,query:new URLSearchParams({periodo}),parse:value=>{
    const resposta=parseResponse(svoDashboardSchemas.DashboardOperacionalSvo,value);
    if(resposta.periodo!==periodo) throw new Error('Período incompatível.');
    return resposta;
  }});
}
/** Filas atuais independem do período selecionado no dashboard. */
export async function consultarFilasSvo(signal?: AbortSignal) {
  return executeApi('svo_get__api_svo_dashboard_filas',{signal,
    parse:value=>parseResponse(svoDashboardSchemas.FilasOperacionaisSvo,value)});
}
/** Somente eventos persistidos retornados pelo serviço de atividades SVO. */
export async function consultarAtividadesSvo(signal?: AbortSignal) {
  return executeApi('svo_get__api_svo_dashboard_atividades',{signal,query:new URLSearchParams({limite:'10'}),
    parse:value=>parseResponse(svoDashboardSchemas.AtividadesRecentesSvo,value)});
}
/** Salva observações sem decidir a triagem nem gerar ordem. */
export async function salvarTriagemSvo(id: string, body: SalvarTriagemSvoRequest) {
  return executeApi('svo_patch__api_svo_solicitacoes_id_triagem', {id, body,
    parse: value => {
      const result = parseResponse(svoSchemas.TriagemParcialSvo, value);
      if (result.solicitacaoId !== id) throw new Error('Resposta incompatível.');
      return result;
    } });
}
/** Finaliza a triagem e valida o vínculo e a ordem exclusiva da decisão SVO. */
export async function finalizarTriagemSvo(id: string, body: FinalizarTriagemSvoRequest) {
  return executeApi('svo_post__api_svo_solicitacoes_id_triagem', {id, body,
    parse: value => {
      const result = parseResponse(svoSchemas.TriagemFinalSvo, value);
      if (result.solicitacao.id !== id || result.solicitacao.statusTriagem !== body.decisao ||
        (body.decisao === 'CONFIRMADA_SVO' ? !result.ordemColeta : result.ordemColeta !== null)) throw new Error('Resposta incompatível.');
      return result;
    } });
}
/** Lista as ordens no status público atual, com cancelamento propagado. */
export async function listarOrdensAguardandoSvo(signal?:AbortSignal) {
  return executeApi('svo_get__api_svo_ordens_coleta',{signal,query:new URLSearchParams({status:'AGUARDANDO_DESPACHO'}),parse:v=>parseResponse(svoSchemas.OrdensSvo,v)});
}
/** Consulta candidatos e capacidade informados pelo backend, sem filtrar a frota geral. */
export async function consultarRecursosDisponiveisSvo(signal?:AbortSignal) {
  return executeApi('svo_get__api_svo_recursos_disponiveis',{signal,
    parse:value=>parseResponse(svoOperacionalSchemas.RecursosDisponiveisSvo,value)});
}
/** Revalida a ocupação da S10 selecionada sem presumir disponibilidade em falhas. */
export async function consultarOcupacaoSvo(id:string,signal?:AbortSignal) {
  return executeApi('svo_get__api_svo_veiculos_id_ocupacao',{id,signal,parse:value=>{
    const data=parseResponse(svoOperacionalSchemas.OcupacaoSvo,value);
    if(data.id!==id)throw new Error('Resposta incompatível.');
    return data;
  }});
}
/** Recupera quantidade e situação persistidas para preparar o despacho. */
export async function consultarOrdemSvo(id:string,signal?:AbortSignal) {
  return executeApi('svo_get__api_svo_ordens_coleta_id_',{id,signal,parse:value=>{
    const data=parseResponse(svoConsultasSchemas.DetalheOrdemSvo,value);
    if(data.id!==id)throw new Error('Resposta incompatível.');
    return data;
  }});
}
/** Mantém os IDs numéricos do contrato de despacho existente e aguarda confirmação. */
export async function despacharOrdemSvo(ordemId:string,motoristaId:number,veiculoId:number) {
  if(![Number(ordemId),motoristaId,veiculoId].every(id=>Number.isSafeInteger(id)&&id>0))
    throw new ApiError(400,'DADOS_INVALIDOS','Identificador fora da faixa suportada pelo despacho.');
  return executeApi('svo_patch__api_svo_ordens_coleta_id_despachar',{id:ordemId,body:{motoristaId,veiculoId},parse:v=>{
    const data=parseResponse(svoSchemas.OrdemDespachada,v);
    if(data.id!==Number(ordemId)||data.motorista_id!==motoristaId||data.veiculo_id!==veiculoId)throw new Error('Resposta incompatível.');
    return data;
  }});
}
