import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { consultarFoto, salvarFoto } from '../../src/modules/veiculos/veiculos.foto.controller.js';
import { veiculoExiste } from '../../src/modules/veiculos/veiculos.repository.js';
vi.mock('../../src/modules/veiculos/veiculos.repository.js', () => ({ veiculoExiste: vi.fn() }));
const foto = { tipo: 'image/jpeg', dadosBase64: Buffer.from([255,216,255,0,255,217]).toString('base64') };
function response() {
  const res = { writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
  return res;
}
function request(body: unknown) { return Readable.from([JSON.stringify(body)]) as IncomingMessage; }
beforeEach(() => {
  vi.stubEnv('SUPABASE_STORAGE_URL', 'https://fixture.supabase.co');
  vi.stubEnv('SUPABASE_STORAGE_SERVICE_KEY', 'fixture-key');
  vi.mocked(veiculoExiste).mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });
test('objeto ausente no Storage com HTTP 400 retorna foto null', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: '404', error: 'not_found', code: 'NoSuchKey' }), { status: 400 })));
  const res = response();
  await consultarFoto(res, '1');
  expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"foto":null'));
});
test('valida imagem antes de chamar o armazenamento', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  const res = response();
  await salvarFoto(request({ ...foto, dadosBase64: 'aGVsbG8=' }), res, '1');
  expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything());
  expect(fetchMock).not.toHaveBeenCalled();
});
test('salva foto e retorna dados confirmados pelo armazenamento', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetchMock);
  const res = response(); await salvarFoto(request(foto), res, '1');
  expect(fetchMock).toHaveBeenCalledWith('https://fixture.supabase.co/storage/v1/object/veiculos-fotos/1', expect.objectContaining({ method: 'POST' }));
  expect(res.writeHead).toHaveBeenCalledWith(200, expect.anything());
  expect(res.end).toHaveBeenCalledWith(expect.stringContaining(foto.dadosBase64));
});
test('foto ausente retorna null e armazenamento indisponível retorna erro', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockRejectedValueOnce(new Error('indisponivel'));
  vi.stubGlobal('fetch', fetchMock);
  const primeira = response(); await consultarFoto(primeira, '1');
  expect(primeira.end).toHaveBeenCalledWith(expect.stringContaining('"foto":null'));
  const segunda = response(); await consultarFoto(segunda, '1');
  expect(segunda.writeHead).toHaveBeenCalledWith(503, expect.anything());
});
