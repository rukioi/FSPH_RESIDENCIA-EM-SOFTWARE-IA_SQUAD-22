import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { command, database, root, verifiedSql, verifyContainer } from './verify-test-db.js';

const { containerId } = verifyContainer();
const supabase = resolve(root, 'backend/src/database/supabase');
const migrations = readdirSync(resolve(supabase, 'migrations'))
  .filter(name => /^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort().map(name => {
    const sql = readFileSync(resolve(supabase, 'migrations', name), 'utf8').replaceAll('\r\n', '\n');
    return { name, sql, sha256: createHash('sha256').update(sql).digest('hex') };
  });
const source = await verifiedSql(true);
try {
  const history = await source<{ name: string; sha256: string }[]>`
    SELECT name, sha256 FROM fsph_test_harness.migrations ORDER BY name COLLATE "C"
  `;
  assert.ok(migrations.length > 0, 'Nenhuma migration encontrada.');
  assert.deepEqual([...history], migrations.map(({ name, sha256 }) => ({ name, sha256 })),
    'Execute db:test:prepare antes do ensaio.');
} finally {
  await source.end();
}

const suffix = randomUUID().replaceAll('-', '');
const restored = 'fsph_s10_restore_' + suffix;
const legacy = 'fsph_s10_legacy_' + suffix;
const archive = '/tmp/' + restored + '.dump';
const restoreList = '/tmp/' + restored + '.list';
const schemas = ['--schema=public', '--schema=fsph_test_harness'];
const connection = ['--host=/var/run/postgresql', '--username=supabase_admin', '--no-password'];
const docker = (program: string, args: string[], input?: string) =>
  command('docker', ['exec', ...(input === undefined ? [] : ['-i']), containerId, program, ...args], input);
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
function fingerprints(db: string, legacyProjection = false) {
  const tables = query(db, `
    SELECT schemaname || '.' || tablename FROM pg_catalog.pg_tables
    WHERE schemaname IN ('public', 'fsph_test_harness')
    ORDER BY schemaname, tablename
  `).split(/\r?\n/);
  return Object.fromEntries(tables.map(table => {
    assert.match(table, /^(public|fsph_test_harness)\.[a-z_][a-z0-9_]*$/);
    const projection = legacyProjection && table === 'public.abastecimento'
      ? "to_jsonb(row_data) - 'criado_por_id'" : 'to_jsonb(row_data)';
    const result = query(db, `
      SELECT count(*) || '|' || encode(sha256(convert_to(
        coalesce(string_agg(digest, '' ORDER BY digest), ''), 'UTF8')), 'hex')
      FROM (SELECT encode(sha256(convert_to((${projection})::text, 'UTF8')), 'hex') AS digest
        FROM ${table} AS row_data) AS rows
    `);
    return [table, result];
  }));
}

function transaction(db: string, sql: string) {
  docker('psql', [...connection, '--no-psqlrc', '--set=ON_ERROR_STOP=1',
    '--dbname=' + db, '--single-transaction', '--file=-'], sql);
}

function applyMigrations(db: string, entries: typeof migrations) {
  for (const { name, sql, sha256 } of entries) {
    // Nome e hash vêm apenas do manifesto local validado acima.
    transaction(db, sql + `\nINSERT INTO fsph_test_harness.migrations VALUES ('${name}', '${sha256}');`);
  }
}

function backup(db: string) {
  const started = performance.now();
  docker('pg_dump', [...connection, ...schemas, '--format=custom', '--file=' + archive, '--dbname=' + db]);
  return Math.round(performance.now() - started);
}

function restore() {
  const startRestore = performance.now();
  // template0 já tem a ACL padrão de public. Preserve essa base e aplique as
  // entradas de proprietário, comentário e ACL que o dump inclui para o schema.
  const entries = docker('pg_restore', ['--list', archive]).split(/\r?\n/);
  const publicSchema = /^\d+;\s+\d+\s+\d+\s+SCHEMA - public\s/;
  const list = entries.filter(line => !publicSchema.test(line)).join('\n');
  docker('sh', ['-c', 'printf "%s" "$1" > "$2"', 'restore-list', list, restoreList]);
  docker('pg_restore', [
    ...connection, '--use-list=' + restoreList, '--exit-on-error', '--single-transaction',
    '--dbname=' + restored, archive,
  ]);
  return Math.round(performance.now() - startRestore);
}

function withTestDatabase(db: string, run: () => void) {
  docker('createdb', [...connection, '--template=template0', db]);
  try {
    run();
  } finally {
    docker('dropdb', [...connection, db]);
  }
}

function verifyRecovery(db: string, checkUpgrade?: () => void) {
  const before = fingerprints(db);
  assert.match(before['public.usuario'] ?? '', /^[1-9]\d*\|/, 'O ensaio exige dados sintéticos.');
  const originalSchema = schemaDefinition(db);
  const backupMs = backup(db);
  checkUpgrade?.();

  withTestDatabase(restored, () => {
    const restoreMs = restore();
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
  });
}

function rehearseUpgrade() {
  const revision = '20261111000000_add_tipo_evento_log_atividade.sql';
  const cutoff = migrations.findIndex(({ name }) => name === revision) + 1;
  const approval = migrations.findIndex(({ name }) => name === '20261104000001_add_status_aprovada.sql');
  assert.ok(approval > 0 && approval < cutoff && cutoff < migrations.length, 'Verifique as revisões no manifesto.');
  const pending = migrations.slice(cutoff);
  transaction(legacy, `
    CREATE SCHEMA fsph_test_harness;
    CREATE TABLE fsph_test_harness.migrations (name text PRIMARY KEY, sha256 text NOT NULL);
  `);
  applyMigrations(legacy, migrations.slice(0, approval));
  transaction(legacy, `
    INSERT INTO public.solicitacao_viagem
      (id, codigo, origem, destino, data_hora_saida, status)
    VALUES (-20401, 'S10-204-ENUM', 'Origem fictícia', 'Destino fictício', '2026-01-15 12:00:00', 'PENDENTE');
  `);
  const legacyRequest = 'SELECT to_jsonb(s) FROM public.solicitacao_viagem s WHERE id = -20401';
  const requestBeforeEnum = query(legacy, legacyRequest);
  assert.notEqual(requestBeforeEnum, '');
  applyMigrations(legacy, migrations.slice(approval, approval + 1));
  assert.equal(query(legacy, legacyRequest), requestBeforeEnum, 'A expansão do enum alterou a solicitação legada.');
  assert.equal(query(legacy, "SELECT 'APROVADA'::public.status_solicitacao"), 'APROVADA');
  applyMigrations(legacy, migrations.slice(approval + 1, cutoff));
  transaction(legacy, readFileSync(resolve(supabase, 'seed.sql'), 'utf8'));
  transaction(legacy, readFileSync(resolve(root, 'backend/tests/database/fixtures/scrum-204-legacy-files.sql'), 'utf8'));
  const before = fingerprints(legacy);
  for (const table of ['documento_veiculo', 'abastecimento_comprovante', 'viagem_evidencia']) {
    assert.match(before['public.' + table] ?? '', /^1\|/, 'Fixture de arquivo ausente: ' + table);
  }

  verifyRecovery(legacy, () => {
    applyMigrations(legacy, pending);
    compareSchema(schemaDefinition(database), legacy);
    const after = fingerprints(legacy, true);
    for (const [table, digest] of Object.entries(before)) {
      if (table.startsWith('public.')) assert.equal(after[table], digest, 'Dados legados alterados: ' + table);
    }
    assert.equal(query(legacy, `
      SELECT count(*) FROM public.abastecimento WHERE criado_por_id IS NOT NULL
    `), '0', 'Autoria indevidamente preenchida no legado.');
    for (const table of ['anexo', 'documento_historico', 'anotacao']) {
      assert.match(after['public.' + table] ?? '', /^0\|/, 'A migration não deve copiar dados para ' + table);
    }
    assert.equal(query(legacy, `SELECT count(*) FROM fsph_test_harness.migrations`), String(migrations.length));

    transaction(legacy, `
      INSERT INTO public.abastecimento
        (id, veiculo_id, litragem, valor_total, data_abastecimento, criado_por_id)
      VALUES (-20401, -27001, 12, 72, '2026-01-16', -27002);
    `);
    const beforeRollback = fingerprints(legacy);
    const schemaBeforeRollback = schemaDefinition(legacy);
    const rollback = [
      '20261114000000_db_s9_01_abastecimentos_rf40_validate.sql',
      '20261113000000_db_s9_01_abastecimentos_rf40.sql',
    ].map(name => readFileSync(resolve(supabase, 'rollbacks', name), 'utf8')).join('\n');
    assert.throws(() => transaction(legacy, rollback), /Rollback SCRUM-185 recusado/);
    compareSchema(schemaBeforeRollback, legacy);
    assert.deepEqual(fingerprints(legacy), beforeRollback, 'A recusa do rollback deve preservar inclusive o novo registro.');
    console.log('SCRUM-204 upgrade isolado', JSON.stringify({
      revisaoAnterior: revision,
      migrationsPendentes: pending.map(({ name }) => name),
      tabelasLegadasComparadas: Object.keys(before).filter(table => table.startsWith('public.')).length,
      esquemaFinalConferido: true,
      statusPreservadoNaExpansaoDoEnum: true,
      autoriaLegadaPreservada: true,
      rollbackRecusadoSemPerda: true,
    }));
  });
}

try {
  if (process.argv.includes('--upgrade')) withTestDatabase(legacy, rehearseUpgrade);
  else verifyRecovery(database);
} finally {
  docker('rm', ['-f', '--', archive, restoreList]);
}
