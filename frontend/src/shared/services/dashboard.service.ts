import { dashboardSchemas } from '../../../../backend/src/modules/dashboard/dashboard.schemas';
import { executeApi } from '../api/client';
import { parseResponse } from '../api/validation';
import { obterToken } from './auth.service';
import { dataRevision, onDataChanged } from '../api/dataChanges';
import { consultarDashboardComRetry } from './dashboard.retry';

const cache = new Map<string, { value: unknown; expires: number }>();
let session: string | null = null;
onDataChanged(() => cache.clear());

async function cached<T>(key: string, signal: AbortSignal, load: () => Promise<T>): Promise<T> {
  const token = obterToken();
  if (session !== token) { cache.clear(); session = token; }
  signal.throwIfAborted();
  const hit = cache.get(key);
  if (token && hit && hit.expires > Date.now()) return hit.value as T;
  const revision = dataRevision();
  const value = await consultarDashboardComRetry(load, signal);
  signal.throwIfAborted();
  if (revision !== dataRevision() || token !== obterToken()) throw new DOMException('Consulta substituída.', 'AbortError');
  if (cache.size >= 12) cache.clear();
  cache.set(key, { value, expires: Date.now() + 30_000 });
  return value;
}

/** Consulta o resumo validado no contrato, respeitando o cancelamento da leitura. */
export async function buscarDashboard(periodo: string, inicio: string, fim: string, signal: AbortSignal) {
  const query = new URLSearchParams({ periodo });
  if (periodo === 'personalizado') { query.set('inicio', `${inicio}T00:00:00-03:00`); query.set('fim', `${fim}T00:00:00-03:00`); }
  return cached(query.toString(), signal, async () => (await executeApi('dashboard_get__api_dashboard_gestor', { query, signal, parse: value => parseResponse(dashboardSchemas.DashboardGestorIndicadores, value) })).data);
}

/** Consulta as pendências documentais pelo endpoint existente. */
export async function buscarPendenciasDashboard(signal: AbortSignal) {
  return cached('pendencias', signal, async () => (await executeApi('dashboard_get__api_dashboard_pendencias', { signal, parse: value => parseResponse(dashboardSchemas.PendenciasDashboard, value) })).data);
}

// Mantido para consumidores legados que ainda não possuem indicadores.
export const indicadoresIndisponiveis = 'Indicadores por período indisponíveis. Esta seção está em construção.';
