import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { command, root, project, container, database, manifestPath, testPort, assertTarget, testProfile, verifyContainer, verifiedSql } from './verify-test-db.js';
import { prepare } from './apply-test-migrations.js';

if (testProfile !== 's9-full' && testProfile !== 's9-full-repro' && testProfile !== 's9-mig-v3' && testProfile !== 's9-integracao-segura' && testProfile !== 's9-conciliacao-final') throw new Error('Selecione explicitamente um perfil isolado de suíte completa.');
assertTarget(process.env.DATABASE_URL);
if (existsSync(manifestPath)) throw new Error('Manifesto existente; provisionamento recusado.');
const docker = (args:string[]) => command('docker',args).trim();
const names = docker(['ps','-a','--format','{{.Names}}']).split(/\r?\n/);
const volumes = docker(['volume','ls','--format','{{.Name}}']).split(/\r?\n/);
if (names.includes(container) || volumes.includes(project) ||
    docker(['ps','-aq','--filter','label=fsph.project='+project]) ||
    docker(['volume','ls','-q','--filter','label=fsph.project='+project])) {
  throw new Error('Recurso preexistente; provisionamento recusado.');
}
const versions = readdirSync(resolve(root,'backend/src/database/supabase/migrations'))
  .filter(name=>/^\d+_[a-z0-9_-]+\.sql$/.test(name)).map(name=>name.split('_')[0]);
if (!versions.length || new Set(versions).size !== versions.length) throw new Error('Migrations ausentes ou versões duplicadas.');
const listener=createServer();
await new Promise<void>((accept,reject)=>listener.once('error',reject).listen(Number(testPort),'127.0.0.1',accept));
await new Promise<void>((accept,reject)=>listener.close(error=>error?reject(error):accept()));
const imageId=docker(['image','inspect','postgres:17','--format','{{.Id}}']);
if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('Imagem PostgreSQL local não comprovada.');
const nonce=randomUUID(), marker=project+':'+nonce;
const workspaceHash=createHash('sha256').update(realpathSync(root).toLowerCase()).digest('hex');
const labels=['--label','fsph.project='+project,'--label','fsph.workspace='+workspaceHash,'--label','fsph.nonce='+nonce];
if (docker(['volume','create',...labels,project]) !== project) throw new Error('Volume divergente.');
const volume=JSON.parse(docker(['volume','inspect',project]))[0];
if(volume.Name!==project || volume.Driver!=='local' || volume.Scope!=='local' ||
   volume.Labels?.['fsph.project']!==project || volume.Labels?.['fsph.workspace']!==workspaceHash ||
   volume.Labels?.['fsph.nonce']!==nonce) throw new Error('Identidade do volume divergente.');
const containerId=docker(['run','-d','--name',container,...labels,'-p','127.0.0.1:'+testPort+':5432',
  '-v',project+':/var/lib/postgresql/data','-e','POSTGRES_USER=supabase_admin','-e','POSTGRES_PASSWORD=postgres',
  '-e','POSTGRES_DB='+database,imageId]);
if(!/^[a-f0-9]{64}$/.test(containerId)) throw new Error('Identificador Docker inválido.');
mkdirSync(resolve(root,'.test-db'),{recursive:true});
writeFileSync(manifestPath,JSON.stringify({workspace:root,project,container,volume:project,database,port:testPort,nonce,marker,containerId,imageId},null,2)+'\n',{flag:'wx',mode:0o600});
let marked=false;
for(let i=0;i<60;i++) {
  verifyContainer();
  let identity: string;
  try {
    docker(['exec',container,'pg_isready','-U','supabase_admin','-d',database]);
    identity=docker(['exec','-e','PGPASSWORD=postgres',container,'psql','-U','supabase_admin','-d',database,'-Atqc',
      "SELECT current_database() || '|' || COALESCE(shobj_description(oid,'pg_database'),'') || '|' || (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) FROM pg_database WHERE datname=current_database()"]);
  } catch { await delay(1000); continue; }
  if(identity!==database+'||0') throw new Error('Banco inesperado, marcador existente ou conexões concorrentes.');
  verifyContainer();
  docker(['exec','-e','PGPASSWORD=postgres',container,'psql','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d',database,
    '-c',"COMMENT ON DATABASE "+database+" IS '"+marker+"'"]);
  marked=true; break;
}
if(!marked) throw new Error('PostgreSQL não ficou pronto; recursos preservados para inspeção.');
const sql=await verifiedSql(true);
try {
  const [connections]=await sql.unsafe("SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()");
  if(connections.total!==0) throw new Error('Conexões concorrentes no banco dedicado.');
  const [objects]=await sql.unsafe("SELECT count(*)::int AS total FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')");
  if(objects.total!==0) throw new Error('Banco dedicado não está vazio.');
  await sql.unsafe("CREATE ROLE postgres LOGIN BYPASSRLS PASSWORD 'postgres'");
  for(const role of ['anon','authenticated','service_role']) await sql.unsafe('CREATE ROLE '+role);
} finally {await sql.end();}
await prepare();
const admin=await verifiedSql(true);
try {
  await admin.unsafe('GRANT USAGE ON SCHEMA fsph_test_harness TO postgres');
  await admin.unsafe('GRANT SELECT ON fsph_test_harness.migrations TO postgres');
} finally {await admin.end();}
console.log('Banco dedicado preparado com migrations e seed de testes.');