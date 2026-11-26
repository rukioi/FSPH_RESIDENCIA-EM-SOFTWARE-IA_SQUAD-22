import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TransactionSql } from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';

const base = resolve(root, 'backend/src/database/supabase');
const name = '20261123000000_db_s10_02_manutencao_veiculo.sql';
const migration = readFileSync(resolve(base, 'migrations', name), 'utf8');
const rollbackScript = readFileSync(resolve(base, 'rollbacks', name), 'utf8');
// O teste assume a transação externa para reverter também a reaplicação.
const down = rollbackScript.match(/^--[^\n]*\r?\nBEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/)?.[1];
if (!down) throw new Error('Rollback SCRUM-231 deve declarar a transação explícita.');
const rollbackBody = down;

const rolledBack = new Error('reverter fixture sintética');
let sql: Awaited<ReturnType<typeof verifiedSql>>;

beforeAll(async () => { sql = await verifiedSql(true); });
afterAll(async () => { await sql?.end(); });

async function isolated(run: (tx: TransactionSql) => Promise<void>) {
  try {
    await sql.begin(async tx => {
      await run(tx);
      throw rolledBack;
    });
  } catch (error) {
    if (error !== rolledBack) throw error;
  }
}

const fixture = {
  id: -231001,
  veiculo_id: -27003,
  tipo: 'CORRETIVA',
  descricao: 'Manutenção sintética SCRUM-231',
  entrada_em: '2026-12-10T00:00:00-03:00',
  conclusao_prevista_em: '2026-12-10T03:00:00Z',
  quilometragem: 0,
  status: 'AGENDADA',
  criado_por_id: -27002,
  atualizado_por_id: -27002,
};

type Overrides = Record<string, string | number | null>;
async function insert(tx: TransactionSql, overrides: Overrides = {}) {
  await tx`INSERT INTO public.manutencao_veiculo ${tx({ ...fixture, ...overrides })}`;
}

test('dia civil completo aceita entrada e previsão no mesmo dia, custo NULL, zero e escala variável', async () => {
  await isolated(async tx => {
    await insert(tx);
    await insert(tx, { id: -231002, custo: '0' });
    await insert(tx, { id: -231003, custo: '123.456789' });
    expect(await tx`SELECT custo::text FROM public.manutencao_veiculo
      WHERE id IN (-231001,-231002,-231003) ORDER BY id DESC`)
      .toEqual([{ custo: null }, { custo: '0' }, { custo: '123.456789' }]);
  });
});

test.each<[Overrides, string]>([
  [{ veiculo_id: -231099 }, '23503'],
  [{ criado_por_id: -231099 }, '23503'],
  [{ atualizado_por_id: -231099 }, '23503'],
  [{ quilometragem: null }, '23502'],
  [{ quilometragem: -1 }, '23514'],
  [{ custo: '-0.00001' }, '23514'],
  [{ custo: 'NaN' }, '23514'],
  [{ custo: 'Infinity' }, '23514'],
  [{ custo: '-Infinity' }, '23514'],
  [{ entrada_em: null }, '23502'],
  [{ conclusao_prevista_em: null }, '23502'],
  [{ entrada_em: '2026-12-10T00:00:00Z' }, '23514'],
  [{ conclusao_prevista_em: '2026-12-09T00:00:00-03:00' }, '23514'],
  [{ status: 'INEXISTENTE' }, '22P02'],
  [{ status: 'EM_ANDAMENTO' }, '23514'],
  [{ status: 'CANCELADA', iniciada_em: '2026-12-10T08:00:00-03:00',
    cancelada_em: '2026-12-10T09:00:00-03:00' }, '23514'],
  [{ status: 'CONCLUIDA', iniciada_em: '2026-12-10T10:00:00-03:00',
    concluida_em: '2026-12-10T09:00:00-03:00' }, '23514'],
])('recusa fixture inválida %j com SQLSTATE %s', async (overrides, code) => {
  await expect(isolated(async tx => { await insert(tx, overrides); })).rejects.toMatchObject({ code });
});

