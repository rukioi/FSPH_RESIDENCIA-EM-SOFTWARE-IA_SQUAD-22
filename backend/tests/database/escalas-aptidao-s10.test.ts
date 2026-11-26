import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { canonical, metadataQuery, type Metadata } from '../../src/database/scripts/generate-db-docs.js';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';

type Tx = postgres.TransactionSql;
type Linha = Record<string, string | number | boolean | null>;
let sql: Awaited<ReturnType<typeof verifiedSql>>;
let admin: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { sql = await verifiedSql(); admin = await verifiedSql(true); });
afterAll(async () => { await sql?.end(); await admin?.end(); });
const rollback = new Error('Rollback deliberado da fixture SCRUM-219');
const tabelas = ['escala_motorista', 'indisponibilidade_motorista', 'habilitacao_categoria_veiculo',
  'motorista_transicao_profissional'];
const versao = '20261124000000_db_s10_03_escalas_aptidao_motoristas.sql';
const forward = readFileSync(resolve(root, 'backend/src/database/supabase/migrations', versao), 'utf8');
const backward = readFileSync(resolve(root, 'backend/src/database/supabase/rollbacks', versao), 'utf8');

async function ensaio(fn: (tx: Tx) => Promise<unknown>, conexao = sql) {
  return conexao.begin(async tx => { await fn(tx); throw rollback; }).catch((e: unknown) => e);
}
function escala(tx: Tx, sobrescrita: Linha = {}) {
  return tx`INSERT INTO public.escala_motorista ${tx({ id: -921901, motorista_id: -27001,
    inicio: '2026-12-01T07:00:00-03:00', fim: '2026-12-01T19:00:00-03:00', situacao: 'EM_ESCALA',
    autor_id: -27002, ...sobrescrita })} RETURNING *`;
}
function ausencia(tx: Tx, sobrescrita: Linha = {}) {
  return tx`INSERT INTO public.indisponibilidade_motorista ${tx({ id: -921902, motorista_id: -27001,
    tipo: 'AFASTADO', inicio: '2026-12-10T00:00:00-03:00', fim: '2026-12-20T00:00:00-03:00',
    autor_id: -27002, ...sobrescrita })} RETURNING *`;
}
function matriz(tx: Tx, sobrescrita: Linha = {}) {
  return tx`INSERT INTO public.habilitacao_categoria_veiculo ${tx({ id: -921903, categoria_cnh: 'D',
    classe_veicular: 'Classe fictícia de teste', permitido: true, fonte_normativa: 'Fonte fictícia de teste',
    vigencia_inicio: '2027-01-01', autor_id: -27001, ...sobrescrita })}`;
}
function transicao(tx: Tx, sobrescrita: Linha = {}) {
  return tx`INSERT INTO public.motorista_transicao_profissional ${tx({ id: -921904, motorista_id: -27001,
    versao: 1, versao_anterior: null, acao: 'INATIVACAO', motivo: 'Motivo administrativo fictício',
    autor_id: -27002, ...sobrescrita })}`;
}
const cancelamento = { estado: 'CANCELADA', cancelado_por_id: -27001,
  cancelado_em: '2030-01-01T00:00:00Z', motivo_cancelamento: 'Lançamento duplicado' };
async function metadados(tx: Tx) {
  const [row] = await tx.unsafe(metadataQuery);
  return canonical(row.metadata as Metadata);
}

test('migration não depende de extensão fora de public (backup SCRUM-204)', () => {
  expect(forward).not.toMatch(/CREATE\s+EXTENSION|btree_gist|CREATE\s+SCHEMA/i);
});

