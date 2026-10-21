
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';

const server = createApp();
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('POST de solicitação sem token retorna 401', async () => {
  const response = await fetch(`${baseUrl}/api/svo/solicitacoes`, {
    method: 'POST',
  });

  expect(response.status).toBe(401);
});

test('GET de ordens sem token retorna 401', async () => {
  const response = await fetch(
    `${baseUrl}/api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO`
  );

  expect(response.status).toBe(401);
});

test('PATCH de despacho sem token retorna 401', async () => {
  const response = await fetch(
    `${baseUrl}/api/svo/ordens-coleta/1/despachar`,
    { method: 'PATCH' }
  );

  expect(response.status).toBe(401);
});
