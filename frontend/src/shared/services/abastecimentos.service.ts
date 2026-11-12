import { abastecimentosSchemas } from '../../../../backend/src/modules/abastecimentos/abastecimentos.schemas';
import { executeApi, requestImageApi } from '../api/client';
import type { ApiSchemas } from '../api/generated/schema';
import { ApiError } from '../api/errors';
import { parseResponse } from '../api/validation';

export type CriarAbastecimentoDto = ApiSchemas['CriarAbastecimentoRF40'];
export type AbastecimentoDto = ApiSchemas['Abastecimentos']['data'][number];
export type DetalheAbastecimentoDto = ApiSchemas['DetalheAbastecimento'];
export type IndicadoresAbastecimentosDto = ApiSchemas['IndicadoresAbastecimentos']['data'];

export type FiltrosAbastecimentos = { veiculoId?: string; inicio?: string; fim?: string; pagina?: number; limit?: number };

function queryFiltros(filtros: FiltrosAbastecimentos) {
  const query = new URLSearchParams();
  for (const [nome, valor] of Object.entries(filtros)) if (valor !== '' && valor !== undefined) query.set(nome, String(valor));
  return query;
}

/** Recupera o detalhe persistido, incluindo 404 real e ausência de quilometragem. */
export async function buscarDetalheAbastecimento(id: string, signal?: AbortSignal) {
  return (await executeApi('abastecimentos_get__api_abastecimentos_id_', { id, signal,
    parse: value => parseResponse(abastecimentosSchemas.RespostaDetalheAbastecimento, value) })).data;
}

/** Consulta uma página do histórico do servidor, sem reconstruir a cronologia localmente. */
export async function buscarHistoricoAbastecimentos(id: string, filtros: FiltrosAbastecimentos, signal?: AbortSignal) {
  return executeApi('abastecimentos_get__api_veiculos_id_abastecimentos', { id, query: queryFiltros(filtros), signal,
    parse: value => parseResponse(abastecimentosSchemas.HistoricoAbastecimentos, value) });
}

/** Exibe somente agregados e estados de disponibilidade calculados pela API. */
export async function buscarIndicadoresAbastecimentos(filtros: Pick<FiltrosAbastecimentos, 'veiculoId' | 'inicio' | 'fim'>, signal?: AbortSignal) {
  return (await executeApi('abastecimentos_get__api_abastecimentos_indicadores', { query: queryFiltros(filtros), signal,
    parse: value => parseResponse(abastecimentosSchemas.IndicadoresAbastecimentos, value) })).data;
}

/** Consulta os abastecimentos autorizados e valida a resposta antes da apresentação. */
export async function buscarAbastecimentos(signal?: AbortSignal) {
  return (await executeApi('abastecimentos_get__api_abastecimentos', { signal, parse: value => parseResponse(abastecimentosSchemas.Abastecimentos, value) })).data;
}

/** Registra pela API e só retorna após confirmação e validação da resposta do servidor. */
export async function registrarAbastecimento(body: CriarAbastecimentoDto) {
  const entrada = abastecimentosSchemas.CriarAbastecimentoRF40.safeParse(body);
  if (!entrada.success) throw new ApiError(400, 'DADOS_INVALIDOS', 'Confira os dados do abastecimento e tente novamente.');
  return (await executeApi('abastecimentos_post__api_abastecimentos', { body: entrada.data,
    parse: value => parseResponse(abastecimentosSchemas.RespostaAbastecimento, value) })).data;
}

/** Baixa o comprovante privado com sessão e tratamento de erros compartilhados. */
export async function baixarComprovanteAbastecimento(id: string, signal?: AbortSignal): Promise<Blob> {
  if (!/^[1-9]\d*$/.test(id)) throw new ApiError(400, 'DADOS_INVALIDOS', 'Identificador de abastecimento inválido.');
  return requestImageApi(`/api/abastecimentos/${encodeURIComponent(id)}/comprovante`, signal,
    { tipos: ['image/jpeg', 'image/png', 'application/pdf'], limite: 5 * 1024 * 1024 });
}
