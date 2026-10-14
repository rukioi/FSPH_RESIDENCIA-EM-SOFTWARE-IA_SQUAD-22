import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { createApp } from '../../src/app.js';

const db = new PGlite();
const segredo = 'segredo-ficticio-kpis';
const segredoAnterior = process.env.JWT_SECRET;
let agora = new Date('2026-10-14T15:00:00Z');
let falhar = false;
let consultas = 0;
const server = createApp({
  database: {
    async query(sql, values) {
      consultas++;
      if (falhar) throw new Error('Detalhes privados do banco');
      return db.query<Record<string, unknown>>(sql, values);
    },
  },
  now: () => agora,
});
let baseUrl: string;

beforeAll(async () => {
  process.env.JWT_SECRET = segredo;
  await db.exec(await readFile(new URL('../../src/database/migrations/001_dashboard_kpis.sql', import.meta.url), 'utf8'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor não iniciou.');
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 30000);

beforeEach(async () => {
  await db.exec('TRUNCATE chamados, viagens, veiculos, motoristas RESTART IDENTITY');
  agora = new Date('2026-10-14T15:00:00Z');
  falhar = false;
  consultas = 0;
});

afterAll(async () => {
  if (segredoAnterior === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = segredoAnterior;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await db.close();
});

async function token(perfil = 'ADMINISTRADOR', expiracao = '1h') {
  return new SignJWT({ perfil }).setProtectedHeader({ alg: 'HS256' })
    .setSubject('usuario-ficticio').setExpirationTime(expiracao)
    .sign(new TextEncoder().encode(segredo));
}

async function consultar(query = '?periodo=hoje', perfil = 'ADMINISTRADOR') {
  return fetch(`${baseUrl}/api/dashboard/kpis${query}`, {
    headers: { Authorization: `Bearer ${await token(perfil)}` },
  });
}

test.each([undefined, 'Bearer invalido'])('retorna 401 sem token válido (%s) sem consultar o banco', async (authorization) => {
  const response = await fetch(`${baseUrl}/api/dashboard/kpis?periodo=hoje`, {
    headers: authorization ? { Authorization: authorization } : {},
  });
  expect(response.status).toBe(401);
  expect(consultas).toBe(0);
});

test('retorna 401 para token expirado', async () => {
  const response = await fetch(`${baseUrl}/api/dashboard/kpis`, {
    headers: { Authorization: `Bearer ${await token('ADMINISTRADOR', '0s')}` },
  });
  expect(response.status).toBe(401);
  expect(consultas).toBe(0);
});

test('retorna 403 para motorista antes de acessar o banco', async () => {
  expect((await consultar('?periodo=hoje', 'MOTORISTA')).status).toBe(403);
  expect(consultas).toBe(0);
});

test.each(['ADMINISTRADOR', 'GESTOR_FROTA'])('retorna contadores numéricos zerados para %s', async (perfil) => {
  const response = await consultar('', perfil);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toEqual({ data: {
    chamadosPendentes: 0, viagensHoje: 0, veiculosDisponiveis: 0, motoristasDisponiveis: 0,
  } });
});

test.each(['?periodo=', '?periodo=ontem', '?periodo=7', '?periodo=HOJE',
  '?periodo=hoje&periodo=7dias', '?periodo=hoje&extra=1', '?periodo=%27%3BSELECT%201']) (
  'retorna 400 para entrada inválida %s sem consultar o banco', async (query) => {
    const response = await consultar(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'ENTRADA_INVALIDA' } });
    expect(consultas).toBe(0);
  },
);

test.each([['hoje', 2], ['7dias', 4], ['30dias', 6]])(
  'confere contagens reais e limites inclusivos/exclusivos para %s', async (periodo, pendentes) => {
    await db.exec(`
      INSERT INTO chamados (status, criado_em) VALUES
        ('PENDENTE', '2026-10-14T03:00:00Z'),
        ('PENDENTE', '2026-10-15T02:59:59.999Z'),
        ('PENDENTE', '2026-10-08T03:00:00Z'),
        ('PENDENTE', '2026-10-14T02:59:59.999Z'),
        ('PENDENTE', '2026-09-15T03:00:00Z'),
        ('PENDENTE', '2026-10-08T02:59:59.999Z'),
        ('PENDENTE', '2026-09-15T02:59:59.999Z'),
        ('PENDENTE', '2026-10-15T03:00:00Z'),
        ('CONCLUIDO', '2026-10-14T12:00:00Z');
      INSERT INTO viagens (agendada_em) VALUES
        ('2026-10-14T03:00:00Z'), ('2026-10-15T02:59:59.999Z'),
        ('2026-10-14T02:59:59.999Z'), ('2026-10-15T03:00:00Z');
      INSERT INTO veiculos (status) VALUES ('DISPONIVEL'), ('DISPONIVEL'), ('EM_MANUTENCAO');
      INSERT INTO motoristas (status) VALUES ('DISPONIVEL'), ('OCUPADO');
    `);
    const response = await consultar(`?periodo=${periodo}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: {
      chamadosPendentes: pendentes, viagensHoje: 2, veiculosDisponiveis: 2, motoristasDisponiveis: 1,
    } });
    expect(consultas).toBe(1);
  },
);

test('considera o dia anterior em São Paulo antes das 03:00 UTC, inclusive na virada do ano', async () => {
  agora = new Date('2027-01-01T02:59:59Z');
  await db.exec(`
    INSERT INTO chamados (status, criado_em) VALUES
      ('PENDENTE', '2026-12-31T03:00:00Z'), ('PENDENTE', '2027-01-01T03:00:00Z');
    INSERT INTO viagens (agendada_em) VALUES
      ('2026-12-31T03:00:00Z'), ('2027-01-01T03:00:00Z');
  `);
  const response = await consultar();
  expect(await response.json()).toEqual({ data: {
    chamadosPendentes: 1, viagensHoje: 1, veiculosDisponiveis: 0, motoristasDisponiveis: 0,
  } });
});

test('reflete alterações do banco entre consultas', async () => {
  await db.exec("INSERT INTO veiculos (status) VALUES ('DISPONIVEL')");
  expect(await (await consultar()).json()).toMatchObject({ data: { veiculosDisponiveis: 1 } });
  await db.exec("UPDATE veiculos SET status = 'EM_MANUTENCAO'");
  expect(await (await consultar()).json()).toMatchObject({ data: { veiculosDisponiveis: 0 } });
});

test('retorna 500 acionável sem expor detalhes internos quando o banco falha', async () => {
  falhar = true;
  const response = await consultar();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: {
    code: 'ERRO_INTERNO', message: 'Não foi possível consultar os indicadores. Tente novamente.',
  } });
});
