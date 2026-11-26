import { motoristasSchemas } from '../../../../backend/src/modules/motoristas/motoristas.schemas';
import { motoristasDisponibilidadeSchemas as schemas, consultaPeriodos, consultaTransicoes, criarEscala, criarImpedimento, cancelarRegistro, motivoTransicao } from '../../../../backend/src/modules/motoristas/motoristas.disponibilidade.schemas';
import { z } from 'zod';
import type { ApiSchemas } from '../api/generated/schema';
import { apiOperations } from '../api/generated/operations';
import { executeApi, requestApi } from '../api/client';
import { parseResponse } from '../api/validation';

export type MotoristaDto = ApiSchemas['Motorista'];
export type CriarMotoristaDto = ApiSchemas['CriarMotorista'];
export type EditarMotoristaDto = ApiSchemas['EditarMotorista'];
export type EscalaMotorista = ApiSchemas['RespostaEscalaMotorista']['data'];
export type ImpedimentoMotorista = ApiSchemas['RespostaImpedimentoMotorista']['data'];
export type TransicaoMotorista = ApiSchemas['RespostaTransicaoMotorista']['data'];
export type ConsultaPeriodosMotorista = { page: number; limit: number; inicio?: string; fim?: string };

export async function buscarMotoristas(signal?: AbortSignal): Promise<MotoristaDto[]> {
  return (await executeApi('motoristas_get__api_motoristas', { ...(signal ? { signal } : {}),
    parse: value => parseResponse(motoristasSchemas.Motoristas, value) })).data;
}
export async function cadastrarMotorista(body: CriarMotoristaDto): Promise<MotoristaDto> {
  return (await executeApi('motoristas_post__api_motoristas', { body,
    parse: value => parseResponse(motoristasSchemas.RespostaMotorista, value) })).data;
}
export async function editarMotorista(id: string, body: EditarMotoristaDto): Promise<MotoristaDto> {
  return (await executeApi('motoristas_patch__api_motoristas_id_', { id: validarId(id), body,
    parse: value => parseResponse(motoristasSchemas.RespostaMotorista, value) })).data;
}
export async function removerMotorista(id: string): Promise<void> {
  await executeApi('motoristas_delete__api_motoristas_id_', { id: validarId(id),
    parse: value => z.object({ data: z.object({ success: z.literal(true) }) }).parse(value) });
}

function validarId(id: string) {
  if (!/^[0-9]+$/.test(id) || BigInt(id) > 9223372036854775807n) throw new Error('Identificador de motorista ou registro inválido.');
  return id;
}
function queryPeriodos(consulta: ConsultaPeriodosMotorista) {
  const entrada = consultaPeriodos.parse(consulta);
  const query = new URLSearchParams({ page: String(entrada.page), limit: String(entrada.limit) });
  if (entrada.inicio && entrada.fim) { query.set('inicio', entrada.inicio); query.set('fim', entrada.fim); }
  return query;
}
export function buscarEscalasMotorista(id: string, consulta: ConsultaPeriodosMotorista, signal?: AbortSignal) {
  return executeApi('motoristas_get__api_motoristas_id_escalas', { id: validarId(id), query: queryPeriodos(consulta), ...(signal ? { signal } : {}),
    parse: value => parseResponse(schemas.ListaEscalasMotorista, value) });
}
export function buscarImpedimentosMotorista(id: string, consulta: ConsultaPeriodosMotorista, signal?: AbortSignal) {
  return executeApi('motoristas_get__api_motoristas_id_impedimentos', { id: validarId(id), query: queryPeriodos(consulta), ...(signal ? { signal } : {}),
    parse: value => parseResponse(schemas.ListaImpedimentosMotorista, value) });
}
export function buscarTransicoesMotorista(id: string, consulta: { page: number; limit: number }, signal?: AbortSignal) {
  const entrada = consultaTransicoes.parse(consulta);
  return executeApi('motoristas_get__api_motoristas_id_transicoes', { id: validarId(id),
    query: new URLSearchParams({ page: String(entrada.page), limit: String(entrada.limit) }), ...(signal ? { signal } : {}),
    parse: value => parseResponse(schemas.ListaTransicoesMotorista, value) });
}
export function cadastrarEscalaMotorista(id: string, body: ApiSchemas['CriarEscalaMotorista']) {
  return executeApi('motoristas_post__api_motoristas_id_escalas', { id: validarId(id), body: criarEscala.parse(body),
    parse: value => parseResponse(schemas.RespostaEscalaMotorista, value) });
}
export function cadastrarImpedimentoMotorista(id: string, body: ApiSchemas['CriarImpedimentoMotorista']) {
  return executeApi('motoristas_post__api_motoristas_id_impedimentos', { id: validarId(id), body: criarImpedimento.parse(body),
    parse: value => parseResponse(schemas.RespostaImpedimentoMotorista, value) });
}
export function inativarMotorista(id: string, motivo: string) {
  return executeApi('motoristas_post__api_motoristas_id_inativacao', { id: validarId(id), body: motivoTransicao.parse({ motivo }),
    parse: value => parseResponse(schemas.RespostaTransicaoMotorista, value) });
}
export function reativarMotorista(id: string, motivo: string) {
  return executeApi('motoristas_post__api_motoristas_id_reativacao', { id: validarId(id), body: motivoTransicao.parse({ motivo }),
    parse: value => parseResponse(schemas.RespostaTransicaoMotorista, value) });
}
/** O cliente gerado atual substitui só {id}; usamos seu transporte comum para os dois parâmetros, sem alterá-lo. */
export function cancelarEscalaMotorista(id: string, registroId: string, motivo: string) {
  const binding = apiOperations.motoristas_post__api_motoristas_id_escalas_registroId_cancelamento;
  return requestApi(binding.path.replace('{id}', validarId(id)).replace('{registroId}', validarId(registroId)), {
    method: binding.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cancelarRegistro.parse({ motivo })),
  }, value => parseResponse(schemas.RespostaEscalaMotorista, value));
}
export function cancelarImpedimentoMotorista(id: string, registroId: string, motivo: string) {
  const binding = apiOperations.motoristas_post__api_motoristas_id_impedimentos_registroId_cancelamento;
  return requestApi(binding.path.replace('{id}', validarId(id)).replace('{registroId}', validarId(registroId)), {
    method: binding.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cancelarRegistro.parse({ motivo })),
  }, value => parseResponse(schemas.RespostaImpedimentoMotorista, value));
}
