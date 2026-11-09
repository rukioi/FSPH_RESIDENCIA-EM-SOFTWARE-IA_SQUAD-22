import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ token: 'session-a', execute: vi.fn() }));
vi.mock('./auth.service', () => ({ obterToken: () => fixture.token }));
vi.mock('../api/client', () => ({ executeApi: fixture.execute }));
import { buscarPendenciasDashboard } from './dashboard.service';
import { notifyDataChanged } from '../api/dataChanges';

beforeEach(() => { vi.useRealTimers(); fixture.token = 'session-a'; fixture.execute.mockReset(); notifyDataChanged(); });

it('reuses memory cache and invalidates after writes, expiry and session change', async () => {
  vi.useFakeTimers();
  fixture.execute.mockResolvedValue({ data: { motoristas: [], documentos: [] } });
  const signal = new AbortController().signal;
  await buscarPendenciasDashboard(signal);
  await buscarPendenciasDashboard(signal);
  expect(fixture.execute).toHaveBeenCalledTimes(1);
  notifyDataChanged();
  await buscarPendenciasDashboard(signal);
  expect(fixture.execute).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(30_001);
  await buscarPendenciasDashboard(signal);
  expect(fixture.execute).toHaveBeenCalledTimes(3);
  fixture.token = 'session-b';
  await buscarPendenciasDashboard(signal);
  expect(fixture.execute).toHaveBeenCalledTimes(4);
  vi.useRealTimers();
});

it('does not cache a response started before invalidation', async () => {
  let resolve!: (value: unknown) => void;
  fixture.execute.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const pending = buscarPendenciasDashboard(new AbortController().signal);
  notifyDataChanged();
  resolve({ data: { motoristas: [], documentos: [] } });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  fixture.execute.mockResolvedValue({ data: { motoristas: [], documentos: [] } });
  await buscarPendenciasDashboard(new AbortController().signal);
  expect(fixture.execute).toHaveBeenCalledTimes(2);
});
