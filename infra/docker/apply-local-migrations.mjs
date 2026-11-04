import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const DB_NAME = 'fsph_compose_dev';
const IDENTITY = 'fsph-compose-local-dev-2026-v1';
const MIGRATIONS = '/workspace/backend/src/database/supabase/migrations';
const SEED = '/workspace/backend/src/database/supabase/seed.sql';

function verifyTarget() {
  if (process.env.NODE_ENV !== 'development' || process.env.FSPH_COMPOSE_MIGRATIONS !== '1') {
    throw new Error('Preparação recusada: contexto Compose local não confirmado.');
  }
  let url;
  try { url = new URL(process.env.DATABASE_URL ?? ''); }
  catch { throw new Error('Preparação recusada: URL inválida.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== 'db' ||
      url.port !== '5432' || url.pathname !== `/${DB_NAME}` || url.username !== 'postgres' ||
      url.search || url.hash) {
    throw new Error('Preparação recusada: o destino não é o banco Docker local esperado.');
  }
  return url.toString();
}

function digest(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

const databaseUrl = verifyTarget();
const client = new pg.Client({ connectionString: databaseUrl, ssl: false, connectionTimeoutMillis: 5000 });
let transaction = false;
let locked = false;
try {
  await client.connect();
  const identity = await client.query(`
    SELECT current_database() AS name,
           shobj_description(oid, 'pg_database') AS marker
    FROM pg_database WHERE datname = current_database()
  `);
  if (identity.rows.length !== 1 || identity.rows[0].name !== DB_NAME ||
      identity.rows[0].marker !== IDENTITY) {
    throw new Error('Identidade do banco Compose não confere. Nenhuma migration aplicada.');
  }

  await client.query('SELECT pg_advisory_lock(2026, 215)');
  locked = true;
  await client.query('BEGIN');
  transaction = true;
  await client.query('CREATE SCHEMA IF NOT EXISTS fsph_compose_meta');
  await client.query(`
    CREATE TABLE IF NOT EXISTS fsph_compose_meta.migrations (
      filename text PRIMARY KEY,
      sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await client.query('COMMIT');
  transaction = false;

  async function apply(filename, content) {
    const hash = digest(content);
    const previous = await client.query(
      'SELECT sha256 FROM fsph_compose_meta.migrations WHERE filename = $1', [filename]
    );
    if (previous.rows.length) {
      if (previous.rows[0].sha256 !== hash) {
        throw new Error(`Arquivo SQL já aplicado foi alterado: ${filename}. Não há reparo automático.`);
      }
      console.log(`Já aplicada: ${filename}`);
      return;
    }
    await client.query('BEGIN');
    transaction = true;
    await client.query(content);
    await client.query(
      'INSERT INTO fsph_compose_meta.migrations(filename, sha256) VALUES ($1, $2)',
      [filename, hash]
    );
    await client.query('COMMIT');
    transaction = false;
    console.log(`Aplicada: ${filename}`);
  }

  const files = (await readdir(MIGRATIONS)).filter(name => /^\d{14}_[\w-]+\.sql$/.test(name)).sort();
  if (!files.length || !files.some(name => name.includes('baseline'))) {
    throw new Error('Baseline versionada ausente; preparação recusada.');
  }
  const sources = await Promise.all(files.map(async filename => ({filename,content:await readFile(resolve(MIGRATIONS,filename),'utf8')})));
  sources.push({filename:'__seed_fixture_v1.sql',content:await readFile(SEED,'utf8')});
  // Valida todo o historico antes de qualquer migration pendente.
  for (const {filename,content} of sources) {
    const previous = await client.query('SELECT sha256 FROM fsph_compose_meta.migrations WHERE filename = $1',[filename]);
    if (previous.rows.length && previous.rows[0].sha256 !== digest(content)) {
      throw new Error('Arquivo SQL ja aplicado foi alterado: ' + filename + '. Nao ha reparo automatico.');
    }
  }
  for (const {filename,content} of sources) await apply(filename,content);

  console.log('Banco Compose local preparado. Nenhuma conexão remota foi utilizada.');
} catch (error) {
  if (transaction) await client.query('ROLLBACK').catch(() => {});
  console.error(error instanceof Error ? error.message : 'Erro na preparação Compose.');
  process.exitCode = 1;
} finally {
  try { if (locked) await client.query('SELECT pg_advisory_unlock(2026, 215)'); }
  finally { await client.end().catch(() => {}); }
}
