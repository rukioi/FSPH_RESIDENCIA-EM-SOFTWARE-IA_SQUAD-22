import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
vi.mock('../../src/database/connection.js', () => ({ sql: vi.fn() }));
import '../../src/app.js';
import handler from '../../../api/index.js';

const server = createServer((req, res) => { void handler(req, res); });
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test('rewrite encaminha todos os caminhos de API à função antes do fallback SPA', () => {
  const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
  expect(config.rewrites[0]).toEqual({ source: '/api/:path*', destination: '/api' });
});

test('entrada serverless preserva pathname, método, query e erros JSON do dispatcher', async () => {
  for (const [path, status, code] of [
    ['/api/auth/sessao?origem=fixture', 401, 'NAO_AUTENTICADO'],
    ['/api/auth/login', 405, 'METODO_NAO_PERMITIDO'],
    ['/api/inexistente', 404, 'NAO_ENCONTRADO'],
  ] as const) {
    const response = await fetch(base + path);
    expect(response.status).toBe(status);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    expect(await response.json()).toMatchObject({ error: { code } });
    if (status === 405) expect(response.headers.get('allow')).toBe('POST');
  }
  const malformed = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toMatchObject({ error: { code: 'JSON_INVALIDO' } });
});