type Event = 'CONCLUSAO' | 'CORRECAO_DATAS' | 'REABERTURA';
type Snapshot = {
  status: string;
  entrada_em: string;
  conclusao_prevista_em: string;
  iniciada_em: string | null;
  concluida_em: string | null;
};

async function snapshot(tx: TransactionSql): Promise<Snapshot> {
  const [row] = await tx<Snapshot[]>`SELECT status, entrada_em::text,
    conclusao_prevista_em::text, iniciada_em::text, concluida_em::text
    FROM public.manutencao_veiculo WHERE id=-231001`;
  return row;
}

async function logEvent(tx: TransactionSql, evento: Event, before: Snapshot, after: Snapshot) {
  await tx`INSERT INTO public.manutencao_veiculo_historico
    (manutencao_id, evento, status_anterior, status_posterior,
     anterior_entrada_em, anterior_conclusao_prevista_em, anterior_iniciada_em, anterior_concluida_em,
     posterior_entrada_em, posterior_conclusao_prevista_em, posterior_iniciada_em, posterior_concluida_em, autor_id)
    VALUES (-231001, ${evento}, ${before.status}, ${after.status},
      ${before.entrada_em}, ${before.conclusao_prevista_em}, ${before.iniciada_em}, ${before.concluida_em},
      ${after.entrada_em}, ${after.conclusao_prevista_em}, ${after.iniciada_em}, ${after.concluida_em}, -27002)`;
}

test('representa múltiplos ciclos e preserva estados e datas antes e depois', async () => {
  await isolated(async tx => {
    await insert(tx, { status: 'EM_ANDAMENTO', iniciada_em: '2026-12-10T08:00:00-03:00' });
    const expected = [];
    for (const [day, target] of [[10, 'AGENDADA'], [11, 'EM_ANDAMENTO']] as const) {
      const at = (hour: string) => `2026-12-${day}T${hour}:00:00-03:00`;
      const before = await snapshot(tx);
      await tx`UPDATE public.manutencao_veiculo SET status='CONCLUIDA', concluida_em=${at('10')} WHERE id=-231001`;
      const closed = await snapshot(tx);
      await logEvent(tx, 'CONCLUSAO', before, closed);
      await tx`UPDATE public.manutencao_veiculo SET concluida_em=${at('11')} WHERE id=-231001`;
      const corrected = await snapshot(tx);
      await logEvent(tx, 'CORRECAO_DATAS', closed, corrected);
      const nextStart = target === 'EM_ANDAMENTO' ? at('12') : null;
      await tx`UPDATE public.manutencao_veiculo SET status=${target}, iniciada_em=${nextStart}, concluida_em=NULL
        WHERE id=-231001`;
      await logEvent(tx, 'REABERTURA', corrected, await snapshot(tx));
      expected.push(['CONCLUSAO', 'EM_ANDAMENTO', 'CONCLUIDA', null, 10],
        ['CORRECAO_DATAS', 'CONCLUIDA', 'CONCLUIDA', 10, 11],
        ['REABERTURA', 'CONCLUIDA', target, 11, null]);
      if (target === 'AGENDADA') {
        await tx`UPDATE public.manutencao_veiculo SET status='EM_ANDAMENTO',
          iniciada_em='2026-12-11T08:00:00-03:00' WHERE id=-231001`;
      }
    }
    const rows = await tx`SELECT evento, status_anterior, status_posterior, autor_id::text,
      extract(hour FROM anterior_concluida_em AT TIME ZONE 'America/Maceio')::int AS anterior,
      extract(hour FROM posterior_concluida_em AT TIME ZONE 'America/Maceio')::int AS posterior,
      isfinite(registrado_em) AS instante_valido
      FROM public.manutencao_veiculo_historico WHERE manutencao_id=-231001 ORDER BY id`;
    expect(rows.map(row => [row.evento, row.status_anterior, row.status_posterior, row.anterior, row.posterior]))
      .toEqual(expected);
    expect(rows.every(row => row.autor_id === '-27002' && row.instante_valido)).toBe(true);
  });
});

