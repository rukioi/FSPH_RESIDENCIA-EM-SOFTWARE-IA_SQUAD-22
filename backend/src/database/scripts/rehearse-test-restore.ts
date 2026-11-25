import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, database, root, verifiedSql, verifyContainer } from './verify-test-db.js';

const { containerId } = verifyContainer();
const source = await verifiedSql(true);
try {
  const directory = resolve(root, 'backend/src/database/supabase/migrations');
  const migrations = readdirSync(directory).filter(name => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort();
  const history = await source<{ name: string }[]>`SELECT name FROM fsph_test_harness.migrations ORDER BY name`;
  assert.ok(migrations.length > 0, 'Nenhuma migration encontrada.');
  assert.deepEqual(history.map(row => row.name).sort(), migrations, 'Execute db:test:prepare antes do ensaio.');
} finally {
  await source.end();
}

const suffix = randomUUID().replaceAll('-', '');
const restored = 'fsph_s10_restore_' + suffix;
const archive = '/tmp/' + restored + '.dump';
const schemas = ['--schema=public', '--schema=fsph_test_harness'];
const connection = ['--host=/var/run/postgresql', '--username=supabase_admin', '--no-password'];
const docker = (program: string, args: string[]) => command('docker', ['exec', containerId, program, ...args]);
const query = (db: string, sql: string) => docker('psql', [
  ...connection, '--no-psqlrc', '--no-align', '--tuples-only', '--set=ON_ERROR_STOP=1',
  '--dbname=' + db, '--command=' + sql,
]).trim();

function schemaDefinition(db: string) {
  return docker('pg_dump', [...connection, ...schemas, '--schema-only', '--dbname=' + db])
    .split(/\r?\n/).filter(line => !/^\\(?:un)?restrict /.test(line)).join('\n');
}

/** Compara contagem e SHA-256 das linhas completas, sem imprimir dados ou depender da ordem física. */
function fingerprints(db: string) {
  const tables = query(db, `
    SELECT schemaname || '.' || tablename FROM pg_catalog.pg_tables
    WHERE schemaname IN ('public', 'fsph_test_harness')
    ORDER BY schemaname, tablename
  `).split(/\r?\n/);
  return Object.fromEntries(tables.map(table => {
    assert.match(table, /^(public|fsph_test_harness)\.[a-z_][a-z0-9_]*$/);
    const result = query(db, `
      SELECT count(*) || '|' || encode(sha256(convert_to(
        coalesce(string_agg(digest, '' ORDER BY digest), ''), 'UTF8')), 'hex')
      FROM (SELECT encode(sha256(convert_to(to_jsonb(row_data)::text, 'UTF8')), 'hex') AS digest
        FROM ${table} AS row_data) AS rows
    `);
    return [table, result];
  }));
}

let created = false;
try {
  const before = fingerprints(database);
  assert.match(before['public.usuario'] ?? '', /^[1-9]\d*\|/, 'Execute db:test:prepare com o seed sintético.');
  const originalSchema = schemaDefinition(database);
  const startBackup = performance.now();
  docker('pg_dump', [...connection, ...schemas, '--format=custom', '--file=' + archive, '--dbname=' + database]);
  const backupMs = Math.round(performance.now() - startBackup);

  docker('createdb', [...connection, '--template=template0', restored]);
  created = true;
  const startRestore = performance.now();
  docker('pg_restore', [
    ...connection, '--clean', '--if-exists', '--exit-on-error', '--single-transaction',
    '--dbname=' + restored, archive,
  ]);
  const restoreMs = Math.round(performance.now() - startRestore);

  assert.equal(schemaDefinition(restored), originalSchema, 'O esquema restaurado difere da origem.');
  assert.deepEqual(fingerprints(restored), before, 'Há divergência no conteúdo restaurado.');
  console.log('SCRUM-204 backup e restore isolados', JSON.stringify({
    postgres: query(restored, 'SHOW server_version'),
    migrations: Number(before['fsph_test_harness.migrations'].split('|')[0]),
    tabelasPublicas: Object.keys(before).filter(table => table.startsWith('public.')).length,
    tabelasComparadas: Object.keys(before).length,
    esquemaIdentico: true,
    contagensESha256Identicos: true,
    backupMs,
    restoreMs,
  }));
} finally {
  try {
    if (created) docker('dropdb', [...connection, restored]);
  } finally {
    docker('rm', ['-f', '--', archive]);
  }
}
