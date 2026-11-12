import { motoristasSchemas } from '../../../../backend/src/modules/motoristas/motoristas.schemas';
import { z } from 'zod';
import type { ApiSchemas } from '../api/generated/schema';
import { executeApi } from '../api/client';
import { parseResponse } from '../api/validation';

export type MotoristaDto = ApiSchemas['Motorista'];
export type CriarMotoristaDto = ApiSchemas['CriarMotorista'];

/** Consulta a projeção permitida ao perfil atual, validando antes de expor à tela. */
export async function buscarMotoristas(signal?: AbortSignal): Promise<MotoristaDto[]> {
  return (await executeApi('motoristas_get__api_motoristas', { signal,
    parse: value => parseResponse(motoristasSchemas.Motoristas, value) })).data;
}

/** Retorna somente o cadastro confirmado pelo servidor, sem completar campos localmente. */
export async function cadastrarMotorista(body: CriarMotoristaDto): Promise<MotoristaDto> {
  return (await executeApi('motoristas_post__api_motoristas', { body,
    parse: value => parseResponse(motoristasSchemas.RespostaMotorista, value) })).data;
}

/** Remove o cadastro e só confirma a operação após resposta válida da API. */
export async function removerMotorista(id: string): Promise<void> {
  await executeApi('motoristas_delete__api_motoristas_id_', { id,
    parse: value => z.object({ data: z.object({ success: z.literal(true) }) }).parse(value) });
}
