import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { createApp, isolarFalhaDaRequisicao } from '../../src/app.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { criarRotaManutencoes } from '../../src/modules/manutencoes/manutencoes.routes.js';
import { ErroHttp } from '../../src/shared/http/errors.js';
import { criarEscritaManutencao, consultarManutencao } from '../../src/modules/manutencoes/manutencoes.service.js';
import { cadastrarManutencao, editarManutencao, manutencaoId, transicaoManutencao } from '../../src/modules/manutencoes/manutencoes.schemas.js';

const app = createApp();
const ator = '-27002';
let db: Awaited<ReturnType<typeof verifiedSql>>;
let base: string;
let admin: string;
let gestor: string;
let svo: string;
const ids = new Set<string>();
const dto = {
  veiculoId: '-27003', tipo: 'CORRETIVA', descricao: 'Fixture S232 %_ revisão',
  entrada: '2026-12-10', conclusaoPrevista: '2026-12-10', quilometragem: 18, custo: '9007199254740993.1234567',
} as const;
const guarda = vi.fn<Parameters<typeof criarEscritaManutencao>[0]>().mockResolvedValue(undefined);
const escrita = criarEscritaManutencao(guarda);

async function cadastro(override: Partial<Parameters<typeof escrita.cadastrar>[0]> = {}) {
  const { data } = await escrita.cadastrar(cadastrarManutencao.parse({ ...dto, ...override }), ator);
  ids.add(data.id);
  return data;
}

beforeAll(async () => {
  db = await verifiedSql(true);
  [admin, gestor, svo] = await Promise.all(['-27001', ator, '-27005'].map(id => criarJwt({ id, perfil: 'ADM' })));
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (app.address() as AddressInfo).port;
});

afterAll(async () => {
  if (app.listening) await new Promise<void>(resolve => app.close(() => resolve()));
  if (!db) return;
  try {
    for (const id of ids) {
      await db`DELETE FROM public.manutencao_veiculo_historico WHERE manutencao_id=${id}`;
      await db`DELETE FROM public.manutencao_alerta_revisao WHERE manutencao_id=${id}`;
      await db`DELETE FROM public.manutencao_veiculo WHERE id=${id}`;
      await db`DELETE FROM public.log_atividade WHERE usuario_id IN (-27001,-27002)
        AND tipo_evento LIKE 'manutencao_%' AND strpos(descricao, ${'Manutenção ID ' + id + ' — '})=1`;
    }
    await db`DELETE FROM public.veiculo WHERE id=-23301010`;
  } finally { await db.end(); }
});