test('histórico rejeita combinação incompatível de evento e estado', async () => {
  await expect(isolated(async tx => {
    await insert(tx, { status: 'CONCLUIDA', iniciada_em: '2026-12-10T08:00:00-03:00',
      concluida_em: '2026-12-10T10:00:00-03:00' });
    const closed = await snapshot(tx);
    await logEvent(tx, 'REABERTURA', closed, closed);
  })).rejects.toMatchObject({ code: '23514', constraint_name: 'manutencao_veiculo_historico_evento_check' });
});

test('RLS, ACL e índices são limitados aos objetos da entrega', async () => {
  await isolated(async tx => {
    const tabela = 'public.manutencao_veiculo';
    const historico = 'public.manutencao_veiculo_historico';
    const [flags] = await tx`SELECT
      (SELECT count(*)::int FROM pg_class WHERE oid IN (${tabela}::regclass, ${historico}::regclass)
        AND relrowsecurity) AS rls,
      (SELECT count(*)::int FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
        WHERE c.oid IN (${tabela}::regclass, ${historico}::regclass,
          'public.manutencao_veiculo_id_seq'::regclass, 'public.manutencao_veiculo_historico_id_seq'::regclass)
          AND a.grantee = 0) AS public_acl,
      has_table_privilege('postgres', ${tabela}, 'UPDATE') AS atualiza,
      has_table_privilege('postgres', ${historico}, 'INSERT') AS inclui_historico,
      has_table_privilege('postgres', ${historico}, 'UPDATE') AS reescreve_historico,
      has_table_privilege('postgres', ${historico}, 'DELETE') AS apaga_historico`;
    expect(flags).toEqual({
      rls: 2, public_acl: 0, atualiza: true, inclui_historico: true,
      reescreve_historico: false, apaga_historico: false,
    });
    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const table of ['manutencao_veiculo', 'manutencao_veiculo_historico']) {
        const [privileges] = await tx`SELECT
          has_table_privilege(${role}, ${'public.' + table}, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') AS tabela,
          has_sequence_privilege(${role}, ${'public.' + table + '_id_seq'}, 'USAGE, SELECT, UPDATE') AS sequencia`;
        expect(privileges).toEqual({ tabela: false, sequencia: false });
      }
    }
    const [index] = await tx`SELECT indisvalid, pg_get_expr(indpred, indrelid) AS predicado FROM pg_index
      WHERE indexrelid='public.manutencao_veiculo_bloqueios_idx'::regclass`;
    expect(index).toMatchObject({ indisvalid: true, predicado: expect.stringMatching(/AGENDADA.*EM_ANDAMENTO/) });
  });
});

const relations = ['manutencao_veiculo', 'manutencao_veiculo_historico'];

test.each(['anon', 'authenticated'])('nega leitura e uso das sequências para %s', async role => {
  for (const table of relations) {
    for (const sequence of [false, true]) {
      await expect(isolated(async tx => {
        await tx`SET LOCAL ROLE ${tx(role)}`;
        if (sequence) await tx`SELECT nextval(${'public.' + table + '_id_seq'}::regclass)`;
        else await tx`SELECT id FROM ${tx('public.' + table)}`;
      })).rejects.toMatchObject({ code: '42501' });
    }
  }
});

