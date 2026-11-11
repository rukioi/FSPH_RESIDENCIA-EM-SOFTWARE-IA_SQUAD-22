import { executeApi } from '../api/client';
import { parseResponse } from '../api/validation';
import { notificacoesSchemas } from '../../../../backend/src/modules/notificacoes/notificacoes.schemas';
import type { ApiOperations } from '../api/generated/schema';

export type CaixaNotificacoes = ApiOperations['notificacoes_get__api_notificacoes']['response'];
export type FiltroNotificacoes = 'todas' | 'nao-lidas' | 'lidas';

/** Consulta caixa paginada e contagem global, validando JSON antes de aplicar. */
export function buscarNotificacoes(filtro: FiltroNotificacoes, page: number, signal?: AbortSignal) {
  return executeApi('notificacoes_get__api_notificacoes', { signal,
    query: new URLSearchParams({ filtro, page: String(page), limit: '20' }),
    parse: value=>parseResponse(notificacoesSchemas.ListaNotificacoes,value) });
}
/** Solicita materialização idempotente dos alertas de vencimento autorizados. */
export function sincronizarNotificacoes(signal?: AbortSignal) {
  return executeApi('notificacoes_post__api_notificacoes_sincronizar', {signal,
    parse:value=>parseResponse(notificacoesSchemas.NotificacoesAtualizadas,value)});
}
/** Confirma leitura individual ou da caixa inteira no servidor. */
export function lerNotificacoes(id?: string, signal?: AbortSignal) {
  return executeApi(id ? 'notificacoes_post__api_notificacoes_id_ler' : 'notificacoes_post__api_notificacoes_ler_todas', {id,signal,
    parse:value=>parseResponse(notificacoesSchemas.NotificacoesAtualizadas,value)});
}
