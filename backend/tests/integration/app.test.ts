import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';

const server = createApp();
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('o servidor responde sem disponibilizar rotas de negócio', async () => {
  const response = await fetch(`${baseUrl}/api/usuarios`);
  expect(response.status).toBe(404);
  
  const body = await response.json();
  expect(body).toHaveProperty('error');
});