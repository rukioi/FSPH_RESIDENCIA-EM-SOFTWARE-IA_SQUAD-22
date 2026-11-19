import { consultaRelatorioSchema, respostaRelatorioSchema, respostaRecursosRelatoriosSchema } from '../../../../backend/src/modules/relatorios/relatorios.schemas';
import type { ConsultaRelatorio } from '../../../../backend/src/modules/relatorios/relatorios.schemas';
import { executeApi } from '../api/client';
import { parseResponse } from '../api/validation';
export type { Relatorio, ConsultaRelatorio } from '../../../../backend/src/modules/relatorios/relatorios.schemas';
export { statusPorRelatorio } from '../../../../backend/src/modules/relatorios/relatorios.schemas';

/** Consulta um snapshot completo com filtros validados, cancelável pelo estado remoto. */
export async function buscarRelatorio(filtros: ConsultaRelatorio, signal: AbortSignal) {
  const consulta = consultaRelatorioSchema.parse(filtros);
  const query = new URLSearchParams(Object.entries(consulta).filter((entry): entry is [string,string] => entry[1] !== undefined));
  const operation = filtros.tipo === 'svo' ? 'relatorios_get__api_svo_relatorios' : 'relatorios_get__api_relatorios';
  return (await executeApi(operation, {query, signal, parse: value => parseResponse(respostaRelatorioSchema,value)})).data;
}

/** Carrega apenas nomes e identificadores necessários para selecionar recursos. */
export async function buscarRecursosRelatorios(svo: boolean, signal: AbortSignal) {
  return (await executeApi(svo ? 'relatorios_get__api_svo_relatorios_recursos' : 'relatorios_get__api_relatorios_recursos', {
    signal, parse: value => parseResponse(respostaRecursosRelatoriosSchema,value),
  })).data;
}
