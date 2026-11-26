import { execFileSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import postgres from 'postgres';

export const root = fileURLToPath(new URL('../../../../', import.meta.url));
/** Perfil fechado: valores externos nunca definem o destino ou a identidade. */
const selectedProfile = process.env.FSPH_TEST_PROFILE ?? 't1';
const s10Profiles = {
  's10-candidata-clean': '55527', 's10-candidata-e2e': '55528',
  's10-consolidada-clean': '55525', 's10-consolidada-upgrade': '55526',
  's10-integracao-fk-final': '55524',
  's10-clean': '55510', 's10-upgrade': '55511', 's10-rollback': '55512',
  's10-integracao-clean': '55520', 's10-integracao-upgrade': '55521', 's10-integracao-rollback': '55522', 's10-integracao-fresh': '55523',
} as const;
export const isS10 = Object.hasOwn(s10Profiles, selectedProfile);
if (!isS10 && selectedProfile !== 't1' && selectedProfile !== 's9' && selectedProfile !== 's9-full' && selectedProfile !== 's9-full-repro' && selectedProfile !== 's9-mig-v3' && selectedProfile !== 's9-integracao-segura' && selectedProfile !== 's9-conciliacao-final') throw new Error('Perfil de teste desconhecido.');
export const testProfile = selectedProfile;
const usesDedicatedContainer = testProfile !== 't1';
export const testPort = isS10 ? s10Profiles[testProfile as keyof typeof s10Profiles] : testProfile === 's9-conciliacao-final' ? '55501' : testProfile === 's9-integracao-segura' ? '55499' : testProfile === 's9-mig-v3' ? '55498' : testProfile === 's9-full-repro' ? '55496' : testProfile === 's9-full' ? '55495' : usesDedicatedContainer ? '55494' : '55432';
export const project = isS10 ? 'fsph-' + testProfile + '-2026' : testProfile === 's9-conciliacao-final' ? 'fsph-s9-conciliacao-final-2026' : testProfile === 's9-integracao-segura' ? 'fsph-s9-integracao-segura-2026' : testProfile === 's9-mig-v3' ? 'fsph-s9-mig-v3-2026' : testProfile === 's9-full-repro' ? 'fsph-s9-full-repro-2026' : testProfile === 's9-full' ? 'fsph-s9-full-2026' : usesDedicatedContainer ? 'fsph-s9-conciliacao-2026' : 'fsph-t1-isolated-2026';
export const container = usesDedicatedContainer ? project : 'supabase_db_' + project;
export const database = isS10 ? 'fsph_' + testProfile.replaceAll('-', '_') : testProfile === 's9-conciliacao-final' ? 'fsph_s9_conciliacao_final' : testProfile === 's9-integracao-segura' ? 'fsph_s9_integracao_segura' : testProfile === 's9-mig-v3' ? 'fsph_s9_mig_v3' : testProfile === 's9-full-repro' ? 'fsph_s9_full_repro' : testProfile === 's9-full' ? 'fsph_s9_full' : usesDedicatedContainer ? 'fsph_s9_conciliacao' : 'fsph_t1_baseline';
export const testUrl = 'postgresql://postgres:postgres@127.0.0.1:' + testPort + '/' + database;
export const manifestPath = resolve(root, isS10 ? '.test-db/' + testProfile + '.json' : testProfile === 's9-conciliacao-final' ? '.test-db/s9-conciliacao-final.json' : testProfile === 's9-integracao-segura' ? '.test-db/s9-integracao-segura.json' : testProfile === 's9-mig-v3' ? '.test-db/s9-mig-v3.json' : testProfile === 's9-full-repro' ? '.test-db/s9-full-repro.json' : testProfile === 's9-full' ? '.test-db/s9-full.json' : usesDedicatedContainer ? '.test-db/s9-conciliacao.json' : '.test-db/provision.json');
interface Manifest { workspace: string; containerId: string; nonce: string }
interface Inspection {
  Id: string; Name: string; Running: boolean;
  Labels: Record<string, string>; Ports: Record<string, { HostPort: string }[]>;
}

let localDockerHost: string | undefined;

/** Executa comandos locais sem shell e sem herdar URLs/segredos de banco. */
export function command(file: string, args: string[], input?: string) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(DATABASE_URL|PG|SUPABASE_)/i.test(key)) delete env[key];
  }
  const options = { cwd: root, encoding: 'utf8', env, input, stdio: 'pipe' } as const;
  if (isS10 && file === 'docker') {
    if (process.env.DOCKER_HOST) throw new Error('DOCKER_HOST externo ao contexto recusado para a Sprint 10.');
    if (!localDockerHost) {
      const context = execFileSync(file, ['context', 'show'], options).trim();
      const endpoint = execFileSync(file, ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}', context], options).trim();
      if (!/^npipe:\/\/\/\/\.\/pipe\/[a-z0-9_.-]+$/i.test(endpoint) && !/^unix:\/\/\/[^\r\n]+$/.test(endpoint)) {
        throw new Error('O contexto Docker da Sprint 10 precisa apontar para um socket local.');
      }
      localDockerHost = endpoint;
    }
    delete env.DOCKER_CONTEXT;
    args = ['--host', localDockerHost, ...args];
  }
  return execFileSync(file, args, options);
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

