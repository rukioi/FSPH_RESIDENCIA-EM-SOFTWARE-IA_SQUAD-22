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

test('POST de solicitação sem token retorna 401', async () => {
  const response = await fetch(`${baseUrl}/api/solicitante/solicitacoes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      motivo: 'Transporte institucional de teste',
      origem: 'Unidade A',
      destino: 'Unidade B',
    }),
  });

  expect(response.status).toBe(401);
});


test('POST com perfil MOTORISTA retorna 403', async () => {
  const { SignJWT } = await import('jose');
  const segredo = 'segredo-ficticio-exclusivo-para-testes';
  const segredoAnterior = process.env.JWT_SECRET;

  process.env.JWT_SECRET = segredo;

  try {
    const token = await new SignJWT({ perfil: 'MOTORISTA' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(segredo));

    const response = await fetch(`${baseUrl}/api/solicitante/solicitacoes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motivo: 'Transporte de teste',
        origem: 'Unidade A',
        destino: 'Unidade B',
      }),
    });

    expect(response.status).toBe(403);
  } finally {
    if (segredoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = segredoAnterior;
    }
  }
});

test('POST com campos vazios retorna 400', async () => {
  const { SignJWT } = await import('jose');
  const segredo = 'segredo-ficticio-exclusivo-para-testes';
  const segredoAnterior = process.env.JWT_SECRET;

  process.env.JWT_SECRET = segredo;

  try {
    const token = await new SignJWT({ perfil: 'SOLICITANTE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(segredo));

    const response = await fetch(`${baseUrl}/api/solicitante/solicitacoes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motivo: '',
        origem: '',
        destino: '',
      }),
    });

    expect(response.status).toBe(400);
  } finally {
    if (segredoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = segredoAnterior;
    }
  }
});
test('POST com JSON inválido retorna 400', async () => {
  const { SignJWT } = await import('jose');
  const segredo = 'segredo-ficticio-exclusivo-para-testes';
  const segredoAnterior = process.env.JWT_SECRET;

  process.env.JWT_SECRET = segredo;

  try {
    const token = await new SignJWT({ perfil: 'SOLICITANTE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(segredo));

    const response = await fetch(`${baseUrl}/api/solicitante/solicitacoes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{"motivo":',
    });

    expect(response.status).toBe(400);

    const resultado = await response.json();
    expect(resultado.error.code).toBe('JSON_INVALIDO');
  } finally {
    if (segredoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = segredoAnterior;
    }
  }
});
test('POST com corpo acima de 64 KiB retorna 413', async () => {
  const { SignJWT } = await import('jose');
  const segredo = 'segredo-ficticio-exclusivo-para-testes';
  const segredoAnterior = process.env.JWT_SECRET;

  process.env.JWT_SECRET = segredo;

  try {
    const token = await new SignJWT({ perfil: 'SOLICITANTE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(segredo));

    const response = await fetch(`${baseUrl}/api/solicitante/solicitacoes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        motivo: 'A'.repeat(70_000),
        origem: 'Unidade A',
        destino: 'Unidade B',
      }),
    });

    expect(response.status).toBe(413);

    const resultado = await response.json();
    expect(resultado.error.code).toBe('CORPO_MUITO_GRANDE');
  } finally {
    if (segredoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = segredoAnterior;
    }
  }
});
test('GET de solicitações sem token retorna 401', async () => {
  const response = await fetch(
    `${baseUrl}/api/solicitante/solicitacoes`,
    { method: 'GET' },
  );

  expect(response.status).toBe(401);

  const resultado = await response.json();
  expect(resultado.error.code).toBe('NAO_AUTENTICADO');
});
test('GET com perfil MOTORISTA retorna 403', async () => {
  const { SignJWT } = await import('jose');
  const segredo = 'segredo-ficticio-exclusivo-para-testes';
  const segredoAnterior = process.env.JWT_SECRET;

  process.env.JWT_SECRET = segredo;

  try {
    const token = await new SignJWT({ perfil: 'MOTORISTA' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(segredo));

    const response = await fetch(
      `${baseUrl}/api/solicitante/solicitacoes`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

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
test('GET com SOLICITANTE retorna 501 enquanto a consulta não existe', async () => {
  const { SignJWT } = await import('jose');
  const segredo = 'segredo-ficticio-exclusivo-para-testes';
  const segredoAnterior = process.env.JWT_SECRET;

  process.env.JWT_SECRET = segredo;

  try {
    const token = await new SignJWT({ perfil: 'SOLICITANTE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('101')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(segredo));

    const response = await fetch(
      `${baseUrl}/api/solicitante/solicitacoes`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

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