import { afterEach, expect, test, vi } from 'vitest';
import { executeApi, requestApi } from './client';
import { ApiError } from './errors';
import { dataRevision } from './dataChanges';
import type { ApiOperations } from './generated/schema';

vi.mock('../services/auth.service', () => ({ fetchAutenticada: (...args: unknown[]) => fetch(...args as Parameters<typeof fetch>) }));
afterEach(() => vi.unstubAllGlobals());
test.each([true, false])('binding JSON preserva corpo e header, FormData disponível: %s', async disponivel => {
  if (!disponivel) vi.stubGlobal('FormData', undefined);
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  const body = { email: 'fixture@example.invalid', senha: 'fixture-password' };
  await executeApi('auth_post__api_auth_login', { body,
    parse: value => value as ApiOperations['auth_post__api_auth_login']['response'] });
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
});

test('binding de comprovante transmite FormData intacto e deixa o runtime gerar o boundary', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetchMock);
  const body = new FormData();
  body.append('arquivo', new Blob(['%PDF-fixture'], { type: 'application/pdf' }), 'comprovante.pdf');
  await executeApi('abastecimentos_post__api_abastecimentos_id_comprovante', {
    id: '42', body,
    parse: value => value as ApiOperations['abastecimentos_post__api_abastecimentos_id_comprovante']['response'],
  });
  const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(path).toBe('/api/abastecimentos/42/comprovante');
  expect(init.method).toBe('POST');
  expect(init.body).toBe(body);
  expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  const request = new Request('http://fixture.invalid' + path, init);
  expect(request.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/);
  expect(await request.text()).toContain('filename="comprovante.pdf"');
});
test('invalida dados apenas depois de uma escrita bem-sucedida e validada', async () => {
  const before = dataRevision();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('{}')));
  await requestApi('/api/veiculos');
  expect(dataRevision()).toBe(before);
  await requestApi('/api/veiculos', { method: 'POST' });
  expect(dataRevision()).toBe(before + 1);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })));
  await expect(requestApi('/api/veiculos', { method: 'PATCH' })).rejects.toThrow();
  expect(dataRevision()).toBe(before + 1);
});
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

test('normaliza falha de rede sem apresentar mensagem técnica', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  await expect(requestApi('/api/motoristas')).rejects.toMatchObject({status:0,code:'FALHA_REDE',message:'Não foi possível conectar ao servidor. Tente novamente.'});
});

test.each([400, 401, 403, 404, 405, 408, 409, 410, 413, 415, 422, 429, 499])('normaliza HTTP %i mesmo quando a hospedagem devolve texto', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('The page could not be found', {
    status, headers: { 'Content-Type': 'text/plain', 'X-Request-Id': 'vercel-fixture' },
  })));
  await expect(requestApi('/api/veiculos')).rejects.toMatchObject({
    status, code: `HTTP_${status}`, requestId: 'vercel-fixture',
  });
  await expect(requestApi('/api/veiculos')).rejects.not.toThrow(/Unexpected token|The page/);
});

test('ignora resposta de transporte encerrada depois do cancelamento',async () => {
  const controller=new AbortController();
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>{
    controller.abort();
    return new Response(JSON.stringify({data:[]}));
  }));
  await expect(requestApi('/api/motoristas',{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
});