test('tabelas novas têm RLS sem policy/trigger, sem acesso Data API e sem linhas inferidas', async () => {
  const [row] = await sql.unsafe(metadataQuery);
  const metadata = canonical(row.metadata as Metadata);
  for (const nome of tabelas) expect(metadata.tables.find(t => t.name === nome)).toMatchObject({ rls: true });
  expect(metadata.policies).toEqual([]);
  expect(metadata.triggers).toEqual([]);
  expect(metadata.enums.find(e => e.name === 'status_motorista')?.values).toEqual(['DISPONIVEL', 'EM_VIAGEM', 'FOLGA', 'AFASTADO']);
  for (const nome of tabelas) {
    const [permissoes] = await sql`SELECT
      has_table_privilege('anon', ${'public.' + nome}, 'SELECT,INSERT,UPDATE,DELETE') AS anon,
      has_table_privilege('authenticated', ${'public.' + nome}, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated,
      has_table_privilege(current_user, ${'public.' + nome}, 'SELECT') AS leitura,
      has_table_privilege(current_user, ${'public.' + nome}, 'INSERT') AS inclusao,
      has_table_privilege(current_user, ${'public.' + nome}, 'UPDATE,DELETE,TRUNCATE') AS alteracao`;
    expect(permissoes).toEqual({ anon: false, authenticated: false, leitura: true, inclusao: true, alteracao: false });
    expect(await sql`SELECT id FROM ${sql('public.' + nome)}`).toEqual([]);
  }
});

test('escala explícita preserva intervalo [inicio,fim), autor e instante; cadastro e conta não mudam', async () => {
  expect(await ensaio(async tx => {
    const [antes] = await tx`SELECT m.status, u.ativo FROM public.motorista m JOIN public.usuario u ON u.id=m.usuario_id WHERE m.id=-27001`;
    const [linha] = await escala(tx);
    expect(linha).toMatchObject({ estado: 'VIGENTE', autor_id: '-27002', cancelado_por_id: null });
    expect(linha.criado_em).toBeInstanceOf(Date);
    // Fim é exclusivo: período seguinte pode começar no mesmo instante.
    await escala(tx, { id: -921905, inicio: '2026-12-01T19:00:00-03:00', fim: '2026-12-02T07:00:00-03:00', situacao: 'FORA_DE_ESCALA' });
    const [depois] = await tx`SELECT m.status, u.ativo FROM public.motorista m JOIN public.usuario u ON u.id=m.usuario_id WHERE m.id=-27001`;
    expect(depois).toEqual(antes);
  })).toBe(rollback);
});

test('cobertura conhecida é distinguida de dado ausente em todo o intervalo consultado', async () => {
  expect(await ensaio(async tx => {
    await escala(tx, { inicio: '2026-12-01T08:00:00Z', fim: '2026-12-01T12:00:00Z' });
    await escala(tx, { id: -921905, inicio: '2026-12-01T14:00:00Z', fim: '2026-12-01T18:00:00Z', situacao: 'FORA_DE_ESCALA' });
    await escala(tx, { id: -921906, inicio: '2026-12-01T12:00:00Z', fim: '2026-12-01T14:00:00Z', ...cancelamento });
    const lacunas = await tx`WITH consulta AS (SELECT tstzrange('2026-12-01T06:00:00Z','2026-12-01T20:00:00Z','[)') AS r),
      conhecido AS (SELECT range_agg(tstzrange(e.inicio, e.fim, '[)') * c.r) AS m FROM public.escala_motorista e, consulta c
        WHERE e.motorista_id=-27001 AND e.estado='VIGENTE' AND tstzrange(e.inicio, e.fim, '[)') && c.r)
      SELECT lower(x)::text AS inicio, upper(x)::text AS fim
      FROM consulta c, conhecido k, unnest(c.r::tstzmultirange - coalesce(k.m, '{}'::tstzmultirange)) AS x ORDER BY 1`;
    // Período cancelado volta a ser lacuna (desconhecido), não folga nem disponibilidade.
    expect(lacunas.map(l => [new Date(l.inicio).toISOString(), new Date(l.fim).toISOString()])).toEqual([
      ['2026-12-01T06:00:00.000Z', '2026-12-01T08:00:00.000Z'],
      ['2026-12-01T12:00:00.000Z', '2026-12-01T14:00:00.000Z'],
      ['2026-12-01T18:00:00.000Z', '2026-12-01T20:00:00.000Z'],
    ]);
  })).toBe(rollback);
});

