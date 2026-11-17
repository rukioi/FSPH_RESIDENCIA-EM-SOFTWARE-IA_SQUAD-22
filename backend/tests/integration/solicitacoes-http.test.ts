import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import type postgres from 'postgres';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {criarJwt} from '../../src/security/jwt.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {registrarAtividades} from '../../src/modules/auditoria/auditoria.service.js';
import {schemas,operations} from '../../src/shared/contract/registry.js';
import {agendamentoSolicitacao,detalheSolicitacao,respostaHistorico,respostaAgenda,respostaDisponibilidade} from '../../src/modules/solicitacoes/solicitacoes.schemas.js';

const sql=await verifiedSql();
const server=createApp();
const ids={adm:'7137001',gestor:'7137002',a:'7137003',b:'7137004',negado:'7137005'};
const motoristaId='7137101',veiculoId='7137201';
const tokens:Record<string,string>={};
let base:string,fixturesCreated=false;
const root='/api/solicitacoes-viagem';
const input={origem:'Fixture S7 HTTP',destino:'Unidade',finalidade:'Teste isolado',dataHoraSaida:'2099-11-10T11:00:00Z',qtdPassageiros:1};

beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario (id,nome,email,senha_hash,perfil,ativo) VALUES
      (7137001,'Fixture S7 ADM','s7-http-adm@example.invalid','sem-login','ADM',true),
      (7137002,'Fixture S7 Gestor','s7-http-gestor@example.invalid','sem-login','GESTOR_FROTA',true),
      (7137003,'Fixture S7 A','s7-http-a@example.invalid','sem-login','SOLICITANTE_INTERNO',true),
      (7137004,'Fixture S7 B','s7-http-b@example.invalid','sem-login','SOLICITANTE_INTERNO',true),
      (7137005,'Fixture S7 Motorista','s7-http-m@example.invalid','sem-login','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista (id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status)
      VALUES (7137101,7137005,'Fixture S7 HTTP','S7-HTTP-7137101','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo (id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros)
      VALUES (7137201,'S7H137A','Fixture','HTTP',2026,'PASSEIO','DISPONIVEL',5)`;
  });
  fixturesCreated=true;
  for(const [key,id] of Object.entries(ids))tokens[key]=await criarJwt({id,perfil:'ADM'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
});
afterAll(async()=>{
  if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
  try {
    if(fixturesCreated)await sql.begin(async tx=>{
      // Somente fixtures criadas por este arquivo, no banco comprovadamente isolado.
      await tx`DELETE FROM public.log_atividade WHERE usuario_id IN (7137001,7137002,7137003,7137004,7137005)`;
      await tx`DELETE FROM public.notificacao WHERE viagem_id IN (SELECT id FROM public.viagem WHERE solicitacao_id IN (SELECT id FROM public.solicitacao_viagem WHERE solicitante_id IN (7137003,7137004)))`;
      await tx`DELETE FROM public.viagem WHERE solicitacao_id IN (SELECT id FROM public.solicitacao_viagem WHERE solicitante_id IN (7137003,7137004))`;
      await tx`DELETE FROM public.solicitacao_viagem WHERE solicitante_id IN (7137003,7137004)`;
      await tx`DELETE FROM public.motorista WHERE id=7137101`;
      await tx`DELETE FROM public.veiculo WHERE id=7137201`;
      await tx`DELETE FROM public.usuario WHERE id IN (7137001,7137002,7137003,7137004,7137005)`;
    });
  } finally {await sql.end();await fecharBanco();}
});
function call(path:string,method='GET',body?:unknown,actor='gestor'){
  return fetch(base+root+path,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+tokens[actor]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
}
async function create(patch:Partial<typeof input>={},actor='a'){
  const response=await call('','POST',{...input,...patch},actor);expect(response.status).toBe(201);
  return schemas.RespostaSolicitacaoViagem.parse(await response.json()).data;
}
async function approve(id:string){expect((await call('/'+id+'/aprovar','POST')).status).toBe(200);}

test('HTTP real cobre criação, edição, aprovação, reserva, agenda, disponibilidade e histórico',async()=>{
  const pedido=await create();expect(pedido).toMatchObject({status:'PENDENTE',finalidade:input.finalidade,solicitante:{id:ids.a}});
  expect(pedido.codigo).toBe('TRP-'+pedido.id);expect(pedido.codigoExibicao).toBe('#'+pedido.codigo);
  const [stored]=await sql`SELECT to_char(data_hora_saida,'HH24:MI') AS hora,finalidade FROM public.solicitacao_viagem WHERE id=${pedido.id}`;
  expect(stored).toEqual({hora:'08:00',finalidade:input.finalidade});
  expect((await call('/'+pedido.id,'PATCH',{origem:'Fixture S7 editada'})).status).toBe(200);
  await approve(pedido.id);
  const edited=await call('/'+pedido.id,'PATCH',{qtdPassageiros:2});expect(edited.status).toBe(200);
  expect(schemas.RespostaSolicitacaoViagem.parse(await edited.json()).data.status).toBe('PENDENTE');
  await approve(pedido.id);
  const resources={motoristaId,veiculoId,dataHoraRetornoPrevisto:'2099-11-10T17:00:00-03:00'};
  const scheduled=await call('/'+pedido.id+'/agendar','POST',resources);expect(scheduled.status).toBe(200);
  expect(agendamentoSolicitacao.parse((await scheduled.json()).data).status).toBe('AGENDADA');
  expect((await call('/'+pedido.id,'PATCH',{origem:'Proibido'})).status).toBe(409);
  expect((await call('/'+pedido.id+'/reagendar','POST',{...resources,dataHoraSaida:'2099-11-11T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-11-11T17:00:00-03:00'})).status).toBe(200);
  const query='?'+new URLSearchParams({inicio:'2099-11-11T08:00:00-03:00',fim:'2099-11-11T17:00:00-03:00'});
  const agenda=await call('/agenda'+query);expect(agenda.status).toBe(200);
  expect(respostaAgenda.parse(await agenda.json()).data.some(row=>row.id===pedido.id)).toBe(true);
  const free=await call('/disponibilidade'+query);expect(free.status).toBe(200);
  const available=respostaDisponibilidade.parse(await free.json()).data;
  expect(available.motoristas.some(row=>row.id===motoristaId)).toBe(false);expect(available.veiculos.some(row=>row.id===veiculoId)).toBe(false);
  const details=await call('/'+pedido.id,'GET',undefined,'a');expect(details.status).toBe(200);
  expect(detalheSolicitacao.parse((await details.json()).data)).toMatchObject({status:'AGENDADA',motorista:{id:motoristaId},veiculo:{id:veiculoId}});
  const history=await call('/'+pedido.id+'/historico?page=1&limit=2');expect(history.status).toBe(200);
  const page=respostaHistorico.parse(await history.json());expect(page.meta).toMatchObject({page:1,limit:2,total:7});
  for(const event of page.data){expect(event.responsavel?.id).toBeTruthy();expect(event.dataHora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/);}
  const own=respostaHistorico.parse(await (await call('/'+pedido.id+'/historico','GET',undefined,'a')).json());
  expect(own.data.every(row=>row.responsavel===undefined)).toBe(true);
});

test('isolamento HTTP aplica escopo, 404 indistinguível e finalidade legada null',async()=>{
  const pedido=await create({},'b');
  const list=schemas.ListaSolicitacoesViagem.parse(await (await call('?page=1&limit=100','GET',undefined,'a')).json());
  expect(list.data.every(row=>row.solicitante?.id===ids.a)).toBe(true);
  for(const suffix of ['', '/historico'])expect((await call('/'+pedido.id+suffix,'GET',undefined,'a')).status).toBe(404);
  expect((await call('/9223372036854775807','GET')).status).toBe(404);
  await sql`UPDATE public.solicitacao_viagem SET finalidade=NULL WHERE id=${pedido.id}`;
  expect(detalheSolicitacao.parse((await (await call('/'+pedido.id)).json()).data).finalidade).toBeNull();
});

test('HTTP exige autenticação em todas as onze operações institucionais',async()=>{
  for(const operation of operations.filter(op=>op.modulo==='solicitacoes')){
    const response=await fetch(base+operation.path.replace('{id}','1'),{method:operation.method.toUpperCase()});
    expect(response.status,operation.id).toBe(401);
  }
});
test('HTTP valida perfis efetivos e rejeita entradas com 400 antes da persistência',async()=>{
  const pedido=await create();
  expect((await call('','POST',input,'adm')).status).toBe(403);
  for(const path of ['/'+pedido.id+'/aprovar','/'+pedido.id+'/rejeitar','/'+pedido.id+'/agendar','/'+pedido.id+'/reagendar'])expect((await call(path,'POST',{},'a')).status).toBe(403);
  expect((await call('/'+pedido.id,'PATCH',{origem:'Proibido'},'a')).status).toBe(403);
  expect((await call('/agenda','GET',undefined,'a')).status).toBe(403);
  expect((await call('','GET',undefined,'negado')).status).toBe(403);
  expect((await call('','POST',{...input,solicitanteId:ids.b},'a')).status).toBe(400);
  expect((await call('?page=0')).status).toBe(400);
  expect((await call('/'+pedido.id+'/rejeitar','POST',{motivo:'   '})).status).toBe(400);
  expect((await call('/'+pedido.id+'/agendar','POST',{motoristaId:'1.5',veiculoId,dataHoraRetornoPrevisto:'2099-11-10T17:00:00-03:00'})).status).toBe(400);
  expect((await call('','POST',{...input,dataHoraSaida:'0000-01-01T08:00:00-03:00'},'a')).status).toBe(400);
  expect((await call('/'+pedido.id,'PATCH',{status:'APROVADA'})).status).toBe(400);
});
test('HTTP rejeita com motivo obrigatório e impede decisão repetida',async()=>{
  const pedido=await create();const rejected=await call('/'+pedido.id+'/rejeitar','POST',{motivo:'Sem finalidade aprovada'},'adm');expect(rejected.status).toBe(200);
  expect((await rejected.json()).data).toMatchObject({status:'REPROVADA',motivoRejeicao:'Sem finalidade aprovada'});
  expect((await call('/'+pedido.id+'/aprovar','POST')).status).toBe(409);
  const [count]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${pedido.id}`;
  expect(count.total).toBe(2);
});

