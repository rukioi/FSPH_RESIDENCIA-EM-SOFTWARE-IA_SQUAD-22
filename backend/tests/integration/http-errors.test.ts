import './session-fixture.js';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { SignJWT } from 'jose';
vi.mock('../../src/config/db.js', () => ({ sql: vi.fn() }));
vi.mock('../../src/database/connection.js', () => ({ sql: vi.fn() }));
import { sql } from '../../src/config/db.js';
import { createApp } from '../../src/app.js';

const server = createApp();
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

test('falha real do handler responde 500 com log seguro correlacionado e próxima requisição saudável', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const bancoMock = sql as unknown as ReturnType<typeof vi.fn>;
  bancoMock.mockRejectedValueOnce(Object.assign(new Error('SENTINELA_PRIVADA'), { detail: 'SENTINELA_PRIVADA', code: '23500_SENTINELA_PRIVADA' }));
  try {
    const response = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'SENTINELA_PRIVADA' },
      body: JSON.stringify({ email: 'fiction@example.invalid', senha: 'SENTINELA_PRIVADA' }),
    });
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain('SENTINELA_PRIVADA');
    expect(log).toHaveBeenCalledWith(JSON.stringify({ event: 'request_failed', requestId: response.headers.get('x-request-id') }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('SENTINELA_PRIVADA');
    expect((await fetch(base + '/api/auth/sessao')).status).toBe(401);
  } finally { log.mockRestore(); }
});

test('métodos inválidos de todas as famílias retornam 405/Allow', async () => {
  for (const [path, allow] of [
    ['/api/auth/login', 'POST'], ['/api/auth/sessao', 'GET'],
    ['/api/admin/usuarios', 'GET, POST'], ['/api/admin/usuarios/1/', 'PUT'],
    ['/api/admin/usuarios/1/status/', 'PATCH'], ['/api/admin/auditoria/logs', 'GET'],
    ['/api/dashboard', 'GET'], ['/api/dashboard/pendencias', 'GET'],
    ['/api/dashboard/graficos', 'GET'], ['/api/dashboard/gestor', 'GET'],
    ['/api/svo/ordens-coleta', 'GET'], ['/api/svo/solicitacoes', 'POST'], ['/api/svo/ordens-coleta/1/despachar', 'PATCH'],
    ['/api/veiculos', 'GET, POST'], ['/api/veiculos/1', 'PUT, PATCH, DELETE'],
    ['/api/motoristas', 'GET, POST'], ['/api/motoristas/1', 'PUT, PATCH, DELETE'],
    ['/api/abastecimentos', 'GET, POST'], ['/api/documentos', 'GET, POST'], ['/api/documentos/pendencias', 'GET'],
  ]) {
    const response = await fetch(base + path + '?origem=teste', { method: 'OPTIONS' });
    expect(response.status, path).toBe(405);
    expect(response.headers.get('allow'), path).toBe(allow);
  }
});

test('usuários/abastecimentos rejeitam JSON inválido após autenticação e auditoria desconhecida encerra', async () => {
  const token = await new SignJWT({ perfil: 'ADM' }).setProtectedHeader({ alg: 'HS256' })
    .setSubject('-27001').setExpirationTime('1h').sign(new TextEncoder().encode(process.env.JWT_SECRET!));
  for (const path of ['/api/admin/usuarios', '/api/abastecimentos']) {
    const response = await fetch(base + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{',
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('JSON_INVALIDO');
  }
  expect((await fetch(base + '/api/admin/auditoria/desconhecida', { headers: { Authorization: `Bearer ${token}` } })).status).toBe(404);
});
