import { abastecimentosSchemas } from '../../../../backend/src/modules/abastecimentos/abastecimentos.schemas';
import { executeApi, requestImageApi } from '../api/client';
import type { ApiSchemas } from '../api/generated/schema';
import { ApiError } from '../api/errors';
import { parseResponse } from '../api/validation';

export type CriarAbastecimentoDto = ApiSchemas['CriarAbastecimento'];
export type AbastecimentoDto = ApiSchemas['Abastecimentos']['data'][number];

/** Consulta os abastecimentos autorizados e valida a resposta antes da apresentação. */
export async function buscarAbastecimentos(signal?: AbortSignal) {
  return (await executeApi('abastecimentos_get__api_abastecimentos', { signal, parse: value => parseResponse(abastecimentosSchemas.Abastecimentos, value) })).data;
}

/** Registra pela API e só retorna após confirmação e validação da resposta do servidor. */
export async function registrarAbastecimento(body: CriarAbastecimentoDto) {
  const entrada = abastecimentosSchemas.CriarAbastecimento.safeParse(body);
  if (!entrada.success) throw new ApiError(400, 'DADOS_INVALIDOS', 'Confira os dados do abastecimento e tente novamente.');
  return (await executeApi('abastecimentos_post__api_abastecimentos', { body: entrada.data,
    parse: value => parseResponse(abastecimentosSchemas.RespostaAbastecimento, value) })).data;
}

/** Baixa o comprovante privado com sessão e tratamento de erros compartilhados. */
export async function baixarComprovanteAbastecimento(id: string, signal?: AbortSignal): Promise<Blob> {
  if (!/^[1-9]\d*$/.test(id)) throw new ApiError(400, 'DADOS_INVALIDOS', 'Identificador de abastecimento inválido.');
  return requestImageApi(`/api/abastecimentos/${encodeURIComponent(id)}/comprovante`, signal);
}