test.each<[string, Linha]>([
  ['fim anterior ao início', { fim: '2026-12-01T06:00:00-03:00' }],
  ['intervalo vazio', { fim: '2026-12-01T07:00:00-03:00' }],
  ['situação inventada', { situacao: 'PLANTAO_PADRAO' }],
  ['cancelada com motivo vazio', { ...cancelamento, motivo_cancelamento: ' ' }],
  ['cancelada sem motivo', { ...cancelamento, motivo_cancelamento: null }],
  ['cancelada sem autoria', { ...cancelamento, cancelado_por_id: null }],
  ['vigente com dados de cancelamento', { cancelado_por_id: -27001 }],
])('escala rejeita %s', async (_caso, dados) => {
  expect(await ensaio(tx => escala(tx, dados))).toMatchObject({ code: '23514' });
});

// Texto com cast explícito: o serializador Date do INSERT de objeto não aceita infinity.
test.each(['escala_motorista', 'indisponibilidade_motorista'])('%s rejeita limites infinitos', async tabela => {
  const situacao = tabela === 'escala_motorista' ? 'situacao' : 'tipo';
  const valor = tabela === 'escala_motorista' ? 'EM_ESCALA' : 'AFASTADO';
  for (const [inicio, fim] of [['-infinity', '2026-12-01T00:00:00Z'], ['2026-12-01T00:00:00Z', 'infinity']]) {
    expect(await ensaio(tx => tx`INSERT INTO ${tx('public.' + tabela)} (motorista_id, ${tx(situacao)}, inicio, fim, autor_id)
      VALUES (-27001, ${valor}, ${inicio}::text::timestamptz, ${fim}::text::timestamptz, -27002)`)).toMatchObject({ code: '23514' });
  }
});

test('escala impede duplicidade/sobreposição vigente do mesmo motorista e exige FKs reais', async () => {
  expect(await ensaio(async tx => { await escala(tx); await escala(tx, { id: -921905, inicio: '2026-12-01T18:00:00-03:00', situacao: 'FORA_DE_ESCALA' }); }))
    .toMatchObject({ code: '23P01', constraint_name: 'escala_motorista_sem_sobreposicao' });
  expect(await ensaio(async tx => { await escala(tx); await escala(tx, { id: -921905, motorista_id: -27002 }); })).toBe(rollback);
  expect(await ensaio(async tx => { await escala(tx, cancelamento); await escala(tx, { id: -921905 }); })).toBe(rollback);
  expect(await ensaio(tx => escala(tx, { motorista_id: -921999 }))).toMatchObject({ code: '23503' });
  expect(await ensaio(tx => escala(tx, { autor_id: -921999 }))).toMatchObject({ code: '23503' });
  expect(await ensaio(tx => escala(tx, { autor_id: null }))).toMatchObject({ code: '23502' });
});

test('backend só cancela período: não reescreve intervalo, motorista ou autor, nem apaga', async () => {
  expect(await ensaio(async tx => {
    await escala(tx);
    await tx`UPDATE public.escala_motorista SET ${tx(cancelamento)} WHERE id=-921901`;
    await ausencia(tx);
    await tx`UPDATE public.indisponibilidade_motorista SET ${tx(cancelamento)} WHERE id=-921902`;
  })).toBe(rollback);
  for (const tabela of ['escala_motorista', 'indisponibilidade_motorista']) {
    for (const coluna of ['inicio', 'motorista_id', 'autor_id']) {
      expect(await ensaio(tx => tx`UPDATE ${tx('public.' + tabela)} SET ${tx(coluna)}=${tx(coluna)} WHERE id=-921901`))
        .toMatchObject({ code: '42501' });
    }
    expect(await ensaio(tx => tx`DELETE FROM ${tx('public.' + tabela)} WHERE id=-921901`)).toMatchObject({ code: '42501' });
  }
});