interface S9Manifest extends Manifest {
  project: string; container: string; volume: string; database: string; port: string;
  marker: string; imageId: string;
}
interface S9Container {
  Id: string; Name: string; Image: string; State: {Running: boolean};
  Config: {Labels: Record<string,string>};
  Mounts: {Type:string; Name:string; Destination:string; RW:boolean}[];
  NetworkSettings: {Ports:Record<string,{HostPort:string;HostIp:string}[]>};
}
interface S9Volume {Name:string; Driver:string; Scope:string; Labels:Record<string,string>}

/** Confere container, volume e manifesto dedicados antes de conectar. */
function verifyDedicatedContainer(manifest: S9Manifest): Manifest {
  const info = isS10
    ? JSON.parse(command('docker', ['inspect', '--format',
      '{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Image}},"State":{"Running":{{json .State.Running}}},"Config":{"Labels":{{json .Config.Labels}}},"Mounts":{{json .Mounts}},"NetworkSettings":{{json .NetworkSettings}}}',
      container])) as S9Container
    : JSON.parse(command('docker',['inspect',container]))[0] as S9Container;
  if (isS10) {
    const networks = JSON.parse(command('docker', ['inspect', '--format', '{{json .NetworkSettings.Networks}}', container])) as Record<string, { NetworkID: string }>;
    const [network] = JSON.parse(command('docker', ['network', 'inspect', project]));
    if (Object.keys(networks).length !== 1 || networks[project]?.NetworkID !== network.Id ||
        network.Name !== project || network.Driver !== 'bridge' || network.Scope !== 'local' ||
        network.Labels?.['fsph.project'] !== project ||
        network.Labels?.['fsph.workspace'] !== info.Config.Labels['fsph.workspace'] ||
        network.Labels?.['fsph.nonce'] !== manifest.nonce ||
        Object.keys(info.NetworkSettings.Ports).length !== 1 ||
        !/^sha256:[a-f0-9]{64}$/.test(manifest.imageId)) {
      throw new Error('Rede, imagem ou publicação Docker Sprint 10 divergente.');
    }
  }
  const volume = JSON.parse(command('docker',['volume','inspect',project]))[0] as S9Volume;
  return validateS9Identity(manifest, info, volume);
}

/** Valida identidades já inspecionadas sem abrir conexão. */
export function validateS9Identity(manifest: S9Manifest, info: S9Container, volume: S9Volume): Manifest {
  const hash = createHash('sha256').update(realpathSync(root).toLowerCase()).digest('hex');
  const ports = info.NetworkSettings?.Ports?.['5432/tcp'];
  const mounts = info.Mounts?.filter(m => m.Type === 'volume' && m.Name === project && m.Destination === '/var/lib/postgresql/data');
  if (manifest.workspace !== root || manifest.project !== project || manifest.container !== container ||
      manifest.volume !== project || manifest.database !== database || manifest.port !== testPort ||
      !/^[a-f0-9]{64}$/.test(manifest.containerId) || !/^[a-f0-9-]{36}$/.test(manifest.nonce) ||
      manifest.marker !== project + ':' + manifest.nonce || info.Id !== manifest.containerId ||
      info.Name !== '/' + container || !info.State?.Running || info.Image !== manifest.imageId ||
      info.Config?.Labels?.['fsph.project'] !== project || info.Config.Labels['fsph.workspace'] !== hash ||
      info.Config.Labels['fsph.nonce'] !== manifest.nonce || volume.Name !== project ||
      volume.Driver !== 'local' || volume.Scope !== 'local' || volume.Labels?.['fsph.project'] !== project ||
      volume.Labels['fsph.workspace'] !== hash || volume.Labels['fsph.nonce'] !== manifest.nonce ||
      mounts?.length !== 1 || !mounts[0].RW || !ports?.length ||
      !ports.every(p => p.HostPort === testPort && p.HostIp === '127.0.0.1')) {
    throw new Error('Identidade Docker isolada não confere; nenhuma escrita autorizada.');
  }
  return manifest;
}
/** Confirma proveniência Docker e vínculo ao checkout antes de conectar. */
export function verifyContainer(): Manifest {
  assertTarget(process.env.DATABASE_URL);
  let manifest: Manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch { throw new Error('Identidade isolada ausente. Execute npm run db:test:start.'); }
  if (usesDedicatedContainer) return verifyDedicatedContainer(manifest as S9Manifest);
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