function http(path: string, { token = admin, method = 'GET', body, version }: {
  token?: string; method?: string; body?: unknown; version?: string;
} = {}) {
  return fetch(base + path, {
    method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      ...(version ? { 'If-Match': version } : {}) }, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('schemas', () => {
  test('valida BIGINT, dia civil, nulabilidade, decimal e intenção de início', () => {
    for (const id of ['-9223372036854775808', '9223372036854775807']) expect(manutencaoId.parse(id)).toBe(id);
    for (const id of ['-9223372036854775809', '9223372036854775808', 'abc', '']) expect(manutencaoId.safeParse(id).success).toBe(false);
    for (const input of [{ custo: 0 }, { custo: '-1' }, { custo: 'NaN' }, { custo: 'Infinity' },
      { entrada: '2026-02-29' }, { conclusaoPrevista: '2026-12-09' }, { criadoPorId: ator },
      { status: 'CANCELADA' }, { tipo: 'PREVENTIVA', iniciarImediatamente: true }]) {
      expect(cadastrarManutencao.safeParse({ ...dto, ...input }).success).toBe(false);
    }
    expect(editarManutencao.parse({ custo: null })).toEqual({ custo: null });
    expect(editarManutencao.parse({ custo: '0' })).toEqual({ custo: '0' });
    for (const input of [{}, { veiculoId: dto.veiculoId }, { atualizadoPorId: ator }]) {
      expect(editarManutencao.safeParse(input).success).toBe(false);
    }
    expect(transicaoManutencao.safeParse({ acao: 'REATIVAR', destino: 'CONCLUIDA' }).success).toBe(false);
    expect(transicaoManutencao.safeParse({ acao: 'INICIAR', alteracoes: { iniciadaEm: '2026-12-10T00:00:00Z' } }).success).toBe(false);
  });
});

describe('HTTP publicado localmente', () => {
  test('autorização precede leitura, validação de ID e corpo, e publica escrita protegida pela guarda transacional', async () => {
    const path = '/api/manutencoes';
    expect((await http(path + '/9223372036854775808', { token: '' })).status).toBe(401);
    expect((await http(path + '/9223372036854775808', { token: svo })).status).toBe(403);
    expect((await http(path + '/9223372036854775808')).status).toBe(400);
    expect((await http(path, { token: gestor })).status).toBe(200);
    expect((await http(path, { method: 'POST', body: { ...dto, criadoPorId: ator } })).status).toBe(400);
    await db`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status)
      VALUES (-23301010,'TST2331','CHEVROLET','S10 Teste',2026,'PASSEIO','EM_MANUTENCAO')`;
    const created = await http(path, { method: 'POST', body: { ...dto, veiculoId: '-23301010' } });
    expect(created.status).toBe(201);
    const { data: record } = await created.json();
    ids.add(record.id);
    expect(created.headers.get('location')).toBe(path + '/' + record.id);
    expect(created.headers.get('etag')).toBe(record.versao);
    expect((await http(path + '/-27003', { method: 'PATCH', body: { custo: '0' } })).status).toBe(400);
    const edited = await http(path + '/' + record.id, { method: 'PATCH', version: record.versao, body: { custo: '0' } });
    expect(edited.status).toBe(200);
    const { data } = await edited.json();
    expect((await http(path + '/' + record.id + '/status', {
      method: 'PATCH', version: record.versao, body: { acao: 'INICIAR' },
    })).status).toBe(409);
    expect((await http(path + '/' + record.id + '/status', {
      method: 'PATCH', version: data.versao, body: { acao: 'INICIAR' },
    })).status).toBe(200);
    expect((await consultarManutencao(record.id)).data).toMatchObject({ status: 'EM_ANDAMENTO', custo: '0' });
  });

  test('GET filtra período inclusivo e busca literal, preserva total e lê IDs negativos e histórico', async () => {
    const id = '-9007199254740993';
    await db`INSERT INTO public.manutencao_veiculo (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,
      quilometragem,custo,prestador,status,criado_por_id,atualizado_por_id) VALUES
      (${id},-27003,'PREVENTIVA','FiltroLiteral %_ SCRUM232','2026-12-10T03:00:00Z',
        '2026-12-10T03:00:00Z',0,0,'Oficina Simulada','AGENDADA',${ator},${ator})`;
    ids.add(id);
    const result = await http('/api/manutencoes/' + id, { token: gestor });
    expect(result.status).toBe(200);
    const { data } = await result.json();
    expect(data).toMatchObject({ id, custo: '0', entrada: '2026-12-10', conclusaoPrevista: '2026-12-10' });
    expect(data).not.toHaveProperty('criadoPorId');
    expect(result.headers.get('etag')).toBe(data.versao);
    const query = 'q=filtroliteral%20%25_&inicio=2026-12-10&fim=2026-12-10&status=AGENDADA&tipo=PREVENTIVA';
    const page = await http('/api/manutencoes?' + query);
    expect(await page.json()).toMatchObject({ data: [{ id }], meta: { page: 1, limit: 20, total: 1 } });
    const beyond = await http('/api/veiculos/-27003/manutencoes?' + query + '&page=2&limit=1');
    expect(await beyond.json()).toEqual({ data: [], meta: { page: 2, limit: 1, total: 1 } });
    for (const q of ['q=a&q=b','estranho=1','inicio=2026-12-11&fim=2026-12-10']) {
      expect((await http('/api/manutencoes?' + q)).status).toBe(400);
    }
    for (const path of ['/api/manutencoes/0', '/api/veiculos/0/manutencoes', '/api/manutencoes/0/historico']) {
      expect((await http(path)).status).toBe(404);
    }
    const cancelled = (await escrita.alterar(id, ator, data.versao, { transicao: { acao: 'CANCELAR' } })).data;
    const history = await http('/api/manutencoes/' + id + '/historico');
    expect(await history.json()).toMatchObject({
      data: [{ manutencaoId: id, evento: 'CANCELAMENTO', autorId: ator, anterior: { canceladaEm: null },
        posterior: { canceladaEm: cancelled.canceladaEm } }], meta: { total: 1 },
    });
  });
});

describe('serviço transacional com guarda exclusiva de teste', () => {
  test('cadastro normal e corretivo confirmam autoria, janela e decimal; edição distingue zero e NULL', async () => {
    const a = await cadastro();
    expect(a).toMatchObject({ custo: dto.custo, status: 'AGENDADA', iniciadaEm: null });
    expect(guarda.mock.lastCall?.[1]).toMatchObject({
      operacao: 'CADASTRAR', veiculo: { id: dto.veiculoId },
      janela: { inicio: '2026-12-10T03:00:00.000000Z', fim: '2026-12-11T03:00:00.000000Z' },
    });
    const b = await cadastro({ iniciarImediatamente: true, custo: null });
    expect(b).toMatchObject({ custo: null, status: 'EM_ANDAMENTO', iniciadaEm: expect.any(String) });
    await expect(escrita.alterar(b.id, ator, b.versao, { transicao: { acao: 'CANCELAR' } })).rejects.toMatchObject({ status: 409 });
    const c = (await escrita.alterar(b.id, '-27001', b.versao, { edicao: { custo: '0', entrada: '2026-12-09', tipo: 'PREVENTIVA' } })).data;
    expect(c).toMatchObject({ custo: '0', entrada: '2026-12-09', tipo: 'PREVENTIVA' });
    expect(guarda.mock.lastCall?.[1]).toMatchObject({ operacao: 'EDITAR', status: 'EM_ANDAMENTO' });
    const d = await escrita.alterar(c.id, ator, c.versao, { edicao: { custo: null } });
    expect(d.data.custo).toBeNull();
    const [row] = await db`SELECT criado_por_id::text AS autor FROM public.manutencao_veiculo WHERE id=${b.id}`;
    expect(row.autor).toBe(ator);
    const logs = await db`SELECT descricao,usuario_id::text FROM public.log_atividade WHERE tipo_evento='manutencao_editar'
      AND strpos(descricao, ${'Manutenção ID ' + b.id + ' — '})=1`;
    expect(logs).toContainEqual({ usuario_id: '-27001', descricao: expect.stringContaining('tipo=["CORRETIVA","PREVENTIVA"]') });
    await db`DELETE FROM public.log_atividade WHERE usuario_id='-27001' AND tipo_evento='manutencao_editar'
      AND strpos(descricao, ${'Manutenção ID ' + b.id + ' — '})=1`;
  });

  test('edição e transição atômicas preservam múltiplos ciclos e snapshots', async () => {
    let a = await cadastro({ custo: null });
    const action = async (transicao: Parameters<typeof transicaoManutencao.parse>[0]) => {
      a = (await escrita.alterar(a.id, ator, a.versao, { transicao: transicaoManutencao.parse(transicao) })).data;
    };
    await action({ acao: 'CANCELAR' });
    const cancelled = a.canceladaEm;
    a = (await escrita.alterar(a.id, ator, a.versao, { edicao: { tipo: 'PREVENTIVA' } })).data;
    await expect(escrita.alterar(a.id, ator, a.versao, { transicao: { acao: 'CONCLUIR' } })).rejects.toMatchObject({ status: 409 });
    await action({ acao: 'REATIVAR', destino: 'AGENDADA', alteracoes: { entrada: '2026-12-09', descricao: 'Fixture alterada' } });
    expect(a).toMatchObject({ entrada: '2026-12-09', descricao: 'Fixture alterada', canceladaEm: null, iniciadaEm: null });
    await action({ acao: 'CANCELAR' });
    await action({ acao: 'REATIVAR', destino: 'EM_ANDAMENTO' });
    await action({ acao: 'CONCLUIR' });
    a = (await escrita.alterar(a.id, ator, a.versao, { edicao: { concluidaEm: '2099-12-10T12:00:00.123456Z', custo: '0' } })).data;
    expect(a.concluidaEm).toBe('2099-12-10T12:00:00.123456Z');
    await action({ acao: 'REABRIR', destino: 'AGENDADA', alteracoes: { conclusaoPrevista: '2026-12-15' } });
    await action({ acao: 'INICIAR' });
    await action({ acao: 'CONCLUIR' });
    await action({ acao: 'REABRIR', destino: 'EM_ANDAMENTO' });
    const history = await http('/api/manutencoes/' + a.id + '/historico');
    const { data } = await history.json();
    expect(data.map((e: { evento: string }) => e.evento)).toEqual([
      'REABERTURA', 'CONCLUSAO', 'REABERTURA', 'CORRECAO_DATAS', 'CONCLUSAO', 'REATIVACAO', 'CANCELAMENTO', 'REATIVACAO', 'CANCELAMENTO',
    ]);
    expect(data.at(-2).anterior.canceladaEm).toBe(cancelled);
    expect(data[3].posterior.concluidaEm).toBe('2099-12-10T12:00:00.123456Z');
  });

  test('adaptador isolado retorna 201 após commit, Location, 409 e 500 sanitizado', async () => {
    let fail = false;
    const route = criarRotaManutencoes(async () => {
      if (fail) throw new Error('SQL INTERNO SENTINELA');
    });
    const isolated = createServer((req, res) => isolarFalhaDaRequisicao(res, route(req, res)));
    await new Promise<void>(resolve => isolated.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + (isolated.address() as AddressInfo).port;
    const call = (path: string, method: string, body: unknown, version?: string) => fetch(origin + path, {
      method, headers: { Authorization: 'Bearer ' + gestor, 'Content-Type': 'application/json',
        ...(version ? { 'If-Match': version } : {}) },
      body: JSON.stringify(body),
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const created = await call('/api/manutencoes', 'POST', dto);
      expect(created.status).toBe(201);
      const { data } = await created.json();
      ids.add(data.id);
      const path = '/api/manutencoes/' + data.id;
      expect(created.headers.get('location')).toBe(path);
      expect((await consultarManutencao(data.id)).data).toMatchObject({ id: data.id, versao: data.versao });
      expect((await call(path, 'PATCH', { custo: '0' }, data.versao)).status).toBe(200);
      const stale = await call(path, 'PATCH', { custo: null }, data.versao);
      expect(stale.status).toBe(409);
      expect(await stale.json()).toMatchObject({ error: { code: 'VERSAO_DESATUALIZADA' } });
      fail = true;
      const failure = await call('/api/manutencoes', 'POST', dto);
      expect(failure.status).toBe(500);
      expect(await failure.json()).toEqual({ error: { code: 'ERRO_INTERNO', message: 'Não foi possível concluir a requisição.' } });
    } finally {
      log.mockRestore();
      await new Promise<void>(resolve => isolated.close(() => resolve()));
    }
  });

  test('falha de auditoria, histórico ou guarda reverte alteração e transição', async () => {
    const a = await cadastro({ custo: null });
    const failure = new Error('sentinela privada');
    const fakeAudit = vi.fn().mockRejectedValue(failure);
    const fakeHistory = vi.fn().mockRejectedValue(failure);
    for (const service of [criarEscritaManutencao(guarda, fakeAudit), criarEscritaManutencao(guarda, undefined, fakeHistory)]) {
      await expect(service.alterar(a.id, ator, a.versao, {
        transicao: { acao: 'CANCELAR', alteracoes: { custo: '0' } },
      })).rejects.toBe(failure);
    }
    const denied = criarEscritaManutencao(async () => { throw new ErroHttp(409, 'CONFLITO_ALOCACAO', 'Conflito de teste.'); });
    await expect(denied.alterar(a.id, ator, a.versao, {
      transicao: { acao: 'INICIAR', alteracoes: { custo: '0' } },
    })).rejects.toMatchObject({ status: 409 });
    expect((await consultarManutencao(a.id)).data).toEqual(a);
    expect(await db`SELECT evento FROM public.manutencao_veiculo_historico WHERE manutencao_id=${a.id}`).toHaveLength(0);
  });

  test.each(['edições', 'transições', 'edição e transição'])('concorrência entre %s: apenas uma versão confirma', async shape => {
    const a = await cadastro();
    const edicao = { edicao: { descricao: 'Fixture corrida', conclusaoPrevista: '2026-12-11' } };
    const transicao = { transicao: { acao: 'INICIAR' as const } };
    const one = shape === 'transições' ? transicao : edicao;
    const two = shape === 'edições' ? { edicao: { custo: '0' } } : transicao;
    const results = await Promise.allSettled([
      escrita.alterar(a.id, ator, a.versao, one),
      escrita.alterar(a.id, ator, a.versao, two),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(r => r.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { status: 409, code: 'VERSAO_DESATUALIZADA' } });
    expect((await consultarManutencao(a.id)).data.versao).not.toBe(a.versao);
  });
});
