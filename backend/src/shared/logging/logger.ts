import { AsyncLocalStorage } from 'node:async_hooks';

export const contextoRequisicao = new AsyncLocalStorage<{ requestId: string }>();
type Evento = 'request_failed' | 'server_started' | 'server_stopped' | 'startup_failed';
const codigosSeguros = new Set(['23503', '23505', '23514', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);

/** Allowlist estrita: nunca serializa mensagem, detail, cause ou objetos recebidos. */
export function registrarFalha(_erro?: unknown): void {
  const code = typeof _erro === 'object' && _erro !== null && 'code' in _erro ? _erro.code : undefined;
  registrarEvento('request_failed', typeof code === 'string' && codigosSeguros.has(code) ? code : undefined);
}

/** Registra apenas evento fechado, UUID gerado no servidor e código técnico conhecido. */
export function registrarEvento(evento: Evento, codigo?: string): void {
  const requestId = contextoRequisicao.getStore()?.requestId;
  const registro = {
    event: ['request_failed', 'server_started', 'server_stopped', 'startup_failed'].includes(evento) ? evento : 'request_failed',
    ...(requestId && /^[a-f0-9-]{36}$/.test(requestId) ? { requestId } : {}),
    ...(codigo && codigosSeguros.has(codigo) ? { code: codigo } : {}),
  };
  console.error(JSON.stringify(registro));
}
