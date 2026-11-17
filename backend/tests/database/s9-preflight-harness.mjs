import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import postgres from 'postgres';

export const root=fileURLToPath(new URL('../../../',import.meta.url));
export const project='fsph-s9-preflight-2026';
export const container=project;
export const volume=project;
export const database='fsph_s9_preflight';
export const port='55492';
export const manifestPath=resolve(root,'.test-db/s9-preflight.json');
export const testUrl='postgresql://postgres:postgres@127.0.0.1:'+port+'/'+database;
export const workspaceHash=createHash('sha256').update(realpathSync(root).toLowerCase()).digest('hex');

/** Executa Docker sem transmitir variaveis de conexao do desenvolvedor. */
export function docker(args){
  const env={...process.env};
  for(const key of Object.keys(env))if(/^(DATABASE_URL|PG|SUPABASE_)/i.test(key))delete env[key];
  return execFileSync('docker',args,{cwd:root,encoding:'utf8',env,stdio:['pipe','pipe','pipe']}).trim();
}

/** Comprova manifesto, identificador, labels, volume e bind local antes de conectar. */
export function verifyContainer(){
  if(process.env.DATABASE_URL!==undefined && process.env.DATABASE_URL!==testUrl)throw new Error('Alvo recusado.');
  let m;try{m=JSON.parse(readFileSync(manifestPath,'utf8'));}catch{throw new Error('Manifesto Sprint 9 ausente.');}
  const info=JSON.parse(docker(['inspect',container]))[0];
  const disco=JSON.parse(docker(['volume','inspect',volume]))[0];
  return validarIdentidade(m,info,disco);
}

/** Valida todos os elementos da identidade sem abrir conexao. */
export function validarIdentidade(m,info,disco){
  const portas=info.NetworkSettings?.Ports?.['5432/tcp'];
  const mount=info.Mounts?.filter(x=>x.Type==='volume' && x.Name===volume && x.Destination==='/var/lib/postgresql/data');
  const labels=info.Config?.Labels,vl=disco.Labels;
  if(m.workspace!==root || m.project!==project || m.container!==container || m.volume!==volume || m.database!==database || m.port!==port ||
    !/^[a-f0-9]{64}$/.test(m.containerId) || !/^[a-f0-9-]{36}$/.test(m.nonce) || m.marker!==project+':'+m.nonce ||
    info.Id!==m.containerId || info.Name!=='/'+container || !info.State?.Running || info.Image!==m.imageId ||
    labels?.['fsph.project']!==project || labels?.['fsph.workspace']!==workspaceHash || labels?.['fsph.nonce']!==m.nonce ||
    disco.Name!==volume || disco.Driver!=='local' || disco.Scope!=='local' || vl?.['fsph.project']!==project || vl?.['fsph.workspace']!==workspaceHash || vl?.['fsph.nonce']!==m.nonce ||
    mount?.length!==1 || !mount[0].RW || !portas?.length || !portas.every(p=>p.HostPort===port && p.HostIp==='127.0.0.1')) {
    throw new Error('Identidade Docker Sprint 9 divergente.');
  }
  return m;
}

/** Abre apenas o alvo fixo e confirma o marcador antes de devolver a conexao. */
export async function verifiedSql(){
  const m=verifyContainer();
  const sql=postgres(testUrl,{max:1,ssl:false,connect_timeout:5});
  try{
    const [identity]=await sql`SELECT current_database() AS name,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()`;
    if(identity?.name!==database || identity.marker!==m.marker)throw new Error('Marcador de banco Sprint 9 divergente.');
    return sql;
  }catch(error){await sql.end();throw error;}
}
