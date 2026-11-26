import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { svoConsultasSchemas } from '../../src/modules/svo/svo.consultas.schemas.js';

const sql = await verifiedSql();
const server = createApp();
const rota = '/api/svo/acompanhamento';
const ids = {
  adm: '7265001',
  gestor: '7265002',
  atendente: '7265003',
  motorista: '7265004',
  solicitante: '7265005',
  inativo: '7265006',
};
const tokens = new Map<string, string>();
let base = '';
let fixturesCriadas = false;

beforeAll(async () => {
  await sql.begin(async tx => {
    await tx`INSERT INTO public.usuario (id, nome, email, senha_hash, perfil, ativo) VALUES
      (${ids.adm}, 'ADM teste', 'adm-svo-265@example.invalid', 'sem-login', 'ADM', true),
      (${ids.gestor}, 'Gestor teste', 'gestor-svo-265@example.invalid', 'sem-login', 'GESTOR_FROTA', true),
      (${ids.atendente}, 'Atendente teste', 'atendente-svo-265@example.invalid', 'sem-login', 'ATENDENTE_SVO', true),
      (${ids.motorista}, 'Motorista teste', 'motorista-svo-265@example.invalid', 'sem-login', 'MOTORISTA', true),
      (${ids.solicitante}, 'Solicitante teste', 'solicitante-svo-265@example.invalid', 'sem-login', 'SOLICITANTE_INTERNO', true),
      (${ids.inativo}, 'ADM inativo', 'inativo-svo-265@example.invalid', 'sem-login', 'ADM', false)`;
    await tx`INSERT INTO public.solicitacao_obito
      (id, codigo, atendente_id, nome_falecido, local_falecimento, endereco_remocao, solicitante_nome,
       solicitante_telefone, observacoes_medicas, criado_em, status_triagem, triado_por_id, triado_em)
      VALUES
        (7265011, '#SVO-7265011', ${ids.atendente}, 'Nome fictício', 'Local fictício', 'Endereço fictício',
         'Solicitante fictício', '000000000', 'Dado clínico fictício', '2999-01-01 08:00',
         'CONFIRMADA_SVO', ${ids.atendente}, '2999-01-01 08:30'),
        (7265012, '#SVO-7265012', ${ids.atendente}, NULL, 'Local fictício', 'Endereço fictício',
         'Solicitante fictício', NULL, NULL, '2999-01-01 08:00', 'AGUARDANDO_TRIAGEM', NULL, NULL),
        (7265013, '#SVO-7265013', ${ids.atendente}, NULL, 'Local fictício', 'Endereço fictício',
         'Solicitante fictício', NULL, NULL, '2999-01-01 07:00', NULL, NULL, NULL)`;
    await tx`INSERT INTO public.ordem_coleta (id, solicitacao_obito_id, quantidade_corpos, status)
      VALUES (7265021, 7265011, 1, 'PENDENTE_ALOCACAO')`;
  });
  fixturesCriadas = true;
  for (const [perfil, id] of Object.entries(ids)) {
    tokens.set(perfil, await criarJwt({ id, perfil: 'ADM' }));
  }
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  try {
    if (fixturesCriadas) await sql.begin(async tx => {
      await tx`DELETE FROM public.ordem_coleta WHERE id = 7265021`;
      await tx`DELETE FROM public.solicitacao_obito WHERE id IN (7265011, 7265012, 7265013)`;
      await tx`DELETE FROM public.usuario WHERE id IN (7265001, 7265002, 7265003, 7265004, 7265005, 7265006)`;
    });
  } finally {
    await sql.end();
    await fecharBanco();
  }
});

function consultar(path: string, perfil?: keyof typeof ids, method = 'GET') {
  return fetch(base + path, {
    method,
    headers: perfil ? { Authorization: `Bearer ${tokens.get(perfil)}` } : {},
  });
}

test.each(['adm', 'gestor'] as const)('RF53 publica protocolo e estados paginados para %s', async perfil => {
  const [contagem] = await sql`SELECT count(*)::int AS total FROM public.solicitacao_obito`;
  const esperados = [
    { protocolo: '#SVO-7265012', statusTriagem: 'AGUARDANDO_TRIAGEM', statusOrdem: null },
    { protocolo: '#SVO-7265011', statusTriagem: 'CONFIRMADA_SVO', statusOrdem: 'PENDENTE_ALOCACAO' },
    { protocolo: '#SVO-7265013', statusTriagem: null, statusOrdem: null },
  ];
  for (const [index, esperado] of esperados.entries()) {
    const page = index + 1;
    const response = await consultar(`${rota}?page=${page}&limit=1`, perfil);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ data: [esperado], meta: { page, limit: 1, total: contagem.total } });
    expect(svoConsultasSchemas.ListaAcompanhamentoSvo.safeParse(body).success).toBe(true);
  }
  const fim = contagem.total + 1;
  const ultima = await consultar(`${rota}?page=${fim}&limit=1`, perfil);
  expect(ultima.status).toBe(200);
  expect(await ultima.json()).toEqual({ data: [], meta: { page: fim, limit: 1, total: contagem.total } });
});

test('protege a consulta e preserva o acesso operacional da SCRUM-145', async () => {
  expect((await consultar(rota)).status).toBe(401);
  expect((await consultar(rota, 'inativo')).status).toBe(401);
  for (const perfil of ['atendente', 'motorista', 'solicitante'] as const) {
    expect((await consultar(rota, perfil)).status).toBe(403);
  }
  for (const perfil of ['adm', 'gestor'] as const) {
    expect((await consultar('/api/svo/solicitacoes/paginadas', perfil)).status).toBe(403);
    expect((await consultar('/api/svo/solicitacoes/7265011', perfil)).status).toBe(403);
    expect((await consultar('/api/svo/solicitacoes/7265011/triagem', perfil, 'POST')).status).toBe(403);
    expect((await consultar('/api/svo/ordens-coleta/7265021/despachar', perfil, 'PATCH')).status).toBe(403);
  }
  expect((await consultar('/api/svo/solicitacoes/7265011', 'atendente')).status).toBe(200);
  const escrita = await consultar(rota, 'adm', 'POST');
  expect(escrita.status).toBe(405);
  expect(escrita.headers.get('allow')).toBe('GET');
});

test('rejeita paginação ambígua ou fora dos limites', async () => {
  for (const query of ['page=0', 'limit=101', 'page=1&page=2', 'status=CONFIRMADA_SVO', 'page=9007199254740991&limit=100']) {
    const response = await consultar(`${rota}?${query}`, 'gestor');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'DADOS_INVALIDOS' } });
  }
});
