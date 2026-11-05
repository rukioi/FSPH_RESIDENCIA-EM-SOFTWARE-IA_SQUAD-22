import {beforeEach,expect,test,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const mocks=vi.hoisted(()=>({verifiedSql:vi.fn(),events:[] as string[],history:[] as {name:string;sha256:string}[],failure:''}));
vi.mock('../../src/database/scripts/verify-test-db.js',()=>({root:process.cwd(),verifiedSql:mocks.verifiedSql}));
import {prepare} from '../../src/database/scripts/apply-test-migrations.js';
const directory=resolve('backend/src/database/supabase/migrations');
const migrations=readdirSync(directory).filter(name=>/^\d+_[a-z0-9_-]+\.sql$/.test(name)).sort().map(name=>({
  name,source:readFileSync(resolve(directory,name),'utf8').replaceAll('\r\n','\n'),
}));
beforeEach(()=>{
  mocks.events=[];mocks.history=[];mocks.failure='';mocks.verifiedSql.mockReset();
  const connection=Object.assign(async(parts:TemplateStringsArray)=>{
    const query=parts.join('?');
    if(['begin','commit','rollback'].includes(query))mocks.events.push(query);
    if(query.includes('pg_advisory_lock'))mocks.events.push('lock');
    if(query.includes('pg_advisory_unlock'))mocks.events.push('unlock');
    return query.includes('select name, sha256')?mocks.history:[];
  },{
    unsafe:async(source:string)=>{
        const migration=migrations.find(item=>item.source===source);
        const operation=migration?.name??'seed';mocks.events.push(operation);
        if(mocks.failure===operation)throw new Error('Falha sintética');
    },
    release:async()=>{mocks.events.push('release');},
  });
  mocks.verifiedSql.mockResolvedValue({reserve:async()=>connection,end:async()=>{mocks.events.push('end');}});
});
test('migration de enum confirma antes do seed e lock de sessão permanece entre transações',async()=>{
  await prepare();
  expect(mocks.verifiedSql).toHaveBeenCalledWith(true);
  expect(mocks.events[0]).toBe('lock');
  for(const migration of migrations){
    const position=mocks.events.indexOf(migration.name);
    expect(mocks.events[position-1]).toBe('begin');expect(mocks.events[position+1]).toBe('commit');
  }
  const seed=mocks.events.indexOf('seed');
  expect(seed).toBeGreaterThan(mocks.events.indexOf('20261104000001_add_status_aprovada.sql')+1);
  expect(mocks.events.slice(-4)).toEqual(['commit','unlock','release','end']);
});
test('histórico íntegro pula DDL já aplicada e executa seed em nova transação',async()=>{
  mocks.history=migrations.map(item=>({name:item.name,sha256:createHash('sha256').update(item.source).digest('hex')}));
  await prepare();
  expect(migrations.some(item=>mocks.events.includes(item.name))).toBe(false);expect(mocks.events).toContain('seed');
});
test('hash divergente é recusado antes de qualquer migration pendente ou seed',async()=>{
  mocks.history=[{name:migrations.at(-1)!.name,sha256:'divergente'}];
  await expect(prepare()).rejects.toThrow('Migration já aplicada foi alterada');
  expect(migrations.some(item=>mocks.events.includes(item.name))).toBe(false);expect(mocks.events).not.toContain('seed');
  expect(mocks.events.slice(-3)).toEqual(['unlock','release','end']);
});
test('falha em migration impede seed e libera a conexão/lock após rollback',async()=>{
  mocks.failure='20261104000001_add_status_aprovada.sql';
  await expect(prepare()).rejects.toThrow('Falha sintética');
  expect(mocks.events).not.toContain('seed');expect(mocks.events.slice(-4)).toEqual(['rollback','unlock','release','end']);
});