async function waiting(lock:postgres.TransactionSql|postgres.ReservedSql,minimum:number){
  const [owner]=await lock`SELECT pg_backend_pid() AS pid`;
  const deadline=Date.now()+8000;
  while(Date.now()<deadline){
    await lock`SELECT pg_stat_clear_snapshot()`;
    const [row]=await lock`WITH RECURSIVE blocked AS (
      SELECT pid FROM pg_stat_activity WHERE ${owner.pid}=ANY(pg_blocking_pids(pid))
      UNION SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid=ANY(pg_blocking_pids(a.pid))
    ) SELECT count(*)::int AS total FROM blocked`;
    if(row.total>=minimum)return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error('Requisições não aguardaram o lock esperado.');
}
test('duas decisões HTTP realmente concorrentes confirmam uma ação e retornam 409 na outra',async()=>{
  const pedido=await create();const lock=await sql.reserve();let requests:Promise<Response>[]=[];
  try{
    await lock`BEGIN`;await lock`SELECT id FROM public.solicitacao_viagem WHERE id=${pedido.id} FOR UPDATE`;
    requests=[call('/'+pedido.id+'/aprovar','POST'),call('/'+pedido.id+'/rejeitar','POST',{motivo:'Outra decisão'})];
    await waiting(lock,2);await lock`COMMIT`;
    expect((await Promise.all(requests)).map(r=>r.status).sort()).toEqual([200,409]);
  }finally{await lock`ROLLBACK`;await lock.release();await Promise.allSettled(requests);}
  const [count]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${pedido.id}`;
  expect(count.total).toBe(2);
},15000);
test('agendamentos HTTP concorrentes não reservam o mesmo recurso no mesmo intervalo',async()=>{
  const a=await create({dataHoraSaida:'2099-12-01T08:00:00-03:00'}),b=await create({dataHoraSaida:'2099-12-01T08:00:00-03:00'});
  await approve(a.id);await approve(b.id);
  const body={motoristaId,veiculoId,dataHoraRetornoPrevisto:'2099-12-01T17:00:00-03:00'};
  const responses=await Promise.all([call('/'+a.id+'/agendar','POST',body),call('/'+b.id+'/agendar','POST',body)]);
  expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
});
function signal(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve};}
test('auditoria de transação anterior fica após a aprovação cujo lock ela aguardou',async()=>{
  const pedido=await create();const earlier=await verifiedSql(),later=await verifiedSql();const started=signal(),mayLock=signal();
  let earlyStart='';let lateStart='';
  const edit=earlier.begin(async tx=>{
    const [time]=await tx`SELECT to_char(transaction_timestamp(),'YYYY-MM-DD HH24:MI:SS.US') AS value`;earlyStart=time.value;started.resolve();await mayLock.promise;
    await tx`SELECT id FROM public.solicitacao_viagem WHERE id=${pedido.id} FOR UPDATE`;
    await tx`UPDATE public.solicitacao_viagem SET origem='Fixture S7 após lock',status='PENDENTE' WHERE id=${pedido.id}`;
    await registrarAtividades(tx,ids.gestor,[{operacao:'solicitacao_viagem_editada',recursoId:pedido.id}]);
  });
  await started.promise;
  const approval=later.begin(async tx=>{
    const [time]=await tx`SELECT to_char(transaction_timestamp(),'YYYY-MM-DD HH24:MI:SS.US') AS value`;lateStart=time.value;
    await tx`SELECT id FROM public.solicitacao_viagem WHERE id=${pedido.id} FOR UPDATE`;
    await tx`UPDATE public.solicitacao_viagem SET status='APROVADA' WHERE id=${pedido.id}`;
    await registrarAtividades(tx,ids.gestor,[{operacao:'solicitacao_viagem_aprovada',recursoId:pedido.id}]);mayLock.resolve();await waiting(tx,1);
  });
  try{await Promise.all([edit,approval]);expect(earlyStart<lateStart).toBe(true);}finally{mayLock.resolve();await Promise.allSettled([edit,approval]);await earlier.end();await later.end();}
  const history=respostaHistorico.parse(await (await call('/'+pedido.id+'/historico')).json());
  expect(history.data.map(row=>row.descricao.split(' ')[0])).toEqual(['Criou','Aprovou','Editou']);
});


test('falha real da auditoria reverte as seis operações institucionais integralmente', async () => {
  const pedido = await create({dataHoraSaida:'2099-12-20T08:00:00-03:00'});
  const admin = await verifiedSql(true);
  let installed = false;
  const snapshot = async () => {
    const [row] = await sql`SELECT row_to_json(s) AS pedido,
      (SELECT count(*)::int FROM public.log_atividade WHERE solicitacao_viagem_id=s.id) AS logs
      FROM public.solicitacao_viagem s WHERE id=${pedido.id}`;
    return row;
  };
  try {
    // Trigger exclusivo deste ensaio: só os atores próprios são afetados.
    await admin.begin(async tx => {
      await tx`CREATE FUNCTION public.fixture_s7_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.usuario_id IN (7137002,7137003) AND NEW.solicitacao_viagem_id IS NOT NULL THEN
            RAISE EXCEPTION 'fixture_audit_failure';
          END IF;
          RETURN NEW;
        END $$`;
      await tx`CREATE TRIGGER fixture_s7_audit_failure BEFORE INSERT ON public.log_atividade
        FOR EACH ROW EXECUTE FUNCTION public.fixture_s7_audit_failure()`;
    });
    installed = true;
    const beforeCreate = await sql`SELECT id::text FROM public.solicitacao_viagem WHERE solicitante_id=7137003 ORDER BY id`;
    const logsBeforeCreate = await sql`SELECT id::text FROM public.log_atividade WHERE usuario_id=7137003 ORDER BY id`;
    expect((await call('','POST',input,'a')).status).toBe(500);
    expect(await sql`SELECT id::text FROM public.log_atividade WHERE usuario_id=7137003 ORDER BY id`).toEqual(logsBeforeCreate);
    expect(await sql`SELECT id::text FROM public.solicitacao_viagem WHERE solicitante_id=7137003 ORDER BY id`).toEqual(beforeCreate);
    for (const operation of [
      {state:'PENDENTE',path:'',method:'PATCH',body:{origem:'Não pode persistir'}},
      {state:'PENDENTE',path:'/aprovar',method:'POST',body:undefined},
      {state:'PENDENTE',path:'/rejeitar',method:'POST',body:{motivo:'Não pode persistir'}},
      {state:'APROVADA',path:'/agendar',method:'POST',body:{motoristaId,veiculoId,dataHoraRetornoPrevisto:'2099-12-20T17:00:00-03:00'}},
      {state:'AGENDADA',path:'/reagendar',method:'POST',body:{motoristaId,veiculoId,dataHoraSaida:'2099-12-21T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-12-21T17:00:00-03:00'}},
    ]) {
      await sql`UPDATE public.solicitacao_viagem SET status=${operation.state},motorista_id=${motoristaId},
        veiculo_id=${veiculoId},data_hora_retorno_previsto='2099-12-20T17:00:00' WHERE id=${pedido.id}`;
      const before = await snapshot();
      const response = await call('/'+pedido.id+operation.path,operation.method,operation.body);
      expect(response.status, operation.path).toBe(500);
      expect(JSON.stringify(await response.json())).not.toMatch(/fixture_audit_failure|INSERT|23514/);
      expect(await snapshot(), operation.path).toEqual(before);
    }
  } finally {
    if (installed) await admin.begin(async tx => {
      await tx`DROP TRIGGER fixture_s7_audit_failure ON public.log_atividade`;
      await tx`DROP FUNCTION public.fixture_s7_audit_failure()`;
    });
    await admin.end();
  }
},15000);

test('histórico institucional não permite escrita HTTP por nenhum perfil', async () => {
  const pedido = await create();
  const [before] = await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${pedido.id}`;
  for (const actor of ['a','b','adm','gestor','negado']) {
    for (const method of ['POST','PATCH','PUT','DELETE']) {
      expect((await call('/'+pedido.id+'/historico',method,{descricao:'Alterar histórico'},actor)).status).toBe(405);
    }
  }
  const [after] = await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${pedido.id}`;
  expect(after).toEqual(before);
});


test('repetir decisão e agendamento não duplica atividade confirmada',async()=>{
  const pedido=await create({dataHoraSaida:'2099-12-25T08:00:00-03:00'});
  await approve(pedido.id);
  expect((await call('/'+pedido.id+'/aprovar','POST')).status).toBe(409);
  const body={motoristaId,veiculoId,dataHoraRetornoPrevisto:'2099-12-25T17:00:00-03:00'};
  expect((await call('/'+pedido.id+'/agendar','POST',body)).status).toBe(200);
  expect((await call('/'+pedido.id+'/agendar','POST',body)).status).toBe(409);
  const [count]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${pedido.id}`;
  expect(count.total).toBe(3);
});
