import {afterEach,beforeEach,expect,test,vi} from 'vitest';
const fixture=vi.hoisted(()=>({events:[] as string[],history:new Map<string,string>(),failure:'',identity:true}));
vi.mock('node:fs/promises',()=>({
  readdir:async()=>['20261104000001_enum.sql','20261030000000_baseline.sql'],
  readFile:async(path:string)=>path.endsWith('seed.sql')?'SEED':path.includes('enum')?'ENUM':'BASELINE',
}));
vi.mock('pg',()=>({default:{Client:class {
  async connect() { fixture.events.push('connect'); }
  async end() { fixture.events.push('end'); }
  async query(query:string,args?:string[]) {
    fixture.events.push(query);
    if(query.includes('current_database()'))return {rows:[{name:fixture.identity?'fsph_compose_dev':'wrong',marker:'fsph-compose-local-dev-2026-v1'}]};
    if(query.startsWith('SELECT sha256'))return {rows:fixture.history.has(args![0])?[{sha256:fixture.history.get(args![0])}]:[]};
    if(query===fixture.failure)throw Error('synthetic migration failure');
    return {rows:[]};
  }
}}}));
beforeEach(()=>{
  vi.resetModules();fixture.events=[];fixture.history.clear();fixture.failure='';fixture.identity=true;
  vi.stubEnv('NODE_ENV','development');vi.stubEnv('FSPH_COMPOSE_MIGRATIONS','1');
  vi.stubEnv('DATABASE_URL','postgres://postgres:fixture@db:5432/fsph_compose_dev');
  vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>{process.exitCode=0;vi.unstubAllEnvs();vi.restoreAllMocks();});
async function run() { const modulePath=new URL('../../../infra/docker/apply-local-migrations.mjs',import.meta.url).href;await import(modulePath); }
test('Compose commits each migration before seed and keeps session lock',async()=>{
  await run();
  for(const operation of ['BASELINE','ENUM','SEED']){
    const i=fixture.events.indexOf(operation);expect(i).toBeGreaterThan(0);
    expect(fixture.events[i-1]).toBe('BEGIN');expect(fixture.events[i+2]).toBe('COMMIT');
  }
  expect(fixture.events.indexOf('BASELINE')).toBeLessThan(fixture.events.indexOf('ENUM'));
  expect(fixture.events.indexOf('ENUM')).toBeLessThan(fixture.events.indexOf('SEED'));
  expect(fixture.events.slice(-2)).toEqual(['SELECT pg_advisory_unlock(2026, 215)','end']);
});
test('Compose rejects hash drift before pending SQL',async()=>{
  fixture.history.set('20261104000001_enum.sql','wrong');await run();
  expect(process.exitCode).toBe(1);expect(fixture.events).not.toContain('BASELINE');expect(fixture.events).not.toContain('SEED');
});
test('Compose rolls back failed migration without seed',async()=>{
  fixture.failure='ENUM';await run();expect(process.exitCode).toBe(1);
  expect(fixture.events).toContain('ROLLBACK');expect(fixture.events).not.toContain('SEED');
  expect(fixture.events.slice(-2)).toEqual(['SELECT pg_advisory_unlock(2026, 215)','end']);
});
test('Compose refuses unverified database identity before DDL',async()=>{
  fixture.identity=false;await run();expect(process.exitCode).toBe(1);expect(fixture.events).not.toContain('BEGIN');
});
