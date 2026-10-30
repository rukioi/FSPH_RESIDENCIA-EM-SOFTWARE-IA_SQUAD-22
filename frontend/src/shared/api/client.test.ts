import { afterEach, expect, test, vi } from 'vitest';
import { requestApi } from './client';
import { ApiError } from './errors';

vi.mock('../services/auth.service', () => ({ fetchAutenticada: (...args: unknown[]) => fetch(...args as Parameters<typeof fetch>) }));
afterEach(() => vi.unstubAllGlobals());
test('rejeita JSON de sucesso inválido sem apresentar lista vazia como sucesso', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { headers: { 'X-Request-Id': 'fixture-id' } })));
  await expect(requestApi('/api/veiculos')).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA', requestId: 'fixture-id' });
});
test.each([{error:'Falha legada'}, {erro:'Falha legada'}, {error:{code:'CONFLITO',message:'Falha legada',fields:{placa:'Confira'}}}])('normaliza erro legado %j', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {status:409,headers:{'X-Request-Id':'fixture-id'}})));
  await expect(requestApi('/api/veiculos')).rejects.toMatchObject({status:409,message:'Falha legada',requestId:'fixture-id'});
});
test('preserva cancelamento e não tenta interpretar 204', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null,{status:204})));
  await expect(requestApi('/api/veiculos')).resolves.toBeUndefined();
  const abort = new DOMException('Cancelado', 'AbortError');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
  await expect(requestApi('/api/veiculos')).rejects.toBe(abort);
  expect(abort).not.toBeInstanceOf(ApiError);
});
