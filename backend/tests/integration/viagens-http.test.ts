import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { viagensSchemas } from '../../src/modules/viagens/viagens.schemas.js';

const sql = await verifiedSql();
const server = createApp();
let base = '', motorista = '', gestor = '';
beforeAll(async () => {
  motorista = await criarJwt({ id: '-27004', perfil: 'MOTORISTA' });
  gestor = await criarJwt({ id: '-27002', perfil: 'GESTOR_FROTA' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/viagens/minhas`;
});
afterAll(async () => {
  if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  await sql.end();
  await fecharBanco();
});
function requisitar(sufixo = '', token?: string) {
  return fetch(base + sufixo, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
test('HTTP aplica 401, 403 e validação de filtros', async () => {
  expect((await requisitar()).status).toBe(401);
  expect((await requisitar('', gestor)).status).toBe(403);
  expect((await requisitar('?limit=101', motorista)).status).toBe(400);
  expect((await requisitar('?page=1&page=2', motorista)).status).toBe(400);
});
test('HTTP retorna somente viagens institucionais do motorista da sessão', async () => {
  const resposta = await requisitar('?limit=100', motorista);
  expect(resposta.status).toBe(200);
  const dados = viagensSchemas.ListaMinhasViagens.parse(await resposta.json());
  const reais = await sql`SELECT v.id::text FROM public.viagem v JOIN public.motorista m ON m.id=v.motorista_id
    JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE m.usuario_id=-27004 ORDER BY v.id DESC`;
  expect(dados.data.map(item => item.id)).toEqual(reais.map(item => item.id));
  expect(dados.data.some(item => item.id === '-27001')).toBe(true);
  expect(dados.data.some(item => item.id === '-27002')).toBe(false);
  const filtradas = viagensSchemas.ListaMinhasViagens.parse(await (await requisitar('?status=CONCLUIDA', motorista)).json());
  expect(filtradas.data.every(item => item.status === 'CONCLUIDA')).toBe(true);
  expect(dados.meta.total).toBe(reais.length);
});
