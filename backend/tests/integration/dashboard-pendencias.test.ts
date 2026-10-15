import { afterAll, beforeAll, expect, test } from 'vitest';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';

const server = createApp();
const segredo = 'segredo-ficticio-exclusivo-para-testes';
const segredoAnterior = process.env.JWT_SECRET;
let baseUrl: string;

beforeAll(async () => {
  process.env.JWT_SECRET = segredo;

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Servidor não iniciou corretamente.');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (segredoAnterior === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = segredoAnterior;
  }

  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function criarToken(perfil: string) {
  return new SignJWT({ perfil })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('usuario-teste')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(segredo));
}

test('BE-05 retorna 401 sem autenticação', async () => {
  const resposta = await fetch(`${baseUrl}/api/dashboard/pendencias`);
  expect(resposta.status).toBe(401);
});

test('BE-05 retorna 403 para motorista', async () => {
  const token = await criarToken('MOTORISTA');

  const resposta = await fetch(`${baseUrl}/api/dashboard/pendencias`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(resposta.status).toBe(403);
});
