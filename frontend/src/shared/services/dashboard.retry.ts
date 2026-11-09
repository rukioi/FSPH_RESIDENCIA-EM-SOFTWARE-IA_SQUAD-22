import { ApiError } from '../api/errors';

function esperar(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(new DOMException('Consulta cancelada.', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Repete somente leituras com falhas transitórias; cancelamento encerra também a espera. */
export async function consultarDashboardComRetry<T>(load: () => Promise<T>, signal: AbortSignal): Promise<T> {
  const pausas = [1000, 3000];
  for (let tentativa = 0; ; tentativa++) {
    signal.throwIfAborted();
    try { return await load(); }
    catch (error) {
      const transitorio = error instanceof ApiError && (error.status === 0 || error.status === 408 || [500, 502, 503, 504].includes(error.status));
      if (!transitorio || tentativa >= pausas.length) throw error;
      await esperar(pausas[tentativa], signal);
    }
  }
}
