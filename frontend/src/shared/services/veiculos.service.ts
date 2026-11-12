import { listaVeiculos, respostaVeiculo, criarVeiculoSchema, editarVeiculoSchema, erroValidacaoVeiculo, fotoVeiculoResposta } from '../../../../backend/src/modules/veiculos/veiculos.schemas';
import type { ApiSchemas } from '../api/generated/schema';
import { executeApi } from '../api/client';
import { ApiError } from '../api/errors';
import { parseResponse } from '../api/validation';

export type VeiculoDto = ApiSchemas['Veiculo'];
export type CriarVeiculoDto = ApiSchemas['CriarVeiculo'];

/** Consulta com cancelamento e valida o envelope inteiro antes de expor dados à tela. */
export async function buscarVeiculos(signal?: AbortSignal): Promise<VeiculoDto[]> {
  return (await executeApi('veiculos_get__api_veiculos',{signal,parse:value=>parseResponse(listaVeiculos,value)})).data;
}
/** Aguarda confirmação do servidor e valida o DTO gerado antes de atualizar a lista. */
export async function cadastrarVeiculo(body: unknown): Promise<VeiculoDto> {
  const result = criarVeiculoSchema.safeParse(body);
  if (!result.success) { const error = erroValidacaoVeiculo(result.error,true,body); throw new ApiError(400,error.code,error.message); }
  const entrada: CriarVeiculoDto = result.data;
  return (await executeApi('veiculos_post__api_veiculos',{body:entrada,parse:value=>parseResponse(respostaVeiculo,value)})).data;
}

/** Valida a alteração parcial e retorna somente o veículo confirmado pelo servidor. */
export async function atualizarVeiculo(id: string, body: unknown): Promise<VeiculoDto> {
  const result = editarVeiculoSchema.safeParse(body);
  if (!result.success) { const error = erroValidacaoVeiculo(result.error, false, body); throw new ApiError(400, error.code, error.message); }
  return (await executeApi('veiculos_patch__api_veiculos_id_', { id, body: result.data, parse: value => parseResponse(respostaVeiculo, value) })).data;
}

export type FotoVeiculo = { tipo: 'image/jpeg' | 'image/png'; dadosBase64: string };
/** Consulta a foto privada e valida a resposta antes de exibi-la. */
export async function buscarFotoVeiculo(id: string, signal?: AbortSignal): Promise<FotoVeiculo | null> {
  return (await executeApi('veiculos_get__api_veiculos_id_foto', { id, signal, parse: value => parseResponse(fotoVeiculoResposta, value) })).data.foto;
}
/** Envia a foto e aguarda confirmação do armazenamento. */
export async function salvarFotoVeiculo(id: string, foto: FotoVeiculo): Promise<FotoVeiculo | null> {
  return (await executeApi('veiculos_put__api_veiculos_id_foto', { id, body: foto, parse: value => parseResponse(fotoVeiculoResposta, value) })).data.foto;
}
