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
const restoreList = '/tmp/' + restored + '.list';
const schemas = ['--schema=public', '--schema=fsph_test_harness'];
const connection = ['--host=/var/run/postgresql', '--username=supabase_admin', '--no-password'];
const docker = (program: string, args: string[]) => command('docker', ['exec', containerId, program, ...args]);
const query = (db: string, sql: string) => docker('psql', [
  ...connection, '--no-psqlrc', '--no-align', '--tuples-only', '--set=ON_ERROR_STOP=1',
  '--dbname=' + db, '--command=' + sql,
]).trim();

function schemaDefinition(db: string) {
  // PostgreSQL pode achatar grupos associativos ao recriar um CHECK.
  // Compare sua definição com a formatação de precedência do próprio servidor.
  const checks = JSON.parse(query(db, `
    SELECT coalesce(jsonb_agg(jsonb_build_array(n.nspname, t.relname, c.conname,
      pg_get_constraintdef(c.oid, true)) ORDER BY n.nspname, t.relname, c.conname), '[]'::jsonb)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'c' AND n.nspname IN ('public', 'fsph_test_harness')
  `)) as [string, string, string, string][];
  // O restore pode aplicar o mesmo cast text[] aos dois literais individualmente.
  const vinculo = checks.find(([schema, table, name]) =>
    schema === 'public' && table === 'veiculo' && name === 'veiculo_vinculo_check');
  if (vinculo?.[3] === "CHECK (vinculo::text = ANY (ARRAY['PROPRIO'::character varying, 'LOCADO'::character varying]::text[]))") {
    vinculo[3] = "CHECK (vinculo::text = ANY (ARRAY['PROPRIO'::character varying::text, 'LOCADO'::character varying::text]))";
  }
  const dump = docker('pg_dump', [...connection, ...schemas, '--schema-only', '--dbname=' + db])
    .split(/\r?\n/)
    .filter(line => !/^\\(?:un)?restrict /.test(line))
    .map(line => line.replace(/^(\s*CONSTRAINT .*? CHECK) \(.*\)(,?)$/, '$1 (definicao_comparada_no_catalogo)$2')
      .replace(/^(ALTER TABLE .* ADD CONSTRAINT .*? CHECK) \(.*\)( NOT VALID)?;$/, '$1 (definicao_comparada_no_catalogo)$2;'));
  const publicAcl = query(db, `
    SELECT grantor::regrole, grantee, privilege_type, is_grantable
    FROM pg_namespace n
    CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner)))
    WHERE n.nspname = 'public'
    ORDER BY 1, 2, 3, 4
  `);
  return { checks, dump, publicAcl };
}

function compareSchema(original: ReturnType<typeof schemaDefinition>, restoredDb: string) {
  const recovered = schemaDefinition(restoredDb);
  assert.deepEqual(recovered.checks, original.checks, 'As restrições CHECK restauradas diferem da origem.');
  assert.equal(recovered.publicAcl, original.publicAcl, 'As permissões do schema public diferem da origem.');
  const firstDifference = original.dump.findIndex((line, index) => line !== recovered.dump[index]);
  assert.ok(firstDifference === -1 && original.dump.length === recovered.dump.length,
    'A definição restaurada diverge da origem: ' + JSON.stringify({
      linha: firstDifference + 1,
      origem: original.dump[firstDifference]?.slice(0, 150),
      destino: recovered.dump[firstDifference]?.slice(0, 150),
      linhasOrigem: original.dump.length,
      linhasDestino: recovered.dump.length,
    }));
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
  // template0 já tem a ACL padrão de public. Preserve essa base e aplique as
  // entradas de proprietário, comentário e ACL que o dump inclui para o schema.
  const entries = docker('pg_restore', ['--list', archive]).split(/\r?\n/);
  const publicSchema = /^\d+;\s+\d+\s+\d+\s+SCHEMA - public\s/;
  assert.equal(entries.filter(line => publicSchema.test(line)).length, 1);
  const list = entries.filter(line => !publicSchema.test(line)).join('\n');
  docker('sh', ['-c', 'printf "%s" "$1" > "$2"', 'restore-list', list, restoreList]);
  docker('pg_restore', [
    ...connection, '--use-list=' + restoreList, '--exit-on-error', '--single-transaction',
    '--dbname=' + restored, archive,
  ]);
  const restoreMs = Math.round(performance.now() - startRestore);

  compareSchema(originalSchema, restored);
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
    docker('rm', ['-f', '--', archive, restoreList]);
  }
}
