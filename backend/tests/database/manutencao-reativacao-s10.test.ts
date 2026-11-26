import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';

const name = '20261123000100_be_s10_02_a_historico_cancelamento_reativacao.sql';
const base = resolve(root, 'backend/src/database/supabase');
const forward = readFileSync(resolve(base, 'migrations', name), 'utf8');
const script = readFileSync(resolve(base, 'rollbacks', name), 'utf8');
const body = script.match(/^--[^\n]*\r?\nBEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/)?.[1];
if (!body) throw new Error('O rollback deve declarar sua transação.');
const backward = body;
const sentinel = new Error('Reverter fixtures SCRUM-232');
let sql: Awaited<ReturnType<typeof verifiedSql>>;

beforeAll(async () => { sql = await verifiedSql(true); });
afterAll(async () => { await sql?.end(); });

async function isolated(run: (tx: TransactionSql) => Promise<void>) {
  try {
    await sql.begin(async tx => {
      await run(tx);
      throw sentinel;
    });
  } catch (error) {
    if (error !== sentinel) throw error;
  }
}

const occurrence = -232001;
const day = '2026-12-10T00:00:00-03:00';
const started = '2026-12-10T08:00:00-03:00';
const closed = '2026-12-10T09:00:00-03:00';
const cancelled = '2026-12-10T07:00:00-03:00';

async function base231(tx: TransactionSql) {
  const [exists] = await tx`SELECT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.manutencao_veiculo_historico'::regclass
      AND attname='anterior_cancelada_em' AND NOT attisdropped
  ) AS incremental`;
  if (exists.incremental) await tx.unsafe(backward);
  await tx`INSERT INTO public.manutencao_veiculo
    (id, veiculo_id, tipo, descricao, entrada_em, conclusao_prevista_em, quilometragem,
     status, criado_por_id, atualizado_por_id)
    VALUES (${occurrence}, -27003, 'PREVENTIVA', 'Fixture SCRUM-232', ${day}, ${day}, 0, 'AGENDADA', -27002, -27002)`;
}

type Patch = Record<string, string | number | null>;
async function event(tx: TransactionSql, patch: Patch, extended = true) {
  const row = {
    id: -232010, manutencao_id: occurrence,
    evento: 'CONCLUSAO', status_anterior: 'EM_ANDAMENTO', status_posterior: 'CONCLUIDA',
    anterior_entrada_em: day, anterior_conclusao_prevista_em: day,
    anterior_iniciada_em: started, anterior_concluida_em: null,
    posterior_entrada_em: day, posterior_conclusao_prevista_em: day,
    posterior_iniciada_em: started, posterior_concluida_em: closed, autor_id: -27002,
    ...(extended ? { anterior_cancelada_em: null, posterior_cancelada_em: null } : {}),
    ...patch,
  };
  await tx`INSERT INTO public.manutencao_veiculo_historico ${tx(row)}`;
}

const cancelamento = {
  evento: 'CANCELAMENTO', status_anterior: 'AGENDADA', status_posterior: 'CANCELADA',
  anterior_iniciada_em: null, posterior_iniciada_em: null, posterior_concluida_em: null,
  posterior_cancelada_em: cancelled,
};
function reativacao(destino: 'AGENDADA' | 'EM_ANDAMENTO', instante = cancelled) {
  return {
    evento: 'REATIVACAO', status_anterior: 'CANCELADA', status_posterior: destino,
    anterior_iniciada_em: null, anterior_cancelada_em: instante,
    posterior_iniciada_em: destino === 'EM_ANDAMENTO' ? started : null, posterior_concluida_em: null,
  };
}

async function protections(tx: TransactionSql) {
  return tx`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text AS acl,
      pg_get_userbyid(c.relowner) AS owner,
      (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid)
        FROM pg_index i WHERE i.indrelid=c.oid) AS indexes,
      (SELECT jsonb_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname)
        FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype='f') AS fks,
      (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
    FROM pg_class c WHERE c.oid IN ('public.manutencao_veiculo_historico'::regclass,
      'public.manutencao_veiculo_historico_id_seq'::regclass)
    ORDER BY c.relname`;
}

async function historyShape(tx: TransactionSql) {
  const [shape] = await tx`SELECT
    (SELECT jsonb_agg(jsonb_build_array(attname, attnotnull, format_type(atttypid, atttypmod)) ORDER BY attnum)
     FROM pg_attribute WHERE attrelid='public.manutencao_veiculo_historico'::regclass
       AND attnum > 0 AND NOT attisdropped) AS columns,
    (SELECT jsonb_agg(jsonb_build_array(conname, pg_get_constraintdef(oid), convalidated) ORDER BY conname)
     FROM pg_constraint WHERE conrelid='public.manutencao_veiculo_historico'::regclass) AS constraints`;
  return shape;
}

