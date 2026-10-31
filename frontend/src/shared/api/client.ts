import { fetchAutenticada } from '../services/auth.service';
import { ApiError, apiError } from './errors';
import { apiOperations } from './generated/operations';
import type { ApiOperations } from './generated/schema';

/** Transporte comum: auth/401 via adaptador existente, cancelamento, 204, JSON e correlação do servidor. */
export async function requestApi<T = unknown>(path: string, init: RequestInit = {}, parse?: (value:unknown)=>T, autenticada = true): Promise<T> {
  let response: Response;
  try { response = await (autenticada ? fetchAutenticada(path,init) : fetch(path,init)); }
  catch (error) {
    if (error instanceof ApiError || error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(0,'FALHA_REDE','Não foi possível conectar ao servidor. Tente novamente.');
  }
  if (init.signal?.aborted) throw new DOMException('Solicitação cancelada.','AbortError');
  const requestId = response.headers.get('X-Request-Id') ?? undefined;
  if (response.status === 204) return undefined as T;
  let body: unknown;
  try { body = await response.json(); }
  catch {
    if (init.signal?.aborted) throw new DOMException('Solicitação cancelada.','AbortError');
    if (!response.ok) throw apiError(response.status, undefined, requestId);
    throw new ApiError(response.status,'RESPOSTA_INVALIDA','A resposta do servidor é inválida. Tente novamente.',undefined,requestId);
  }
  if (!response.ok) throw apiError(response.status,body,requestId);
  if (init.signal?.aborted) throw new DOMException('Solicitação cancelada.','AbortError');
  try { return parse ? parse(body) : body as T; }
  catch (error) {
    throw new ApiError(response.status,'RESPOSTA_INVALIDA',error instanceof ApiError ? error.message : 'A resposta do servidor é inválida. Tente novamente.',undefined,requestId);
  }
}

/** Executa um binding gerado; o parser é obrigatório porque tipos não validam JSON em runtime. */
export async function executeApi<K extends keyof ApiOperations>(operation: K, options: {
  body?: ApiOperations[K]['body']; id?: string; query?: URLSearchParams; signal?: AbortSignal;
  parse: (value: unknown) => ApiOperations[K]['response'];
}): Promise<ApiOperations[K]['response']> {
  const binding = apiOperations[operation];
  if (binding.path.includes('{id}') && !options.id) throw new Error('Identificador obrigatório.');
  const path = binding.path.replace('{id}',encodeURIComponent(options.id ?? '')) + (options.query ? '?'+options.query : '');
  return requestApi(path,{method:binding.method,signal:options.signal,
    ...(options.body === undefined ? {} : {headers:{'Content-Type':'application/json'},body:JSON.stringify(options.body)})},options.parse);
}
