import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
function probe(profile: string | undefined, code: string) {
  const env: Record<string,string> = {};
  for (const key of ['PATH','Path','SystemRoot','TEMP','TMP']) if (process.env[key]) env[key] = process.env[key]!;
  if (profile !== undefined) env.FSPH_TEST_PROFILE=profile;
  return execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',code],{cwd:root,env,encoding:'utf8',stdio:['ignore','pipe','pipe']});
}
const modulePath = './backend/src/database/scripts/verify-test-db.ts';
test('sem perfil mantém a identidade original',()=>{
  const result=probe(undefined,`import {project,database,testProfile} from '${modulePath}'; console.log(project,database,testProfile)`);
  expect(result.trim()).toBe('fsph-t1-isolated-2026 fsph_t1_baseline t1');
});
test('perfil Sprint 9 seleciona somente a identidade prevista',()=>{
  const result=probe('s9',`import {project,database,testProfile} from '${modulePath}'; console.log(project,database,testProfile)`);
  expect(result.trim()).toBe('fsph-s9-conciliacao-2026 fsph_s9_conciliacao s9');
});
test('perfil de suíte completa usa identidade exclusiva',()=>{
  const result=probe('s9-full',`import {project,database,testProfile,testUrl,manifestPath} from '${modulePath}'; import {basename} from 'node:path'; console.log(project,database,testProfile,new URL(testUrl).port,basename(manifestPath))`);
  expect(result.trim()).toBe('fsph-s9-full-2026 fsph_s9_full s9-full 55495 s9-full.json');
});
test('perfil reproduzível usa identidade exclusiva sem reutilizar s9-full',()=>{
  const result=probe('s9-full-repro',`import {project,database,testProfile,testUrl,manifestPath} from '${modulePath}'; import {basename} from 'node:path'; console.log(project,database,testProfile,new URL(testUrl).port,basename(manifestPath))`);
  expect(result.trim()).toBe('fsph-s9-full-repro-2026 fsph_s9_full_repro s9-full-repro 55496 s9-full-repro.json');
});
test('perfil de migrations usa identidade exclusiva',()=>{
  const result=probe('s9-mig-v3',`import {project,database,testProfile,testUrl,manifestPath} from '${modulePath}'; import {basename} from 'node:path'; console.log(project,database,testProfile,new URL(testUrl).port,basename(manifestPath))`);
  expect(result.trim()).toBe('fsph-s9-mig-v3-2026 fsph_s9_mig_v3 s9-mig-v3 55498 s9-mig-v3.json');
});
test('perfil da integração segura usa identidade exclusiva',()=>{
  const result=probe('s9-integracao-segura',`import {project,database,testProfile,testUrl,manifestPath} from '${modulePath}'; import {basename} from 'node:path'; console.log(project,database,testProfile,new URL(testUrl).port,basename(manifestPath))`);
  expect(result.trim()).toBe('fsph-s9-integracao-segura-2026 fsph_s9_integracao_segura s9-integracao-segura 55499 s9-integracao-segura.json');
});
test('perfil de conciliação final usa identidade exclusiva',()=>{
  const result=probe('s9-conciliacao-final',`import {project,database,testProfile,testUrl,manifestPath} from '${modulePath}'; import {basename} from 'node:path'; console.log(project,database,testProfile,new URL(testUrl).port,basename(manifestPath))`);
  expect(result.trim()).toBe('fsph-s9-conciliacao-final-2026 fsph_s9_conciliacao_final s9-conciliacao-final 55501 s9-conciliacao-final.json');
});
test('perfil desconhecido é recusado antes de qualquer conexão',()=>{
  expect(()=>probe('desconhecido',`await import('${modulePath}')`)).toThrow();
});
test.each(['t1','s9','s9-full','s9-full-repro','s9-mig-v3','s9-integracao-segura','s9-conciliacao-final'])('perfil %s recusa alvo arbitrário antes de conectar',profile=>{
  const code=`import {assertTarget,testUrl} from '${modulePath}'; assertTarget(testUrl); try {assertTarget('postgresql://example.invalid/production'); throw new Error('aceitou alvo');} catch(e) {if (!String(e).includes('Alvo recusado')) throw e;} console.log('recusado')`;
  expect(probe(profile,code).trim()).toBe('recusado');
});
test.each(['s9','s9-full','s9-full-repro','s9-mig-v3','s9-integracao-segura','s9-conciliacao-final'])('perfil %s rejeita alterações de checkout, container, volume, porta e nonce',profile=>{
  const code = `
    import {createHash} from 'node:crypto';
    import {realpathSync} from 'node:fs';
    import {root,project,container,database,testUrl,validateS9Identity} from '${modulePath}';
    const nonce='12345678-1234-1234-1234-123456789abc',id='a'.repeat(64),image='sha256:'+'b'.repeat(64);
    const hash=createHash('sha256').update(realpathSync(root).toLowerCase()).digest('hex'), port=new URL(testUrl).port;
    const labels={'fsph.project':project,'fsph.workspace':hash,'fsph.nonce':nonce};
    const m={workspace:root,project,container,volume:project,database,port,nonce,marker:project+':'+nonce,containerId:id,imageId:image};
    const info={Id:id,Name:'/'+container,Image:image,State:{Running:true},Config:{Labels:labels},Mounts:[{Type:'volume',Name:project,Destination:'/var/lib/postgresql/data',RW:true}],NetworkSettings:{Ports:{'5432/tcp':[{HostPort:port,HostIp:'127.0.0.1'}]}}};
    const vol={Name:project,Driver:'local',Scope:'local',Labels:labels};
    validateS9Identity(m,info,vol);
    for(const mutate of [
      (m,i,v)=>m.workspace='outro', (m,i,v)=>i.Id='c'.repeat(64),
      (m,i,v)=>v.Name='outro', (m,i,v)=>i.NetworkSettings.Ports['5432/tcp'][0].HostPort='55432',
      (m,i,v)=>m.nonce='invalido', (m,i,v)=>m.marker='errado',
      (m,i,v)=>v.Labels['fsph.nonce']='divergente', (m,i,v)=>i.Mounts[0].RW=false
    ]) {
      const x=structuredClone(m),y=structuredClone(info),z=structuredClone(vol);
      mutate(x,y,z);
      let rejected=false;try{validateS9Identity(x,y,z)}catch{rejected=true}
      if(!rejected)throw Error('identidade inválida aceita');
    }
    console.log('recusado');
  `;
  expect(probe(profile,code).trim()).toBe('recusado');
});
