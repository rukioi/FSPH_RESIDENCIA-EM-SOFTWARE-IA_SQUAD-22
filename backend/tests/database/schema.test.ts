import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { canonical, metadataQuery, generate, type Metadata } from '../../src/database/scripts/generate-db-docs.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { sql = await verifiedSql(); });
afterAll(async () => { await sql?.end(); });

test('reconstrói o snapshot completo auditado, incluindo ACL/RLS e tipos exatos', async () => {
  const expected = JSON.parse(readFileSync(resolve(root, 'docs/database/schema-metadata.json'), 'utf8')) as Metadata;
  const [row] = await sql.unsafe(metadataQuery);
  const metadata = canonical(row.metadata as Metadata);
  expect(metadata).toEqual(expected);
  expect(metadata.tables).toHaveLength(10);
  expect(metadata.columns).toHaveLength(99);
  expect(metadata.enums).toHaveLength(7);
  expect(metadata.indexes).toHaveLength(19);
  expect(metadata.constraints).toHaveLength(36);
  expect(metadata.triggers).toEqual([]);
  expect(metadata.policies).toEqual([]);
  expect(metadata.tables.every(t => !t.rls && !t.forceRls)).toBe(true);
  expect(metadata.constraints.find(c => c.name === 'veiculo_vinculo_check')?.validated).toBe(true);
  expect(metadata.constraints.filter(c => c.table === 'log_atividade' && c.type === 'f').map(c => c.onDelete).sort()).toEqual(['a', 'n']);
  expect(metadata.columns.find(c => c.name === 'litragem')?.type).toBe('numeric(10,2)');
});

test('a geração detecta drift de privilégio e volta a passar após restauração', async () => {
  await generate(true);
  try {
    await sql`revoke select on public.usuario from anon`;
    await expect(generate(true)).rejects.toThrow('Drift estrutural');
  } finally {
    await sql`grant select on public.usuario to anon`;
  }
  await generate(true);
});

test('grants locais reproduzem exposição auditada sem consultar dados reais', async () => {
  const [access] = await sql`select has_table_privilege('anon', 'public.usuario', 'SELECT') as read,
    has_table_privilege('authenticated', 'public.usuario', 'UPDATE') as write`;
  expect(access).toEqual({ read: true, write: true });
});