async function syntheticRuntime(tx: TransactionSql, policies: boolean) {
  await tx`CREATE ROLE s10_fixture_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS`;
  await tx`GRANT USAGE ON SCHEMA public TO s10_fixture_runtime`;
  await tx`GRANT SELECT, INSERT, UPDATE ON public.manutencao_veiculo TO s10_fixture_runtime`;
  await tx`GRANT SELECT, INSERT ON public.manutencao_veiculo_historico TO s10_fixture_runtime`;
  await tx`GRANT USAGE ON SEQUENCE public.manutencao_veiculo_id_seq,
    public.manutencao_veiculo_historico_id_seq TO s10_fixture_runtime`;
  if (policies) {
    // Exclusivas do ensaio em transação. A migration não instala policies de runtime.
    await tx`CREATE POLICY prova_corrente ON public.manutencao_veiculo
      TO s10_fixture_runtime USING (true) WITH CHECK (true)`;
    await tx`CREATE POLICY prova_historico_leitura ON public.manutencao_veiculo_historico
      FOR SELECT TO s10_fixture_runtime USING (true)`;
    await tx`CREATE POLICY prova_historico_insercao ON public.manutencao_veiculo_historico
      FOR INSERT TO s10_fixture_runtime WITH CHECK (true)`;
  }
  await tx`SET LOCAL ROLE s10_fixture_runtime`;
}

test('grants sem policy não permitem gravar sob RLS', async () => {
  await expect(isolated(async tx => {
    await syntheticRuntime(tx, false);
    await insert(tx);
  })).rejects.toMatchObject({ code: '42501', message: expect.stringContaining('row-level security') });
});

test('runtime sintético opera com grants mínimos e policies de ensaio', async () => {
  await isolated(async tx => {
    await syntheticRuntime(tx, true);
    await insert(tx, { status: 'EM_ANDAMENTO', iniciada_em: '2026-12-10T08:00:00-03:00' });
    const before = await snapshot(tx);
    await tx`UPDATE public.manutencao_veiculo SET status='CONCLUIDA',
      concluida_em='2026-12-10T10:00:00-03:00' WHERE id=-231001`;
    await logEvent(tx, 'CONCLUSAO', before, await snapshot(tx));
    expect(await tx`SELECT evento FROM public.manutencao_veiculo_historico WHERE manutencao_id=-231001`)
      .toEqual([{ evento: 'CONCLUSAO' }]);
  });
});

test.each(['UPDATE', 'DELETE'])('runtime sintético não executa %s do histórico', async action => {
  await expect(isolated(async tx => {
    await syntheticRuntime(tx, true);
    if (action === 'UPDATE') await tx`UPDATE public.manutencao_veiculo_historico SET registrado_em=NOW()`;
    else await tx`DELETE FROM public.manutencao_veiculo_historico`;
  })).rejects.toMatchObject({ code: '42501' });
});

test.each(['Infinity', '-Infinity'])('o PostgreSQL recusa datas civis %s em ambos os campos', async value => {
  for (const field of ['entrada_em', 'conclusao_prevista_em']) {
    await expect(isolated(async tx => {
      await insert(tx);
      await tx`UPDATE public.manutencao_veiculo SET ${tx(field)}=${value}::text::timestamptz WHERE id=-231001`;
    })).rejects.toMatchObject({ code: '23514', constraint_name: 'manutencao_veiculo_dias_check' });
  }
});

test('dia civil único termina na meia-noite local seguinte, independente do fuso da sessão', async () => {
  await isolated(async tx => {
    await tx`SET LOCAL TIME ZONE 'UTC'`;
    await insert(tx);
    const [window] = await tx`SELECT
      entrada_em = '2026-12-10T03:00:00Z'::timestamptz AS inicio,
      (((conclusao_prevista_em AT TIME ZONE 'America/Maceio')::date + 1)::timestamp
        AT TIME ZONE 'America/Maceio') = '2026-12-11T03:00:00Z'::timestamptz AS fim
      FROM public.manutencao_veiculo WHERE id=-231001`;
    expect(window).toEqual({ inicio: true, fim: true });
  });
});

