import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { command, root, container, database, project, manifestPath, inspectContainer, assertTarget, verifiedSql, verifyContainer } from './verify-test-db.js';

function provisionDatabase(nonce: string) {
  const existing = command('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atqc',
    "select count(*) from pg_database where datname = '" + database + "'"]).trim();
  if (existing !== '0') return;
  command('docker', ['exec', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-c',
    'CREATE DATABASE ' + database]);
  command('docker', ['exec', container, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-c',
    "COMMENT ON DATABASE " + database + " IS '" + project + ':' + nonce + "'"]);
}

assertTarget(process.env.DATABASE_URL);
if (existsSync(manifestPath)) {
  // Só provisiona o nome fixo em container cuja proveniência já foi comprovada.
  provisionDatabase(verifyContainer().nonce);
  const sql = await verifiedSql();
  await sql.end();
  console.log('Banco isolado já provisionado e verificado.');
} else {
  const containers = command('docker', ['ps', '-a', '--format', '{{.Names}}']).trim().split(/\r?\n/);
  const volumes = command('docker', ['volume', 'ls', '--format', '{{.Name}}']).trim().split(/\r?\n/);
  if (containers.some(n => n.endsWith('_' + project)) || volumes.some(n => n.endsWith('_' + project))) {
    throw new Error('Instância/volume preexistente sem comprovante deste harness; recusado.');
  }
  const binary = resolve(root, 'node_modules/supabase/dist/supabase.js');
  command(process.execPath, [binary, 'start', '--workdir', resolve(root, 'backend/src/database')]);
  const info = inspectContainer();
  if (info.Labels?.['com.supabase.cli.project'] !== project || !info.Running ||
      !info.Ports?.['5432/tcp']?.length || !info.Ports['5432/tcp'].every(p => p.HostPort === '55432')) {
    throw new Error('Provisionamento não comprovado.');
  }
  const existing = command('docker', ['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atqc',
    "select count(*) from pg_database where datname = '" + database + "'"]).trim();
  if (existing !== '0') throw new Error('Banco dedicado já existe sem comprovante; recusado.');
  const nonce = randomUUID();
  provisionDatabase(nonce);
  mkdirSync(resolve(root, '.test-db'), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({ workspace: root, containerId: info.Id, nonce }, null, 2) + '\n');
  const sql = await verifiedSql();
  const [version] = await sql`select version()`;
  await sql.end();
  console.log(project + ' / ' + database + ' / ' + version.version);
}
