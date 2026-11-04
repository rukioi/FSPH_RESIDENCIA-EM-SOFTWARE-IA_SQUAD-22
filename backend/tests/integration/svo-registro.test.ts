import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

const sql = await verifiedSql(); // Guardas de checkout e identidade: somente Postgres de teste isolado.
const server = createApp();
let base: string;
let tokenSvo: string;
let tokenAdmin: string;
const cadastradas: string[] = [];

const dados = {
  localFalecimento: 'Hospital de testes',
  enderecoRemocao: 'Rua de teste, 123',
  solicitanteNome: 'Pessoa fictícia',
  pontoReferencia: 'Em frente à praça',
  canalAtendimento: 'TELEFONE',
};

beforeAll(async () => {
  tokenSvo = await criarJwt({ id: '-27005', perfil: 'ATENDENTE_SVO' });
  tokenAdmin = await criarJwt({ id: '-27001', perfil: 'ADM' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  for (const id of cadastradas) {
    await sql`DELETE FROM public.log_atividade
      WHERE usuario_id = -27005 AND descricao = ${'Solicitação #SVO-' + id + ' registrada por telefone'}`;
    await sql`DELETE FROM public.solicitacao_obito WHERE id = ${id}`;
  }
  await sql.end();
});

function post(body: unknown, jwt = tokenSvo) {
  return fetch(base + '/api/svo/solicitacoes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function get(path: string, jwt = tokenSvo) {
  return fetch(base + path, { headers: { Authorization: `Bearer ${jwt}` } });
}

test('registro válido grava apenas ocorrência aguardando triagem e uma atividade', async () => {
  const response = await post(dados);
  expect(response.status).toBe(201);
  expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  const body = await response.json();
  expect(body).toMatchObject({
    solicitacao: { statusTriagem: 'AGUARDANDO_TRIAGEM' },
    atividades: [expect.stringContaining('registrada por telefone')],
  });
  expect(body).not.toHaveProperty('ordemColeta');
  expect(body.solicitacao.id).toMatch(/^[0-9]+$/);
  expect(body.solicitacao.codigo).toBe(`#SVO-${body.solicitacao.id}`);
  cadastradas.push(body.solicitacao.id);

  const [registro] = await sql`
    SELECT id::text AS id, codigo, atendente_id::text, status_triagem::text,
      canal_atendimento, ponto_referencia, criado_em
    FROM public.solicitacao_obito WHERE id = ${body.solicitacao.id}`;
  expect(registro).toMatchObject({
    id: body.solicitacao.id, atendente_id: '-27005',
    status_triagem: 'AGUARDANDO_TRIAGEM', canal_atendimento: 'TELEFONE',
    ponto_referencia: 'Em frente à praça',
  });
  const [ordens] = await sql`
    SELECT count(*)::int AS total FROM public.ordem_coleta
    WHERE solicitacao_obito_id = ${body.solicitacao.id}`;
  expect(ordens.total).toBe(0);
  const atividades = await sql`
    SELECT descricao FROM public.log_atividade
    WHERE usuario_id = -27005 AND descricao = ${body.atividades[0]}`;
  expect(atividades).toHaveLength(1);
});

test('GET inicial lê ocorrências reais por estado e não divulga dados pessoais', async () => {
  const response = await get('/api/svo/solicitacoes?status=AGUARDANDO_TRIAGEM');
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body)).toBe(true);
  const nossa = body.find((row: { id: string }) => cadastradas.includes(row.id));
  expect(nossa).toMatchObject({
    codigo: `#SVO-${cadastradas[0]}`,
    status_triagem: 'AGUARDANDO_TRIAGEM',
  });
  expect(Object.keys(nossa).sort()).toEqual(['codigo', 'criado_em', 'id', 'status_triagem']);
  expect(JSON.stringify(nossa)).not.toContain('Pessoa fictícia');
});

test('GET recusa filtros desconhecidos, repetidos e status inválido', async () => {
  for (const query of ['status=INEXISTENTE', 'status=AGUARDANDO_TRIAGEM&status=AGUARDANDO_TRIAGEM', 'limit=999']) {
    expect((await get('/api/svo/solicitacoes?' + query)).status).toBe(400);
  }
});

test('cadastro recusa campos indevidos, ausentes e informação de canal inconsistente', async () => {
  for (const body of [
    { ...dados, atendenteId: '-27001' },
    { ...dados, cpf: '00000000000' },
    { ...dados, canalAtendimento: 'WEB' },
    { ...dados, solicitanteNome: '  ' },
    { ...dados, localFalecimento: 'x'.repeat(256) },
    { ...dados, solicitanteTelefone: 'inválido' },
    {},
  ]) {
    const response = await post(body);
    expect(response.status).toBe(400);
  }
});

test('sem sessão retorna 401; perfil ADM retorna 403 para GET e POST', async () => {
  expect((await fetch(base + '/api/svo/solicitacoes')).status).toBe(401);
  expect((await fetch(base + '/api/svo/solicitacoes', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados),
  })).status).toBe(401);
  expect((await get('/api/svo/solicitacoes', tokenAdmin)).status).toBe(403);
  expect((await post(dados, tokenAdmin)).status).toBe(403);
});