test('histórico exige ocorrência existente', async () => {
  await expect(isolated(async tx => {
    const closed = {
      status: 'CONCLUIDA', entrada_em: fixture.entrada_em, conclusao_prevista_em: fixture.conclusao_prevista_em,
      iniciada_em: '2026-12-10T08:00:00-03:00', concluida_em: '2026-12-10T09:00:00-03:00',
    };
    await logEvent(tx, 'CORRECAO_DATAS', closed, closed);
  })).rejects.toMatchObject({ code: '23503' });
});
test('rollback com dados recusa perda da ocorrência', async () => {
  await isolated(async tx => {
    await insert(tx, { status: 'CONCLUIDA', iniciada_em: '2026-12-10T08:00:00-03:00',
      concluida_em: '2026-12-10T09:00:00-03:00' });
    const record = await snapshot(tx);
    await logEvent(tx, 'CONCLUSAO', { ...record, status: 'EM_ANDAMENTO', concluida_em: null }, record);
    const before = await tx`SELECT * FROM public.manutencao_veiculo_historico WHERE manutencao_id=-231001`;
    await expect(tx.savepoint(async nested => { await nested.unsafe(rollbackBody); }))
      .rejects.toThrow('Rollback SCRUM-231 recusado');
    expect(await snapshot(tx)).toEqual(record);
    expect(await tx`SELECT * FROM public.manutencao_veiculo_historico WHERE manutencao_id=-231001`).toEqual(before);
  });
});

test('rollback vazio e reaplicação preservam a frota legada e não criam histórico fictício', async () => {
  await isolated(async tx => {
    const before = await tx`SELECT * FROM public.veiculo ORDER BY id`;
    expect(before.some(row => row.status === 'EM_MANUTENCAO')).toBe(true);
    const [dependencias] = await tx`SELECT to_regclass('public.manutencao_alerta_revisao') IS NOT NULL AS revisoes`;
    if (dependencias.revisoes) {
      const script = readFileSync(resolve(base, 'rollbacks', '20261124000000_be_s10_02_c_manutencao_alerta_revisao.sql'), 'utf8');
      const corpo = script.match(/^--[^\n]*\r?\nBEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/)?.[1];
      if (!corpo) throw new Error('Rollback SCRUM-234 deve declarar a transação explícita.');
      await tx.unsafe(corpo);
    }
    await tx.unsafe(rollbackBody);
    const [catalog] = await tx`SELECT to_regclass('public.manutencao_veiculo') AS principal,
      to_regclass('public.manutencao_veiculo_historico') AS historico,
      to_regclass('public.manutencao_veiculo_id_seq') AS sequencia,
      to_regclass('public.manutencao_veiculo_historico_id_seq') AS sequencia_historico`;
    expect(catalog).toEqual({ principal: null, historico: null, sequencia: null, sequencia_historico: null });
    await tx.unsafe(migration);
    expect(await tx`SELECT * FROM public.veiculo ORDER BY id`).toEqual(before);
    expect(await tx`SELECT id FROM public.manutencao_veiculo`).toEqual([]);
    expect(await tx`SELECT id FROM public.manutencao_veiculo_historico`).toEqual([]);
  });
});

function sqlDeRollback(nome: string) {
  const fonte = readFileSync(resolve(base, 'rollbacks', nome), 'utf8');
  const corpo = fonte.match(/(?:^|\n)BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/)?.[1];
  if (!corpo) throw new Error('Rollback sem envelope explícito.');
  return corpo;
}

