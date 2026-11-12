import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import type postgres from 'postgres';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {criarJwt} from '../../src/security/jwt.js';
import {operations} from '../../src/shared/contract/registry.js';

const sql=await verifiedSql();
const server=createApp();
const actors={adm:{id:'7160001',perfil:'ADM'},gestor:{id:'7160002',perfil:'GESTOR_FROTA'},a:{id:'7160003',perfil:'SOLICITANTE_INTERNO'},b:{id:'7160004',perfil:'SOLICITANTE_INTERNO'},motorista:{id:'7160005',perfil:'MOTORISTA'},svo:{id:'7160006',perfil:'ATENDENTE_SVO'}};
const tokens:Record<string,string>={};
const pedidos:string[]=[],ordens:string[]=[],ocorrencias:string[]=[];
let base:string,created=false;
const root='/api/solicitacoes-viagem';
const input={origem:'Fixture Aceite S7',destino:'Unidade',finalidade:'Aceite real isolado',dataHoraSaida:'2099-08-20T08:00:00-03:00',qtdPassageiros:1};
const resources=(pair=1)=>({motoristaId:String(7160100+pair),veiculoId:String(7160200+pair),dataHoraRetornoPrevisto:'2099-08-20T17:00:00-03:00'});

beforeAll(async()=>{
  await sql.begin(async tx=>{
    for(const [name,actor] of Object.entries(actors))await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo)
      VALUES(${actor.id},${'Fixture Aceite '+name},${'s7-aceite-'+name+'@example.invalid'},'sem-login',${actor.perfil},true)`;
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (7160011,'Fixture motorista','aceite-motorista-7160011@example.invalid','fixture','MOTORISTA',true),(7160012,'Fixture motorista','aceite-motorista-7160012@example.invalid','fixture','MOTORISTA',true),(7160013,'Fixture motorista','aceite-motorista-7160013@example.invalid','fixture','MOTORISTA',true),(7160014,'Fixture motorista','aceite-motorista-7160014@example.invalid','fixture','MOTORISTA',true)`;
    for(let n=1;n<=4;n++){
      await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status)
        VALUES(${7160100+n},${7160010+n},'Fixture Aceite',${'ACEITE-'+n},'D','2099-12-31','DISPONIVEL')`;
      await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,is_svo)
        VALUES(${7160200+n},${'S7A00'+n+'X'},'Fixture','Aceite',2026,'PASSEIO','DISPONIVEL',false)`;
    }
  });created=true;
  // Claims antigos de ADM não podem conceder permissão: todos resolvem perfil efetivo no banco.
  for(const [name,actor] of Object.entries(actors))tokens[name]=await criarJwt({id:actor.id,perfil:'ADM'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
});
afterAll(async()=>{
  try{
    if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
    if(created)await sql.begin(async tx=>{
      await tx`DELETE FROM public.ordem_coleta WHERE id=ANY(${ordens}::bigint[])`;
      await tx`DELETE FROM public.solicitacao_obito WHERE id=ANY(${ocorrencias}::bigint[])`;
      await tx`DELETE FROM public.log_atividade WHERE usuario_id=ANY(${Object.values(actors).map(a=>a.id)}::bigint[])`;
      await tx`DELETE FROM public.notificacao WHERE viagem_id IN (SELECT id FROM public.viagem WHERE solicitacao_id=ANY(${pedidos}::bigint[]))`;
      await tx`DELETE FROM public.viagem WHERE solicitacao_id=ANY(${pedidos}::bigint[])`;
      await tx`DELETE FROM public.solicitacao_viagem WHERE id=ANY(${pedidos}::bigint[])`;
      await tx`DELETE FROM public.motorista WHERE id IN(7160101,7160102,7160103,7160104)`;
      await tx`DELETE FROM public.veiculo WHERE id IN(7160201,7160202,7160203,7160204)`;
      await tx`DELETE FROM public.usuario WHERE id IN (7160011,7160012,7160013,7160014)`;
      await tx`DELETE FROM public.usuario WHERE id=ANY(${Object.values(actors).map(a=>a.id)}::bigint[])`;
    });
  }finally{await sql.end();await fecharBanco();}
});
function call(path:string,method='GET',body?:unknown,actor='gestor'){
  return fetch(base+path,{method,headers:{...(actor?{Authorization:'Bearer '+tokens[actor]}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
}
async function criar(patch:Partial<typeof input>={}){
  const response=await call(root,'POST',{...input,...patch},'a');expect(response.status).toBe(201);
  const {data}=await response.json();pedidos.push(data.id);return data.id as string;
}
async function aprovar(id:string){expect((await call(root+'/'+id+'/aprovar','POST')).status).toBe(200);}
async function snapshot(id:string){const [row]=await sql`SELECT row_to_json(s) AS pedido,(SELECT count(*)::int FROM public.log_atividade WHERE solicitacao_viagem_id=s.id) AS logs FROM public.solicitacao_viagem s WHERE id=${id}`;return row;}
async function ordem(status:'PENDENTE_ALOCACAO'|'EM_TRANSPORTE',pair:number){
  const [ocorrencia]=await sql`INSERT INTO public.solicitacao_obito(codigo,atendente_id,local_falecimento,endereco_remocao,solicitante_nome,status_triagem,triado_por_id,triado_em)
    VALUES(${'S7-ACEITE-'+(ocorrencias.length+1)},7160006,'Fixture','Fixture','Fixture','CONFIRMADA_SVO',7160006,clock_timestamp()) RETURNING id::text`;
  ocorrencias.push(ocorrencia.id);
  const [row]=await sql`INSERT INTO public.ordem_coleta(solicitacao_obito_id,status,quantidade_corpos,motorista_id,veiculo_id)
    VALUES(${ocorrencia.id},${status},1,${status==='EM_TRANSPORTE'?7160100+pair:null},${status==='EM_TRANSPORTE'?7160200+pair:null}) RETURNING id::text`;
  ordens.push(row.id);return row.id as string;
}

test('matriz HTTP efetiva cobre todos os perfis negados nas onze operações',async()=>{
  const id=await criar();
  for(const operation of operations.filter(o=>o.modulo==='solicitacoes')){
    for(const [name,actor] of Object.entries(actors)){
      if(operation.perfis.includes(actor.perfil))continue;
      const response=await call(operation.path.replace('{id}',id),operation.method.toUpperCase(),undefined,name);
      expect(response.status,operation.id+' / '+name).toBe(403);
    }
  }
});

test('requisições administrativas válidas a pedido inexistente retornam 404',async()=>{
  const id='9223372036854775807';
  for(const [suffix,method,body] of [
    ['', 'GET',undefined],['/historico','GET',undefined],['','PATCH',{origem:'Fixture'}],
    ['/aprovar','POST',undefined],['/rejeitar','POST',{motivo:'Fixture'}],['/agendar','POST',resources()],
    ['/reagendar','POST',{...resources(),dataHoraSaida:input.dataHoraSaida}],
  ] as const){expect((await call(root+'/'+id+suffix,method,body)).status,suffix).toBe(404);}
});

test('texto incompatível com PostgreSQL retorna 400, sem pedido ou log parcial',async()=>{
  const [before]=await sql`SELECT count(*)::int AS total FROM public.solicitacao_viagem WHERE solicitante_id=7160003`;
  for(const field of ['origem','destino','finalidade']){
    const response=await call(root,'POST',{...input,[field]:'Fixture\u0000inválida'},'a');
    expect(response.status,field).toBe(400);expect(JSON.stringify(await response.json())).not.toMatch(/22021|INSERT|UTF8/);
  }
  const [after]=await sql`SELECT count(*)::int AS total FROM public.solicitacao_viagem WHERE solicitante_id=7160003`;expect(after).toEqual(before);
});

test('data ISO recusada pelo parser do PostgreSQL vira 400 em todos os caminhos temporais',async()=>{
  const bad='2099-08-20T08:00:00.'+'1'.repeat(200)+'-03:00';
  const id=await criar();
  expect((await call(root,'POST',{...input,dataHoraSaida:bad},'a')).status).toBe(400);
  expect((await call(root+'/'+id,'PATCH',{dataHoraSaida:bad})).status).toBe(400);
  await aprovar(id);
  expect((await call(root+'/'+id+'/agendar','POST',{...resources(),dataHoraRetornoPrevisto:bad})).status).toBe(400);
  expect((await call(root+'/'+id+'/agendar','POST',resources())).status).toBe(200);
  const before=await snapshot(id);
  for(const field of ['dataHoraSaida','dataHoraRetornoPrevisto'])expect((await call(root+'/'+id+'/reagendar','POST',{...resources(),dataHoraSaida:input.dataHoraSaida,[field]:bad})).status).toBe(400);
  expect(await snapshot(id)).toEqual(before);
  for(const path of [root+'/agenda',root+'/disponibilidade']){
    const response=await call(path+'?'+new URLSearchParams({inicio:input.dataHoraSaida,fim:bad}));expect(response.status,path).toBe(400);
    expect(JSON.stringify(await response.json())).not.toMatch(/22007|SELECT|timestamp/);
  }
  for(const path of ['/api/dashboard/gestor','/api/dashboard/graficos'])expect((await call(path+'?'+new URLSearchParams({periodo:'personalizado',inicio:input.dataHoraSaida,fim:bad}))).status).toBe(400);
});

test('estados reais incompatíveis bloqueiam decisões, edição e reservas sem alterar dados/auditoria',async()=>{
  const [row]=await sql`SELECT enum_range(NULL::public.status_solicitacao)::text[] AS values`;
  const actions=[{suffix:'/aprovar',method:'POST',allowed:['PENDENTE'],body:undefined},{suffix:'/rejeitar',method:'POST',allowed:['PENDENTE'],body:{motivo:'Fixture'}},
    {suffix:'',method:'PATCH',allowed:['PENDENTE','APROVADA'],body:{origem:'Fixture editada'}},
    {suffix:'/agendar',method:'POST',allowed:['APROVADA'],body:resources()},
    {suffix:'/reagendar',method:'POST',allowed:['AGENDADA'],body:{...resources(),dataHoraSaida:input.dataHoraSaida}}];
  for(const state of row.values){
    const id=await criar();await sql`UPDATE public.solicitacao_viagem SET status=${state} WHERE id=${id}`;
    const before=await snapshot(id);
    for(const action of actions.filter(a=>!a.allowed.includes(state)))expect((await call(root+'/'+id+action.suffix,action.method,action.body)).status,state+' '+action.suffix).toBe(409);
    expect(await snapshot(id)).toEqual(before);
  }
});

test('histórico ignora descrições com ID quando falta o vínculo estruturado',async()=>{
  const id=await criar();await sql`INSERT INTO public.log_atividade(usuario_id,descricao) VALUES(7160001,${'Aprovou a solicitação de transporte ID '+id})`;
  const response=await call(root+'/'+id+'/historico','GET',undefined,'a');expect(response.status).toBe(200);
  const body=await response.json();expect(body.meta.total).toBe(1);expect(body.data[0].descricao).toBe('Criou a solicitação de transporte ID '+id);expect(body.data[0]).not.toHaveProperty('responsavel');
});

test('reagendamento conflitante mantém integralmente a reserva antiga, inclusive na troca de recursos',async()=>{
  const a=await criar({dataHoraSaida:'2099-12-03T08:00:00-03:00'}),b=await criar({dataHoraSaida:'2099-12-03T10:00:00-03:00'}),c=await criar({dataHoraSaida:'2099-12-03T08:00:00-03:00'});
  for(const id of [a,b,c])await aprovar(id);
  for(const [id,pair,end] of [[a,4,'10'],[b,4,'12'],[c,1,'12']] as const)expect((await call(root+'/'+id+'/agendar','POST',{...resources(pair),dataHoraRetornoPrevisto:'2099-12-03T'+end+':00:00-03:00'})).status).toBe(200);
  const before=await snapshot(a);
  for(const pair of [1,4]){
    expect((await call(root+'/'+a+'/reagendar','POST',{...resources(pair),dataHoraSaida:'2099-12-03T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-12-03T11:00:00-03:00'})).status).toBe(409);
    expect(await snapshot(a)).toEqual(before);
  }
});

test('SVO EM_TRANSPORTE bloqueia recursos também para pedido institucional futuro',async()=>{
  await ordem('EM_TRANSPORTE',2);const id=await criar({dataHoraSaida:'2099-12-01T08:00:00-03:00'});await aprovar(id);
  expect((await call(root+'/'+id+'/agendar','POST',{...resources(2),dataHoraRetornoPrevisto:'2099-12-01T17:00:00-03:00'})).status).toBe(409);
  const response=await call(root+'/disponibilidade?'+new URLSearchParams({inicio:'2099-12-01T08:00:00-03:00',fim:'2099-12-01T17:00:00-03:00'}));expect(response.status).toBe(200);
  const {data}=await response.json();expect(data.motoristas.some((r:{id:string})=>r.id==='7160102')).toBe(false);expect(data.veiculos.some((r:{id:string})=>r.id==='7160202')).toBe(false);
});

async function esperarDisputa(lock:postgres.ReservedSql){
  const [owner]=await lock`SELECT pg_backend_pid() AS pid`;const deadline=Date.now()+8000;
  while(Date.now()<deadline){
    await lock`SELECT pg_stat_clear_snapshot()`;
    const [row]=await lock`WITH RECURSIVE blocked AS (SELECT pid FROM pg_stat_activity WHERE ${owner.pid}=ANY(pg_blocking_pids(pid))
      UNION SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid=ANY(pg_blocking_pids(a.pid))) SELECT count(*)::int AS total FROM blocked`;
    if(row.total>=2)return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error('Os dois fluxos não aguardaram o recurso esperado.');
}

test('despacho SVO e agendamento institucional HTTP realmente concorrentes têm apenas um vencedor',async()=>{
  const id=await criar({dataHoraSaida:'2099-12-02T08:00:00-03:00'});await aprovar(id);const ordemId=await ordem('PENDENTE_ALOCACAO',3);
  const lock=await sql.reserve();let requests:Promise<Response>[]=[];let statuses:number[];
  try{
    await lock`BEGIN`;await lock`SELECT id FROM public.motorista WHERE id=7160103 FOR UPDATE`;
    requests=[call(root+'/'+id+'/agendar','POST',{...resources(3),dataHoraRetornoPrevisto:'2099-12-02T17:00:00-03:00'}),call('/api/svo/ordens-coleta/'+ordemId+'/despachar','PATCH',{motoristaId:7160103,veiculoId:7160203},'svo')];
    await esperarDisputa(lock);await lock`COMMIT`;statuses=(await Promise.all(requests)).map(r=>r.status);expect([...statuses].sort()).toEqual([200,409]);
  }finally{await lock`ROLLBACK`;await lock.release();await Promise.allSettled(requests);}
  const [state]=await sql`SELECT (SELECT count(*)::int FROM public.solicitacao_viagem WHERE id=${id} AND status='AGENDADA' AND motorista_id=7160103 AND veiculo_id=7160203)
    +(SELECT count(*)::int FROM public.ordem_coleta WHERE id=${ordemId} AND status IN('EM_DESLOCAMENTO','EM_TRANSPORTE') AND motorista_id=7160103 AND veiculo_id=7160203) AS ativos`;
  expect(state.ativos).toBe(1);expect((await snapshot(id)).logs).toBe(statuses[0]===200?3:2);
},15000);
