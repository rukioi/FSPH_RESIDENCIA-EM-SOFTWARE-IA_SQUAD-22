import type { z } from 'zod';
import { anotacoesSchemas, tipoNota } from '../../../../backend/src/modules/anotacoes/anotacoes.schemas';
import { executeApi } from '../api/client';
import { ApiError } from '../api/errors';
import { parseResponse } from '../api/validation';

// Tipos aceitos pelo backend. Os tipos SVO existem no contrato, mas não são usados por este frontend.
export type TipoRegistroNota = z.infer<typeof tipoNota>;
export type Anotacao = z.infer<typeof anotacoesSchemas.Anotacao>;
export type VinculoNota = { tipoRegistro: TipoRegistroNota; registroId: string };

export const LIMITE_TEXTO_NOTA = 2000;

/** Lista as notas do registro (mais recentes primeiro), já validadas pelo schema do backend. */
export async function listarAnotacoes(vinculo: VinculoNota, page: number, limit: number, signal?: AbortSignal) {
  const query = new URLSearchParams({ tipoRegistro: vinculo.tipoRegistro, registroId: vinculo.registroId, page: String(page), limit: String(limit) });
  return executeApi('anotacoes_get__api_anotacoes', { query, signal, parse: value => parseResponse(anotacoesSchemas.ListaAnotacoes, value) });
}

/** Valida como o backend e só retorna a nota confirmada pelo servidor (autor e horário vêm dele). */
export async function criarAnotacao(vinculo: VinculoNota, texto: string): Promise<Anotacao> {
  const entrada = anotacoesSchemas.CriarAnotacao.safeParse({ ...vinculo, texto });
  if (!entrada.success) throw new ApiError(400, 'DADOS_INVALIDOS', `Escreva uma anotação de 1 a ${LIMITE_TEXTO_NOTA.toLocaleString('pt-BR')} caracteres, sem caracteres de controle.`);
  return (await executeApi('anotacoes_post__api_anotacoes', { body: entrada.data, parse: value => parseResponse(anotacoesSchemas.RespostaAnotacao, value) })).data;
}
