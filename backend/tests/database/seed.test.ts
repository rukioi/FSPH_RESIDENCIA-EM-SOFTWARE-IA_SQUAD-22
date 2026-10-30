import { afterAll, beforeAll, expect, test } from 'vitest';
import bcrypt from 'bcrypt';
import { prepare } from '../../src/database/scripts/apply-test-migrations.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { metadataQuery, type Metadata } from '../../src/database/scripts/generate-db-docs.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { sql = await verifiedSql(); });
afterAll(async () => { await sql?.end(); });

test('duas preparações não duplicam nem modificam fixtures, sequências ou migrations', async () => {
  async function snapshot() {
    const [row] = await sql.unsafe(metadataQuery);
    const metadata = row.metadata as Metadata;
    const records: Record<string, unknown> = {};
    for (const table of metadata.tables) {
      records[table.name] = await sql`select to_jsonb(t) as row from ${sql(table.name)} t
        where id between -27099 and -27001 order by id`;
      expect((records[table.name] as unknown[]).length).toBeGreaterThan(0);
    }
    records.migrations = await sql`select * from fsph_test_harness.migrations order by name`;
    for (const sequence of metadata.sequences) {
      records[sequence.name] = await sql`select last_value::text, is_called from ${sql(sequence.name)}`;
    }
    return JSON.parse(JSON.stringify(records));
  }
  await prepare();
  const first = await snapshot();
  await prepare();
  expect(await snapshot()).toEqual(first);
});

test('seed cobre todos os perfis e estados reais, com hash artificial válido', async () => {
  const [row] = await sql.unsafe(metadataQuery);
  const metadata = row.metadata as Metadata;
  for (const [name, table, column] of [
    ['perfil_usuario', 'usuario', 'perfil'], ['status_motorista', 'motorista', 'status'],
    ['status_veiculo', 'veiculo', 'status'], ['tipo_veiculo', 'veiculo', 'tipo'],
    ['status_solicitacao', 'solicitacao_viagem', 'status'],
    ['status_viagem', 'viagem', 'status'], ['status_ordem_coleta', 'ordem_coleta', 'status'],
  ]) {
    const rows = await sql`select distinct ${sql(column)}::text as value from ${sql(table)}
      where id between -27099 and -27001`;
    expect(rows.map(r => r.value).sort()).toEqual([...metadata.enums.find(e => e.name === name)!.values].sort());
  }
  const [user] = await sql`select senha_hash from public.usuario where id = -27001`;
  expect(await bcrypt.compare('T1-fixture-2026!', user.senha_hash)).toBe(true);
});

test('prepare recusa alteração de migration já aplicada sem reaplicar seed ou DDL', async () => {
  const admin = await verifiedSql(true);
  const [applied] = await admin`select name, sha256 from fsph_test_harness.migrations order by name limit 1`;
  try {
    await admin`update fsph_test_harness.migrations set sha256 = 'fixture-divergente'
      where name = ${applied.name}`;
    await expect(prepare()).rejects.toThrow('Migration já aplicada foi alterada');
  } finally {
    await admin`update fsph_test_harness.migrations set sha256 = ${applied.sha256}
      where name = ${applied.name}`;
    await admin.end();
  }
});