test('indisponibilidade aceita término não informado, sem campo clínico, e impede sobreposição', async () => {
  const colunas = await sql`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='indisponibilidade_motorista' ORDER BY ordinal_position`;
  expect(colunas.map(c => c.column_name)).toEqual(['id', 'motorista_id', 'tipo', 'inicio', 'fim', 'estado', 'autor_id',
    'criado_em', 'cancelado_por_id', 'cancelado_em', 'motivo_cancelamento']);
  expect(await ensaio(async tx => { await ausencia(tx, { fim: null }); })).toBe(rollback);
  expect(await ensaio(async tx => { await ausencia(tx, { fim: null }); await ausencia(tx, { id: -921905, tipo: 'FOLGA', inicio: '2027-06-01T00:00:00Z', fim: '2027-06-02T00:00:00Z' }); }))
    .toMatchObject({ code: '23P01', constraint_name: 'indisponibilidade_motorista_sem_sobreposicao' });
  expect(await ensaio(async tx => { await ausencia(tx); await ausencia(tx, { id: -921905, inicio: '2026-12-20T00:00:00-03:00', fim: null }); })).toBe(rollback);
  for (const dados of <Linha[]>[{ tipo: 'FERIAS' }, { tipo: 'INATIVO' }, { fim: '2026-12-10T00:00:00-03:00' }, { ...cancelamento, motivo_cancelamento: null }]) {
    expect(await ensaio(tx => ausencia(tx, dados))).toMatchObject({ code: '23514' });
  }
});

test('matriz vazia distingue vedação conhecida, impede duplicidade e valores inválidos', async () => {
  expect(await sql`SELECT id FROM public.habilitacao_categoria_veiculo`).toEqual([]);
  expect(await ensaio(async tx => {
    await matriz(tx);
    await matriz(tx, { id: -921905, categoria_cnh: 'B', permitido: false });
    await tx`UPDATE public.habilitacao_categoria_veiculo SET vigencia_fim='2028-01-01' WHERE id=-921903`;
    await matriz(tx, { id: -921906, vigencia_inicio: '2028-01-01', fonte_normativa: 'Nova fonte fictícia' });
    expect(await tx`SELECT categoria_cnh, permitido FROM public.habilitacao_categoria_veiculo
      WHERE classe_veicular='Classe fictícia de teste' AND daterange(vigencia_inicio, vigencia_fim, '[)') @> '2027-06-01'::date
      ORDER BY categoria_cnh`).toEqual([{ categoria_cnh: 'B', permitido: false }, { categoria_cnh: 'D', permitido: true }]);
  })).toBe(rollback);
  expect(await ensaio(async tx => { await matriz(tx); await matriz(tx, { id: -921905, fonte_normativa: 'Outra fonte fictícia' }); }))
    .toMatchObject({ code: '23505', constraint_name: 'habilitacao_categoria_veiculo_vigencia_key' });
  for (const dados of <Linha[]>[{ categoria_cnh: 'AB' }, { classe_veicular: ' ' }, { fonte_normativa: '' },
    { vigencia_fim: '2027-01-01' }, { permitido: null }]) {
    const erro = await ensaio(tx => matriz(tx, dados));
    expect(erro).toMatchObject({ code: expect.stringMatching(/^(23514|23502)$/) });
  }
  expect(await ensaio(tx => tx`UPDATE public.habilitacao_categoria_veiculo SET permitido=false WHERE id=-921903`)).toMatchObject({ code: '42501' });
});

