import { svoSchemas } from '../../../../backend/src/modules/svo/svo.schemas';
import { executeApi } from '../api/client';
import { parseResponse } from '../api/validation';
import type { CriarSolicitacaoSvoRequest } from '../types/svo';
import { buscarMotoristas } from './motoristas.service';
import { buscarVeiculos } from './veiculos.service';

/** Valida a confirmação da solicitação sem reconstruir uma resposta local. */
export async function criarSolicitacaoSvo(body:CriarSolicitacaoSvoRequest) {
  return executeApi('svo_post__api_svo_solicitacoes',{body,parse:v=>parseResponse(svoSchemas.SolicitacaoSvo,v)});
}
/** Lista as ordens no status público atual, com cancelamento propagado. */
export async function listarOrdensAguardandoSvo(signal?:AbortSignal) {
  return executeApi('svo_get__api_svo_ordens_coleta',{signal,query:new URLSearchParams({status:'AGUARDANDO_DESPACHO'}),parse:v=>parseResponse(svoSchemas.OrdensSvo,v)});
}
/** Preserva o filtro visual existente; disponibilidade definitiva é validada no backend. */
export async function listarMotoristasDisponiveis(signal?:AbortSignal) {
  return (await buscarMotoristas(signal)).filter(item=>item.status === 'DISPONIVEL');
}
/** Reutiliza o serviço validado de veículos e o filtro visual atual. */
export async function listarVeiculosDisponiveis(signal?:AbortSignal) {
  return (await buscarVeiculos(signal)).filter(item=>item.status === 'DISPONIVEL');
}
/** Mantém os IDs numéricos do contrato de despacho existente e aguarda confirmação. */
export async function despacharOrdemSvo(ordemId:string,motoristaId:number,veiculoId:number) {
  return executeApi('svo_patch__api_svo_ordens_coleta_id_despachar',{id:String(ordemId),body:{motoristaId,veiculoId},parse:v=>parseResponse(svoSchemas.OrdemDespachada,v)});
}
