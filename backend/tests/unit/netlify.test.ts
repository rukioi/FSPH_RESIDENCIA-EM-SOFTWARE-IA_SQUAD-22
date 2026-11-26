import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

vi.mock('../../src/database/connection.js', () => ({ sql: vi.fn() }));
import { sql } from '../../src/database/connection.js';
import server, { config } from '../../../frontend/netlify/server/index.js';

let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test('o Netlify Server entrega a API de autenticação sem consultar o banco em requisições inválidas', async () => {
  expect(config.path).toEqual(['/api', '/api/*']);

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  expect(login.status).toBe(400);
  expect(await login.json()).toMatchObject({ error: { code: 'ENTRADA_INVALIDA' } });

  const sessao = await fetch(`${base}/api/auth/sessao`);
  expect(sessao.status).toBe(401);
  expect(await sessao.json()).toMatchObject({ error: { code: 'NAO_AUTENTICADO' } });
  expect(sql).not.toHaveBeenCalled();
});
