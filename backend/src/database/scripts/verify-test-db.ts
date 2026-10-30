import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import postgres from 'postgres';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
export const project = 'fsph-t1-isolated-2026';
export const container = 'supabase_db_' + project;
export const database = 'fsph_t1_baseline';
export const testUrl = 'postgresql://postgres:postgres@127.0.0.1:55432/' + database;
export const manifestPath = resolve(root, '.test-db/provision.json');

interface Manifest { workspace: string; containerId: string; nonce: string }
interface Inspection {
  Id: string; Name: string; Running: boolean;
  Labels: Record<string, string>; Ports: Record<string, { HostPort: string }[]>;
}

/** Executa comandos locais sem shell e sem herdar URLs/segredos de banco. */
export function command(file: string, args: string[]) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(DATABASE_URL|PG|SUPABASE_)/i.test(key)) delete env[key];
  }
  return execFileSync(file, args, { cwd: root, encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'] });
}

/** Consulta somente identidade, labels e porta; nunca lê ambiente do container. */
export function inspectContainer(): Inspection {
  return JSON.parse(command('docker', ['inspect', '--format',
    '{"Id":{{json .Id}},"Name":{{json .Name}},"Running":{{json .State.Running}},"Labels":{{json .Config.Labels}},"Ports":{{json .NetworkSettings.Ports}}}',
    container]));
}

/** Recusa URL externa antes de abrir pool, inclusive outra instância local. */
export function assertTarget(url: string | undefined) {
  if (url !== undefined && url !== testUrl) {
    throw new Error('Alvo recusado: use somente o banco provisionado por db:test:start.');
  }
}

/** Confirma proveniência Docker e vínculo ao checkout antes de conectar. */
export function verifyContainer(): Manifest {
  assertTarget(process.env.DATABASE_URL);
  let manifest: Manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch { throw new Error('Identidade isolada ausente. Execute npm run db:test:start.'); }
  const info = inspectContainer();
  if (manifest.workspace !== root || !/^[a-f0-9]{64}$/.test(manifest.containerId) ||
      !/^[a-f0-9-]{36}$/.test(manifest.nonce) ||
      info.Id !== manifest.containerId || info.Name !== '/' + container || !info.Running ||
      info.Labels?.['com.supabase.cli.project'] !== project ||
      !info.Ports?.['5432/tcp']?.every(p => p.HostPort === '55432') ||
      !info.Ports?.['5432/tcp']?.length) {
    throw new Error('Identidade Docker isolada não confere; nenhuma escrita autorizada.');
  }
  return manifest;
}

/** Bloqueia bootstrap de teste sem nonce explícito antes de criar pool da aplicação. */
export async function verifyTestEnvironment() {
  if (!process.env.FSPH_TEST_NONCE) throw new Error('Identidade de teste ausente.');
  const manifest = verifyContainer();
  if (process.env.FSPH_TEST_NONCE !== manifest.nonce || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Identidade de teste divergente.');
  }
  const sql = await verifiedSql();
  await sql.end();
}

/** Abre exclusivamente o banco dedicado e confirma seu marcador antes de retornar. */
export async function verifiedSql(administrative = false) {
  const manifest = verifyContainer();
  // Ambos os acessos são fixtures fixas da instância criada pela CLI, nunca segredos existentes.
  const url = administrative ? testUrl.replace('postgres:postgres@', 'supabase_admin:postgres@') : testUrl;
  const sql = postgres(url, { max: 1, ssl: false, connect_timeout: 5 });
  try {
    const [identity] = await sql`select current_database() as name,
      shobj_description(oid, 'pg_database') as marker
      from pg_database where datname = current_database()`;
    if (identity.name !== database || identity.marker !== project + ':' + manifest.nonce) {
      throw new Error('Marcador do banco isolado ausente ou divergente.');
    }
    return sql;
  } catch (error) { await sql.end(); throw error; }
}
