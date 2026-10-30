import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import { createApp } from '../../src/app.js';

const server = createApp();
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test('dashboard restringe método e informa Allow', async () => {
  const response = await fetch(base + '/api/dashboard?origem=teste', { method: 'POST' });
  expect(response.status).toBe(405);
  expect(response.headers.get('allow')).toBe('GET');
});

test('caminhos desconhecidos de auditoria encerram em 404', async () => {
  const response = await fetch(base + '/api/admin/auditoria/inexistente');
  expect(response.status).toBe(404);
});

test('login classifica JSON malformado como 400', async () => {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  expect(response.status).toBe(400);
});

test('login recusa mídia incompatível com 415', async () => {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}',
  });
  expect(response.status).toBe(415);
});

test('login limita bytes antes do parsing e responde 413', async () => {
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'á'.repeat(33_000),
  });
  expect(response.status).toBe(413);
});

test('aborto após início da leitura do login não derruba o processo', async () => {
  const chegou = new Promise<http.IncomingMessage>(resolve => server.once('request', resolve));
  const client = http.request(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '1000' },
  });
  client.on('error', () => {});
  client.write('{');
  const incoming = await chegou;
  const abortou = new Promise<void>(resolve => incoming.once('aborted', resolve));
  client.destroy();
  await abortou;
  expect((await fetch(base + '/api/auth/sessao')).status).toBe(401);
});

test('login limita tentativas por transporte, ignora forwarded e preserva próxima requisição', async () => {
  let response: Response | undefined;
  for (let i = 0; i < 11; i++) {
    response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `192.0.2.${i}` }, body: '{}',
    });
  }
  expect(response?.status).toBe(429);
  expect(Number(response?.headers.get('retry-after'))).toBeGreaterThan(0);
  const next = await fetch(base + '/api/auth/sessao');
  expect(next.status).toBe(401);
  expect(next.headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/);
});
