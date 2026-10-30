import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let token: string;
beforeAll(async () => {
  await sql`insert into public.usuario (id,nome,email,senha_hash,perfil,ativo) values
    (31001,'Fixture T31 ADM','t31-adm@example.invalid','sem-login','ADM',true),
    (31002,'Fixture T31 Gestor','t31-gestor@example.invalid','sem-login','GESTOR_FROTA',true)`;
  await sql`insert into public.log_atividade (id,usuario_id,descricao,data_hora) values
    (310001,31001,'Fixture T31 primeiro','2099-01-01'),
    (310002,31001,'Fixture T31 segundo','2099-01-01'),
    (310003,null,'Fixture T31 sem usuário',null)`;
  // Exercita mais de uma página mesmo em uma instância recém-provisionada.
  await sql`insert into public.log_atividade (id,usuario_id,descricao,data_hora)
    select 311000+n,31002,'Fixture T31 paginação','1999-01-01'::timestamp
    from generate_series(1,101) as n`;
  token = await criarJwt({ id: '31001', perfil: 'ADM' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await sql`delete from public.log_atividade where usuario_id in (31001,31002) or id=310003`;
  await sql`delete from public.usuario where id in (31001,31002) or email='t31-sensitive@example.invalid'`;
  await sql.end();
});
function call(query = '', auth: string | null = token, method = 'GET') {
  return fetch(base + '/api/admin/auditoria/logs' + query, {
    method, headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });
}

test('consulta exige sessão ativa e perfil ADM atual', async () => {
  expect((await call('', null)).status).toBe(401);
  expect((await call('', await criarJwt({ id: '31002', perfil: 'ADM' }))).status).toBe(403);
  await sql`update public.usuario set ativo=false where id=31002`;
  expect((await call('', await criarJwt({ id: '31002', perfil: 'GESTOR_FROTA' }))).status).toBe(401);
});

test('paginação ordena empates por id, põe hora nula no fim e projeta DTO mínimo', async () => {
  const first = await call('?page=1&limit=1');
  expect(first.status).toBe(200);
  const body = await first.json();
  expect(body.meta).toMatchObject({ page: 1, limit: 1 });
  expect(body.meta.total).toBeGreaterThanOrEqual(3);
  expect(body.data).toHaveLength(1);
  expect(body.data[0]).toEqual({ id: '310002', usuarioId: '31001', descricao: 'Fixture T31 segundo',
    dataHora: expect.any(String), usuarioNome: 'Fixture T31 ADM' });
  const second = await (await call('?page=2&limit=1')).json();
  expect(second.data[0].id).toBe('310001');
  expect((await (await call('?page=999999&limit=100')).json()).data).toEqual([]);
  const all = await (await call('?limit=100')).json();
  const lastPage = Math.ceil(all.meta.total / 100);
  expect(lastPage).toBeGreaterThan(1);
  const last = await (await call(`?page=${lastPage}&limit=100`)).json();
  expect(last.data.at(-1)).toEqual({ id: '310003', usuarioId: null, descricao: 'Fixture T31 sem usuário',
    dataHora: null, usuarioNome: null });
});

test('valida paginação sem coerção e encerra método/caminho desconhecido', async () => {
  for (const query of ['?page=0','?limit=101','?limit=1.5','?page=abc','?page=1&page=2',
    '?page=9007199254740992','?page=9007199254740991&limit=100','?limit=']) {
    const response = await call(query);
    expect(response.status, query).toBe(400);
    expect((await response.json()).error.code).toBe('ENTRADA_INVALIDA');
  }
  const method = await call('', token, 'POST');
  expect(method.status).toBe(405);
  expect(method.headers.get('Allow')).toBe('GET');
  expect((await call('/ausente')).status).toBe(404);
});

test('adaptador sem paginação preserva array e campos explícitos legados', async () => {
  const body = await (await call()).json();
  expect(Array.isArray(body)).toBe(true);
  expect(body.find((row: { id: string }) => row.id === '310002')).toEqual({
    id: '310002', usuario_id: '31001', descricao: 'Fixture T31 segundo',
    data_hora: expect.any(String), usuario_nome: 'Fixture T31 ADM', usuario_email: 't31-adm@example.invalid',
  });
});

test('cadastro registra identificador sem copiar email ou payload para atividade', async () => {
  const response = await fetch(base + '/api/admin/usuarios', { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Fixture T31 sensível', email: 't31-sensitive@example.invalid',
      perfil: 'MOTORISTA', senha: 'T31-senha-sentinela!' }),
  });
  expect(response.status).toBe(201);
  const user = await response.json();
  const logs = await sql`select descricao from public.log_atividade where usuario_id=31001 and id not in (310001,310002) order by id desc`;
  expect(logs[0].descricao).toBe(`Criou o usuário ID ${user.id}`);
  expect(JSON.stringify(logs)).not.toMatch(/t31-sensitive|senha-sentinela|sensível/);
});

test('erro de consulta não revela SQL, dados ou sentinelas no HTTP/logger', async () => {
  const repository = await import('../../src/modules/auditoria/auditoria.repository.js');
  const spy = vi.spyOn(repository, 'consultarAtividades').mockRejectedValueOnce(Object.assign(
    new Error('SELECT senha_hash CPF-SENTINELA TOKEN-SENTINELA'), { detail: 'MEDICO-SENTINELA' }));
  const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const response = await call('?page=1');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: 'ERRO_INTERNO', message: 'Não foi possível concluir a requisição.' } });
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(/SELECT|senha_hash|SENTINELA/);
  } finally { spy.mockRestore(); logger.mockRestore(); }
  expect((await call('?page=1')).status).toBe(200);
});
