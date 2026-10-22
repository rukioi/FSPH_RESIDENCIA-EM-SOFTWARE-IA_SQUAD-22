import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import type { AddressInfo } from 'node:net';

vi.mock('../../src/database/connection.js', () => ({ sql: vi.fn() }));

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

test('GET de viagens sem token retorna 401', async () => {
  const response = await fetch(`${baseUrl}/api/motorista/viagens`);

  expect(response.status).toBe(401);

  const resultado = await response.json();
  expect(resultado.error.code).toBe('NAO_AUTENTICADO');
});
test('GET de viagens com perfil SOLICITANTE retorna 403', async () => {
  const { SignJWT } = await import('jose');

  const segredoAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'segredo-ficticio-exclusivo-para-testes';

  try {
    const token = await new SignJWT({ perfil: 'SOLICITANTE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const response = await fetch(`${baseUrl}/api/motorista/viagens`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(403);

    const resultado = await response.json();
    expect(resultado.error.code).toBe('ACESSO_NEGADO');
  } finally {
    if (segredoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = segredoAnterior;
    }
  }
});
test('GET de viagens com perfil MOTORISTA chega à funcionalidade', async () => {
  const { SignJWT } = await import('jose');

  const segredoAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'segredo-ficticio-exclusivo-para-testes';

  try {
    const token = await new SignJWT({ perfil: 'MOTORISTA' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const response = await fetch(`${baseUrl}/api/motorista/viagens`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(501);

    const resultado = await response.json();
    expect(resultado.error.code).toBe('NAO_IMPLEMENTADO');
  } finally {
    if (segredoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = segredoAnterior;
    }
  }
});