import { createServer, type ServerResponse } from 'node:http';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { enviarJson } from '../../src/shared/http/json.js';
import { openapi } from '../../src/shared/contract/openapi.js';
import { checkCompatibility } from '../../../scripts/generate-api.js';

const server = createServer((req, res) => {
  const status = Number(req.url?.slice(1));
  enviarJson(res, status, { erro: 'Confira os dados informados.' });
});
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test.each([400, 401, 403, 404, 405, 408, 409, 410, 413, 415, 422, 429, 499])('HTTP %i normaliza envelope legado sem mudar o status', async status => {
  const response = await fetch(`${base}/${status}`);
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toEqual({ error: { code: `HTTP_${status}`, message: 'Confira os dados informados.' } });
});

test('preserva código de domínio, mensagem e campos, descartando detalhes internos', () => {
  let result = '';
  const res = { writeHead() {}, end(value: string) { result = value; } } as unknown as ServerResponse;
  enviarJson(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Confira a placa.', fields: { placa: 'Informe a placa.' }, stack: 'privado' } });
  expect(JSON.parse(result)).toEqual({ error: { code: 'ENTRADA_INVALIDA', message: 'Confira a placa.', fields: { placa: 'Informe a placa.' } } });
});

test('gate autoriza somente a troca do envelope 4xx, mantendo status e cabeçalhos protegidos', () => {
  const current = openapi();
  const previous = structuredClone(current);
  const path = '/api/svo/ordens-coleta/{id}/despachar';
  type ResponseSchema = { content: { 'application/json': { schema: { $ref: string } } }; headers: Record<string, unknown> };
  const old = previous.paths[path].patch as { responses: Record<string, ResponseSchema> };
  old.responses[409].content['application/json'].schema.$ref = '#/components/schemas/ErroSvo';
  expect(() => checkCompatibility(previous, current)).not.toThrow();
  for (const change of [
    (responses: Record<string, ResponseSchema>) => { delete responses[409]; },
    (responses: Record<string, ResponseSchema>) => { responses[409].headers.Extra = { schema: { type: 'string' } }; },
    (responses: Record<string, ResponseSchema>) => { responses[409].content['application/json'].schema.$ref = '#/components/schemas/Usuario'; },
  ]) {
    const altered = structuredClone(current);
    change((altered.paths[path].patch as { responses: Record<string, ResponseSchema> }).responses);
    expect(() => checkCompatibility(previous, altered)).toThrow(/Contrato existente alterado/);
  }
});