test('upgrade e rollback compatível preservam os três eventos legados e os objetos do catálogo', async () => {
  await isolated(async tx => {
    await base231(tx);
    await event(tx, {}, false);
    await event(tx, { id: -232011, evento: 'CORRECAO_DATAS', status_anterior: 'CONCLUIDA',
      anterior_concluida_em: closed, posterior_concluida_em: '2026-12-10T10:00:00-03:00' }, false);
    await event(tx, { id: -232012, evento: 'REABERTURA', status_anterior: 'CONCLUIDA',
      status_posterior: 'AGENDADA', anterior_concluida_em: closed,
      posterior_iniciada_em: null, posterior_concluida_em: null }, false);
    const readHistory = async () => (await tx`SELECT to_jsonb(h) AS row FROM public.manutencao_veiculo_historico h ORDER BY id`).map(item => item.row);
    const old = await readHistory();
    const catalog = await protections(tx);
    const shape = await historyShape(tx);
    const fleet = await tx`SELECT id, status FROM public.veiculo ORDER BY id`;
    const ledger = await tx`SELECT * FROM fsph_test_harness.migrations ORDER BY name`;
    await tx.unsafe(forward);
    const rows = await readHistory();
    expect(rows).toEqual(old.map(row => ({ ...row, anterior_cancelada_em: null, posterior_cancelada_em: null })));
    expect(await protections(tx)).toEqual(catalog);
    for (const role of ['anon', 'authenticated']) {
      await expect(tx.savepoint(async sub => {
        await sub`SET LOCAL ROLE ${sub(role)}`;
        await sub`SELECT id FROM public.manutencao_veiculo_historico`;
      })).rejects.toMatchObject({ code: '42501' });
    }
    await tx.unsafe(backward);
    expect(await historyShape(tx)).toEqual(shape);
    expect(await protections(tx)).toEqual(catalog);
    expect(await readHistory()).toEqual(old);
    expect(await tx`SELECT id, status FROM public.veiculo ORDER BY id`).toEqual(fleet);
    await tx.unsafe(forward);
    expect(await readHistory()).toEqual(rows);
    expect(await protections(tx)).toEqual(catalog);
    expect(await tx`SELECT * FROM fsph_test_harness.migrations ORDER BY name`).toEqual(ledger);
  });
});

test('múltiplos ciclos preservam cada cancelamento e admitem os dois destinos', async () => {
  await isolated(async tx => {
    await base231(tx);
    await tx.unsafe(forward);
    const second = '2026-12-10T07:30:00-03:00';
    await event(tx, cancelamento);
    await event(tx, { id: -232009, ...reativacao('AGENDADA') });
    await event(tx, { id: -232008, ...cancelamento, posterior_cancelada_em: second });
    await event(tx, { id: -232007, ...reativacao('EM_ANDAMENTO', second) });
    const read = () => tx`SELECT status_posterior, anterior_cancelada_em, posterior_cancelada_em
      FROM public.manutencao_veiculo_historico WHERE manutencao_id=${occurrence} ORDER BY id`;
    const records = await read();
    expect(records).toEqual([
      { status_posterior: 'CANCELADA', anterior_cancelada_em: null, posterior_cancelada_em: new Date(cancelled) },
      { status_posterior: 'AGENDADA', anterior_cancelada_em: new Date(cancelled), posterior_cancelada_em: null },
      { status_posterior: 'CANCELADA', anterior_cancelada_em: null, posterior_cancelada_em: new Date(second) },
      { status_posterior: 'EM_ANDAMENTO', anterior_cancelada_em: new Date(second), posterior_cancelada_em: null },
    ]);
    await expect(tx.savepoint(async sub => { await sub.unsafe(backward); }))
      .rejects.toThrow('Rollback SCRUM-232 recusado');
    expect(await read()).toEqual(records);
  });
});

test.each<Patch>([
  { ...cancelamento, posterior_cancelada_em: null },
  { ...cancelamento, anterior_iniciada_em: started },
  { ...cancelamento, posterior_iniciada_em: started },
  { ...cancelamento, posterior_concluida_em: closed },
  { ...reativacao('AGENDADA'), anterior_cancelada_em: null },
  { ...reativacao('AGENDADA'), posterior_cancelada_em: cancelled },
  { ...reativacao('AGENDADA'), posterior_iniciada_em: started },
  { ...reativacao('EM_ANDAMENTO'), posterior_iniciada_em: null },
  { ...reativacao('EM_ANDAMENTO'), posterior_concluida_em: closed },
  { ...reativacao('EM_ANDAMENTO'), status_posterior: 'CONCLUIDA', posterior_concluida_em: closed },
])('recusa snapshot incompatível %j', async patch => {
  await expect(isolated(async tx => {
    await base231(tx);
    await tx.unsafe(forward);
    await event(tx, patch);
  })).rejects.toMatchObject({ code: '23514' });
});

test.each(['Infinity', '-Infinity'])('recusa cancelamento não finito %s no PostgreSQL', async invalid => {
  await isolated(async tx => {
    await base231(tx);
    await tx.unsafe(forward);
    await event(tx, cancelamento);
    await event(tx, { id: -232009, ...reativacao('AGENDADA') });
    for (const [id, column] of [[-232010, 'posterior_cancelada_em'], [-232009, 'anterior_cancelada_em']] as const) {
      await expect(tx.savepoint(async sub => {
        await sub`UPDATE public.manutencao_veiculo_historico SET ${sub(column)}=${invalid}::text::timestamptz WHERE id=${id}`;
      })).rejects.toMatchObject({ code: '23514', constraint_name: 'manutencao_veiculo_historico_instantes_check' });
    }
  });
});
