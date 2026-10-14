
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

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

async function criarToken(perfil: string): Promise<string> {
  return new SignJWT({ perfil })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('usuario-ficticio')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(segredo));
}

test('retorna 401 sem autenticação', async () => {
  const response = await fetch(`${baseUrl}/api/dashboard`);

  expect(response.status).toBe(401);
});

test('retorna 401 com token inválido', async () => {
  const response = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: 'Bearer token-invalido' },
  });

  expect(response.status).toBe(401);
});

test.each(['ADMINISTRADOR', 'GESTOR_FROTA'])(
  'retorna 200 para %s',
  async (perfil) => {
    const token = await criarToken(perfil);

    const response = await fetch(`${baseUrl}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: {} });
  }
);

test('retorna 403 para perfil não autorizado', async () => {
  const token = await criarToken('MOTORISTA');

  const response = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.status).toBe(403);
});