test('transição profissional exige motivo/autor, começa por inativação, alterna e não tem lacuna', async () => {
  expect(await ensaio(async tx => {
    const [antes] = await tx`SELECT m.status, u.ativo FROM public.motorista m JOIN public.usuario u ON u.id=m.usuario_id WHERE m.id=-27001`;
    await transicao(tx);
    await transicao(tx, { id: -921905, versao: 2, versao_anterior: 1, acao: 'REATIVACAO', motivo: 'Retorno fictício' });
    await transicao(tx, { id: -921906, versao: 3, versao_anterior: 2 });
    const [depois] = await tx`SELECT m.status, u.ativo FROM public.motorista m JOIN public.usuario u ON u.id=m.usuario_id WHERE m.id=-27001`;
    expect(depois).toEqual(antes);
  })).toBe(rollback);
  const invalidos: Linha[] = [
    { acao: 'REATIVACAO' }, { motivo: '  ' }, { motivo: 'a'.repeat(1001) }, { versao: 0 },
    { versao: 1, versao_anterior: 0 }, { versao: 2, versao_anterior: null, acao: 'REATIVACAO' },
  ];
  for (const dados of invalidos) expect(await ensaio(tx => transicao(tx, dados))).toMatchObject({ code: '23514' });
  expect(await ensaio(tx => transicao(tx, { motivo: null }))).toMatchObject({ code: '23502' });
  expect(await ensaio(tx => transicao(tx, { autor_id: null }))).toMatchObject({ code: '23502' });
  // Versão 3 sem a 2 (lacuna) e duas transições concorrentes com a mesma versão.
  expect(await ensaio(async tx => { await transicao(tx); await transicao(tx, { id: -921905, versao: 3, versao_anterior: 2 }); }))
    .toMatchObject({ code: '23503', constraint_name: 'motorista_transicao_profissional_anterior_fk' });
  expect(await ensaio(async tx => { await transicao(tx); await transicao(tx, { id: -921905 }); }))
    .toMatchObject({ code: '23505', constraint_name: 'motorista_transicao_profissional_versao_key' });
  for (const verbo of ['UPDATE', 'DELETE']) {
    expect(await ensaio(async tx => {
      if (verbo === 'UPDATE') await tx`UPDATE public.motorista_transicao_profissional SET motivo='x' WHERE id=-921904`;
      else await tx`DELETE FROM public.motorista_transicao_profissional WHERE id=-921904`;
    })).toMatchObject({ code: '42501' });
  }
});

test.each(tabelas)('Data API não lê %s', async tabela => {
  for (const papel of ['anon', 'authenticated']) {
    expect(await ensaio(async tx => {
      await tx.unsafe('SET LOCAL ROLE ' + papel);
      await tx`SELECT id FROM ${tx('public.' + tabela)}`;
    }, admin)).toMatchObject({ code: '42501' });
  }
});

test.each(tabelas)('rollback recusa perda de dados em %s', async tabela => {
  expect(await ensaio(async tx => {
    if (tabela === 'escala_motorista') await escala(tx);
    else if (tabela === 'indisponibilidade_motorista') await ausencia(tx);
    else if (tabela === 'habilitacao_categoria_veiculo') await matriz(tx);
    else await transicao(tx);
    await tx.unsafe(backward);
  }, admin)).toMatchObject({ message: expect.stringContaining('Rollback SCRUM-219 recusado') });
});

test('rollback vazio e reaplicação preservam esquema e cadastros anteriores; nenhum backfill', async () => {
  expect(await ensaio(async tx => {
    const antes = await metadados(tx);
    const motoristas = await tx`SELECT * FROM public.motorista ORDER BY id`;
    const usuarios = await tx`SELECT id, ativo, perfil FROM public.usuario ORDER BY id`;
    await tx.unsafe(backward);
    const revertido = await metadados(tx);
    expect(revertido.tables.map(t => t.name)).toEqual(antes.tables.filter(t => !tabelas.includes(t.name)).map(t => t.name));
    await tx.unsafe(forward);
    expect(await metadados(tx)).toEqual(antes);
    expect(await tx`SELECT * FROM public.motorista ORDER BY id`).toEqual(motoristas);
    expect(await tx`SELECT id, ativo, perfil FROM public.usuario ORDER BY id`).toEqual(usuarios);
    for (const tabela of tabelas) expect(await tx`SELECT id FROM ${tx('public.' + tabela)}`).toEqual([]);
  }, admin)).toBe(rollback);
});
