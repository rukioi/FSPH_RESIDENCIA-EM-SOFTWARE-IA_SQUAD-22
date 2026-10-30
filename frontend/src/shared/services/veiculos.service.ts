import { listaVeiculos, respostaVeiculo, criarVeiculoSchema, erroValidacaoVeiculo } from '../../../../backend/src/modules/veiculos/veiculos.schemas';
import type { ApiSchemas } from '../api/generated/schema';
import { executeApi } from '../api/client';
import { ApiError } from '../api/errors';

export type VeiculoDto = ApiSchemas['Veiculo'];
export type CriarVeiculoDto = ApiSchemas['CriarVeiculo'];
function validar<T>(schema: {safeParse:(value:unknown)=>{success:true;data:T}|{success:false}}, value:unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(200,'RESPOSTA_INVALIDA','A resposta de veículos está incompleta. Tente novamente.');
  return result.data;
}
/** Consulta com cancelamento e valida o envelope inteiro antes de expor dados à tela. */
export async function buscarVeiculos(signal?: AbortSignal): Promise<VeiculoDto[]> {
  return (await executeApi('veiculos_get__api_veiculos',{signal,parse:value=>validar(listaVeiculos,value)})).data;
}
/** Aguarda confirmação do servidor e valida o DTO gerado antes de atualizar a lista. */
export async function cadastrarVeiculo(body: unknown): Promise<VeiculoDto> {
  const result = criarVeiculoSchema.safeParse(body);
  if (!result.success) { const error = erroValidacaoVeiculo(result.error,true,body); throw new ApiError(400,error.code,error.message); }
  const entrada: CriarVeiculoDto = result.data;
  return (await executeApi('veiculos_post__api_veiculos',{body:entrada,parse:value=>validar(respostaVeiculo,value)})).data;
}
