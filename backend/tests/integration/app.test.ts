import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';

const server = createApp();
const segredoAnterior = process.env.JWT_SECRET;
const segredoTeste = 'segredo-de-integracao-com-mais-de-32-bytes';
let baseUrl: string;

beforeAll(async () => {
  process.env.JWT_SECRET = segredoTeste;
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  if (segredoAnterior === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = segredoAnterior;
  }
});

async function criarTokenSessao(perfil: string): Promise<string> {
  return new SignJWT({
    email: 'usuario@example.test',
    nome: 'Usuário de teste',
    perfil,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('42')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(segredoTeste));
}

test('o servidor responde sem disponibilizar rotas de negócio', async () => {
  const response = await fetch(`${baseUrl}/api/usuarios`);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: {
      code: 'NAO_ENCONTRADO',
      message: 'Rota não encontrada.',
    },
  });
});

test('sessão sem token retorna erro 401 padronizado', async () => {
  const response = await fetch(`${baseUrl}/api/auth/sessao`);

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({
    error: {
      code: 'NAO_AUTENTICADO',
      message: 'Autenticação necessária.',
    },
  });
});

test('sessão válida retorna a identidade assinada', async () => {
  const token = await criarTokenSessao('GESTOR_FROTA');
  const response = await fetch(`${baseUrl}/api/auth/sessao`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: {
      id: '42',
      email: 'usuario@example.test',
      nome: 'Usuário de teste',
      perfil: 'GESTOR_FROTA',
    },
  });
});

test('abastecimentos exige autenticação antes de acessar o banco', async () => {
  const response = await fetch(`${baseUrl}/api/abastecimentos`);

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({
    error: {
      code: 'NAO_AUTENTICADO',
      message: 'Autenticação necessária.',
    },
  });
});

test('abastecimentos nega perfil autenticado sem permissão', async () => {
  const token = await criarTokenSessao('ATENDENTE_SVO');
  const response = await fetch(`${baseUrl}/api/abastecimentos`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: {
      code: 'ACESSO_NEGADO',
      message: 'Acesso não permitido.',
    },
  });
});