test.each(['revisao', 'aviso'] as const)('rollback dos alertas recusa %s independentemente', async modo => {
  await isolated(async tx => {
    await insert(tx);
    if (modo === 'revisao') {
      await tx`INSERT INTO public.manutencao_alerta_revisao (manutencao_id,alerta) VALUES (-231001,'ATRASO')`;
    } else {
      await tx`INSERT INTO public.notificacao (usuario_id,chave,titulo,descricao,categoria)
        VALUES (-27002,'manutencao:-231001:ATRASO:1','Fixture','Fixture','atencao')`;
    }
    const rollback = sqlDeRollback('20261124000000_be_s10_02_c_manutencao_alerta_revisao.sql');
    await expect(tx.savepoint(sp => sp.unsafe(rollback))).rejects.toThrow('Rollback SCRUM-234 recusado');
    const [row] = await tx`SELECT
      (SELECT count(*)::int FROM public.manutencao_alerta_revisao WHERE manutencao_id=-231001) AS revisoes,
      (SELECT count(*)::int FROM public.notificacao WHERE chave='manutencao:-231001:ATRASO:1') AS avisos`;
    expect(row).toEqual({revisoes:modo==='revisao'?1:0, avisos:modo==='aviso'?1:0});
  });
});

test.each(['1999-10-03','2000-10-08','2001-10-14'])('data civil histórica %s é canônica mesmo sem meia-noite', async dia => {
  await isolated(async tx => {
    const [{ instante }] = await tx`SELECT ${dia}::date::timestamp AT TIME ZONE 'America/Maceio' AS instante`;
    await insert(tx, { status: 'CONCLUIDA', entrada_em: instante.toISOString(),
      conclusao_prevista_em: instante.toISOString(), iniciada_em:'2026-11-26T09:00:00-03:00',
      concluida_em:'2026-11-26T10:00:00-03:00' });
    const atual = await snapshot(tx);
    const anterior = { ...atual, status:'EM_ANDAMENTO' as const, concluida_em:null };
    await logEvent(tx, 'CONCLUSAO', anterior, atual);
    for (const campo of ['anterior_entrada_em','anterior_conclusao_prevista_em','posterior_entrada_em','posterior_conclusao_prevista_em']) {
      await expect(tx.savepoint(sp => sp`UPDATE public.manutencao_veiculo_historico
        SET ${sp(campo)}=${sp(campo)}+interval '1 minute' WHERE manutencao_id=-231001`))
        .rejects.toMatchObject({code:'23514'});
    }
    const [local] = await tx`SELECT (entrada_em AT TIME ZONE 'America/Maceio')::time::text AS hora
      FROM public.manutencao_veiculo WHERE id=-231001`;
    expect(local.hora).toBe('01:00:00');
    await expect(tx.savepoint(sp => sp`UPDATE public.manutencao_veiculo
      SET conclusao_prevista_em=conclusao_prevista_em+interval '1 minute' WHERE id=-231001`))
      .rejects.toMatchObject({code:'23514'});
    const rollback=sqlDeRollback('20261126000000_db_s10_02_datas_civis_manutencao.sql');
    await expect(tx.savepoint(sp => sp.unsafe(rollback))).rejects.toMatchObject({code:'23514'});
    expect((await tx`SELECT id FROM public.manutencao_veiculo WHERE id=-231001`).length).toBe(1);
  });
});

test('rollback físico de datas civis restaura a regra anterior e permite reaplicação', async () => {
  await isolated(async tx => {
    const nome='20261126000000_db_s10_02_datas_civis_manutencao.sql';
    const restricoes = () => tx`SELECT conname,pg_get_constraintdef(oid) AS definicao
      FROM pg_constraint WHERE conname IN ('manutencao_veiculo_dias_check','manutencao_veiculo_historico_dias_check')
      ORDER BY conname`;
    const antes = await restricoes();
    expect(antes).toHaveLength(2);
    await tx.unsafe(sqlDeRollback(nome));
    expect(await restricoes()).not.toEqual(antes);
    const texto = readFileSync(resolve(base, 'migrations', nome), 'utf8');
    const corpo = texto.match(/^BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/)?.[1];
    if (!corpo) throw new Error('Migration sem transação.');
    await tx.unsafe(corpo);
    expect(await restricoes()).toEqual(antes);
  });
});
