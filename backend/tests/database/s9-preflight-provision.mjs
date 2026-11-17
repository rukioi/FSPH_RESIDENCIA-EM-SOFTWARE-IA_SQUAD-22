import { createHash,randomUUID } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { root,project,container,volume,database,port,manifestPath,workspaceHash,docker,verifyContainer,verifiedSql } from './s9-preflight-harness.mjs';

if(existsSync(manifestPath))throw new Error('Manifesto ja existe; provisionamento recusado.');
const nomes=docker(['ps','-a','--format','{{.Names}}']).split(/\r?\n/);
const volumes=docker(['volume','ls','--format','{{.Name}}']).split(/\r?\n/);
if(nomes.includes(container)||volumes.includes(volume) || docker(['ps','-aq','--filter','label=fsph.project='+project]) ||
  docker(['volume','ls','-q','--filter','label=fsph.project='+project]))throw new Error('Recurso preexistente; provisionamento recusado.');
const porta=createServer();
await new Promise((resolvePromise,reject)=>porta.once('error',reject).listen(Number(port),'127.0.0.1',resolvePromise));
await new Promise((resolvePromise,reject)=>porta.close(error=>error?reject(error):resolvePromise()));
const imageId=docker(['image','inspect','postgres:17','--format','{{.Id}}']);
if(!/^sha256:[a-f0-9]{64}$/.test(imageId))throw new Error('Imagem PostgreSQL local nao comprovada.');
const nonce=randomUUID(),marker=project+':'+nonce;
const labels=['--label','fsph.project='+project,'--label','fsph.workspace='+workspaceHash,'--label','fsph.nonce='+nonce];
const volumeCriado=docker(['volume','create',...labels,volume]);
if(volumeCriado!==volume)throw new Error('Volume criado divergente.');
const infoVolume=JSON.parse(docker(['volume','inspect',volume]))[0];
if(infoVolume.Name!==volume || infoVolume.Driver!=='local' || infoVolume.Scope!=='local' ||
  infoVolume.Labels?.['fsph.project']!==project || infoVolume.Labels?.['fsph.workspace']!==workspaceHash ||
  infoVolume.Labels?.['fsph.nonce']!==nonce)throw new Error('Identidade do volume nao comprovada.');
const containerId=docker(['run','-d','--name',container,...labels,'-p','127.0.0.1:'+port+':5432',
  '-v',volume+':/var/lib/postgresql/data','-e','POSTGRES_USER=postgres','-e','POSTGRES_PASSWORD=postgres',
  '-e','POSTGRES_DB='+database,imageId]);
if(!/^[a-f0-9]{64}$/.test(containerId))throw new Error('Identificador Docker invalido.');
mkdirSync(resolve(root,'.test-db'),{recursive:true});
writeFileSync(manifestPath,JSON.stringify({workspace:root,project,container,volume,database,port,nonce,marker,containerId,imageId},null,2)+'\n',{flag:'wx',mode:0o600});
verifyContainer();
let pronto=false;
for(let i=0;i<60;i++){
  verifyContainer();
  try{docker(['exec',container,'pg_isready','-U','postgres','-d',database]);pronto=true;break;}catch{await delay(1000);}
}
if(!pronto)throw new Error('PostgreSQL nao ficou pronto. Recursos preservados para inspecao.');
// Bootstrap inicial somente dentro do container identificado, antes do primeiro teste.
verifyContainer();
docker(['exec','-e','PGPASSWORD=postgres',container,'psql','-v','ON_ERROR_STOP=1','-U','postgres','-d',database,
  '-c',"COMMENT ON DATABASE "+database+" IS '"+marker+"'"]);
const sql=await verifiedSql();
try{
  const [conexoes]=await sql`SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`;
  if(conexoes.total!==0)throw new Error('Conexoes concorrentes no banco dedicado.');
  const [objetos]=await sql`SELECT count(*)::int AS total FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')`;
  if(objetos.total!==0)throw new Error('Banco dedicado nao esta vazio.');
  for(const role of ['anon','authenticated','service_role','supabase_admin'])await sql.unsafe('CREATE ROLE '+role);
  await sql`CREATE SCHEMA fsph_test_harness`;
  await sql`CREATE TABLE fsph_test_harness.migrations (name text PRIMARY KEY,sha256 text NOT NULL)`;
  const diretorio=resolve(root,'backend/src/database/supabase/migrations');
  const nomes=readdirSync(diretorio).filter(n=>/^\d+_[a-z0-9_-]+\.sql$/.test(n)).sort();
  if(nomes.length===0)throw new Error('Nenhuma migration versionada encontrada.');
  const versoes=nomes.map(n=>n.split('_')[0]);
  if(new Set(versoes).size!==versoes.length)throw new Error('Versoes duplicadas; nenhuma migration aplicada.');
  for(const nome of nomes){
    const origem=readFileSync(resolve(diretorio,nome),'utf8').replaceAll('\r\n','\n');
    const hash=createHash('sha256').update(origem).digest('hex');
    await sql.begin(async tx=>{await tx.unsafe(origem);await tx`INSERT INTO fsph_test_harness.migrations (name,sha256) VALUES (${nome},${hash})`;});
  }
  console.log('Banco exclusivo provisionado. Migrations versionadas aplicadas sem seed:',nomes.length);
}finally{await sql.end();}
