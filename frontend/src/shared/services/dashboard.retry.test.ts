import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../api/errors';
import { consultarDashboardComRetry } from './dashboard.retry';

afterEach(() => vi.useRealTimers());

it('recupera duas falhas transitórias antes de expor um erro', async () => {
  vi.useFakeTimers();
  const load = vi.fn().mockRejectedValueOnce(new ApiError(500, 'ERRO_INTERNO', 'falha'))
    .mockRejectedValueOnce(new ApiError(0, 'FALHA_REDE', 'falha')).mockResolvedValue('dados');
  const result = consultarDashboardComRetry(load, new AbortController().signal);
  await vi.advanceTimersByTimeAsync(1000);
  expect(load).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(3000);
  await expect(result).resolves.toBe('dados');
});

it('encerra após três falhas e não repete autenticação ou resposta inválida', async () => {
  vi.useFakeTimers();
  const error = new ApiError(503, 'INDISPONIVEL', 'falha');
  const load = vi.fn().mockRejectedValue(error);
  const result = expect(consultarDashboardComRetry(load, new AbortController().signal)).rejects.toBe(error);
  await vi.advanceTimersByTimeAsync(4000);
  await result;
  expect(load).toHaveBeenCalledTimes(3);
  for (const status of [200, 400, 401, 403]) {
    const invalid = vi.fn().mockRejectedValue(new ApiError(status, 'INVALIDO', 'falha'));
    await expect(consultarDashboardComRetry(invalid, new AbortController().signal)).rejects.toBeInstanceOf(ApiError);
    expect(invalid).toHaveBeenCalledTimes(1);
  }
});

it('cancela a espera ao sair da página ou substituir uma consulta', async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const load = vi.fn().mockRejectedValue(new ApiError(502, 'FALHA', 'falha'));
  const result = expect(consultarDashboardComRetry(load, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  await vi.advanceTimersByTimeAsync(0);
  controller.abort();
  await result;
  await vi.advanceTimersByTimeAsync(4000);
  expect(load).toHaveBeenCalledTimes(1);
});
