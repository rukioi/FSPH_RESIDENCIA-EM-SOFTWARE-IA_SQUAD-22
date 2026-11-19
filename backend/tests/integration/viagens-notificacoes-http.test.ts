import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {criarJwt} from '../../src/security/jwt.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {inserirAtribuicaoViagem} from '../../src/modules/notificacoes/notificacoes.repository.js';
const sql=await verifiedSql(),admin=await verifiedSql(true),server=createApp();let base='',gestor='',a='',b='',created=false;
const id='8900201',idRollback='8900202';
const reserva={motoristaId:'8900101',veiculoId:'8900111',dataHoraRetornoPrevisto:'2099-06-01T12:00:00-03:00'};
function post(path:string,body:unknown,token=gestor){return fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}
function get(path:string,token:string){return fetch(base+path,{headers:{Authorization:`Bearer ${token}`}});}
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (8900001,'Motorista N A','s8-n-a@example.invalid','fixture','MOTORISTA',true),(8900002,'Motorista N B','s8-n-b@example.invalid','fixture','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES (8900101,8900001,'Motorista N A','S8-N-CNH-A','D','2099-12-31','DISPONIVEL'),(8900102,8900002,'Motorista N B','S8-N-CNH-B','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros) VALUES (8900111,'S8N0001','Teste','N1',2026,'PASSEIO','DISPONIVEL',5),(8900112,'S8N0002','Teste','N2',2026,'PASSEIO','DISPONIVEL',5)`;
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status) VALUES
      (8900201,'S8-N-201',-27003,'A','B','Teste','2099-06-01 08:00','APROVADA'),(8900202,'S8-N-202',-27003,'A','B','Teste','2099-06-10 08:00','APROVADA')`;
  });created=true;
  gestor=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});a=await criarJwt({id:'8900001',perfil:'MOTORISTA'});b=await criarJwt({id:'8900002',perfil:'MOTORISTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));try{if(created)await sql.begin(async tx=>{
  await tx`DELETE FROM public.notificacao WHERE descricao IN ('Solicitação #S8-N-201','Solicitação #S8-N-202')`;
  await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id IN (8900201,8900202)`;
  await tx`DELETE FROM public.viagem WHERE solicitacao_id IN (8900201,8900202)`;
  await tx`DELETE FROM public.solicitacao_viagem WHERE id IN (8900201,8900202)`;
  await tx`DELETE FROM public.motorista WHERE id IN (8900101,8900102)`;await tx`DELETE FROM public.veiculo WHERE id IN (8900111,8900112)`;
  await tx`DELETE FROM public.usuario WHERE id IN (8900001,8900002)`;
});}finally{await sql.end();await admin.end();await fecharBanco();}});
test('agendamento concorrente notifica somente o destinatário atribuído e não duplica',async()=>{
  const respostas=await Promise.all([post(`/api/solicitacoes-viagem/${id}/agendar`,reserva),post(`/api/solicitacoes-viagem/${id}/agendar`,reserva)]);
  expect(respostas.map(r=>r.status).sort()).toEqual([200,409]);
  const rows=await sql`SELECT n.id::text,n.usuario_id::text,n.chave,n.tipo,n.viagem_id::text FROM public.notificacao n JOIN public.viagem v ON v.id=n.viagem_id WHERE v.solicitacao_id=${id}`;
  expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({usuario_id:'8900001',tipo:'ATRIBUICAO',chave:`viagem:${rows[0].viagem_id}:atribuicao:8900101`});
  const repeticao=await sql.begin(tx=>inserirAtribuicaoViagem(tx,rows[0].viagem_id));expect(repeticao).toBe(false);
  const [count]=await sql`SELECT count(*)::int AS total FROM public.notificacao WHERE usuario_id=8900001 AND descricao='Solicitação #S8-N-201'`;expect(count.total).toBe(1);
  const propria=await (await get('/api/notificacoes?limit=100',a)).json() as {data:{id:string}[]};expect(propria.data.some(n=>n.id===rows[0].id)).toBe(true);
  const alheia=await (await get('/api/notificacoes?limit=100',b)).json() as {data:{id:string}[]};expect(alheia.data.some(n=>n.id===rows[0].id)).toBe(false);
  expect((await post(`/api/notificacoes/${rows[0].id}/ler`,{},b)).status).toBe(404);
});
test('reatribuição notifica novo motorista e repetição idêntica não duplica',async()=>{
  const troca={motoristaId:'8900102',veiculoId:'8900112',dataHoraSaida:'2099-06-02T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-06-02T12:00:00-03:00'};
  expect((await post(`/api/solicitacoes-viagem/${id}/reagendar`,troca)).status).toBe(200);
  expect((await post(`/api/solicitacoes-viagem/${id}/reagendar`,troca)).status).toBe(200);
  const rows=await sql`SELECT tipo,usuario_id::text FROM public.notificacao WHERE usuario_id=8900002 AND descricao='Solicitação #S8-N-201'`;
  expect(rows).toEqual([{tipo:'ATRIBUICAO',usuario_id:'8900002'}]);
  const horario={...troca,dataHoraSaida:'2099-06-03T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-06-03T12:00:00-03:00'};
  expect((await post(`/api/solicitacoes-viagem/${id}/reagendar`,horario)).status).toBe(200);
  expect((await post(`/api/solicitacoes-viagem/${id}/reagendar`,horario)).status).toBe(200);
  const [n]=await sql`SELECT count(*)::int AS total FROM public.notificacao WHERE usuario_id=8900002 AND descricao='Solicitação #S8-N-201'`;expect(n.total).toBe(2);
  expect((await post(`/api/solicitacoes-viagem/${id}/reagendar`,troca)).status).toBe(200);
  expect((await post(`/api/solicitacoes-viagem/${id}/reagendar`,troca)).status).toBe(200);
  const [retorno]=await sql`SELECT count(*)::int AS total FROM public.notificacao WHERE usuario_id=8900002 AND descricao='Solicitação #S8-N-201'`;expect(retorno.total).toBe(3);
});
test('reatribuicao encerra aviso anterior e reativa ao retornar sem duplicar',async()=>{
  const voltar={motoristaId:'8900101',veiculoId:'8900111',dataHoraSaida:'2099-06-04T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-06-04T12:00:00-03:00'};
  expect((await post(`/api/solicitacoes-viagem/${id}/reagendar`,voltar)).status).toBe(200);
  const rows=await sql`SELECT usuario_id::text,titulo FROM public.notificacao WHERE tipo='ATRIBUICAO' AND viagem_id=(SELECT id FROM public.viagem WHERE solicitacao_id=${id}) ORDER BY usuario_id`;
  expect(rows).toHaveLength(2);expect(rows[0].usuario_id).toBe('8900001');expect(rows[0].titulo).not.toContain('encerrada');
  expect(rows[1].usuario_id).toBe('8900002');expect(rows[1].titulo).toContain('encerrada');
});
test('falha ao gravar atribuição reverte agendamento, viagem e auditoria',async()=>{
  let funcao=false,trigger=false;
  try{
    const [existente]=await admin`SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='test_s8_n_8900002') AS trigger,to_regprocedure('public.test_s8_n_8900002()') IS NOT NULL AS funcao`;
    if(existente.trigger||existente.funcao)throw new Error('Objeto de teste já existe.');
    await admin.unsafe("CREATE FUNCTION public.test_s8_n_8900002() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.usuario_id=8900002 AND NEW.tipo='ATRIBUICAO' THEN RAISE EXCEPTION 'fixture notification failure'; END IF; RETURN NEW; END $$");funcao=true;
    await admin.unsafe('CREATE TRIGGER test_s8_n_8900002 BEFORE INSERT ON public.notificacao FOR EACH ROW EXECUTE FUNCTION public.test_s8_n_8900002()');trigger=true;
    const dados={motoristaId:'8900102',veiculoId:'8900112',dataHoraRetornoPrevisto:'2099-06-10T12:00:00-03:00'};
    expect((await post(`/api/solicitacoes-viagem/${idRollback}/agendar`,dados)).status).toBe(500);
    const [pedido]=await sql`SELECT status,motorista_id,veiculo_id FROM public.solicitacao_viagem WHERE id=${idRollback}`;expect(pedido).toMatchObject({status:'APROVADA',motorista_id:null,veiculo_id:null});
    const [v]=await sql`SELECT count(*)::int AS total FROM public.viagem WHERE solicitacao_id=${idRollback}`;expect(v.total).toBe(0);
    const [logs]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${idRollback}`;expect(logs.total).toBe(0);
  }finally{if(trigger)await admin.unsafe('DROP TRIGGER test_s8_n_8900002 ON public.notificacao');if(funcao)await admin.unsafe('DROP FUNCTION public.test_s8_n_8900002()');}
});

test.each(['sem conta','conta inativa'])('motorista %s não recebe atribuição fictícia',async situacao=>{
  await expect(sql.begin(async tx=>{
    if(situacao==='sem conta')await tx`UPDATE public.motorista SET usuario_id=NULL WHERE id=8900102`;
    else await tx`UPDATE public.usuario SET ativo=false WHERE id=8900002`;
    await tx`UPDATE public.solicitacao_viagem SET status='AGENDADA',motorista_id=8900102,veiculo_id=8900112 WHERE id=8900202`;
    const [viagem]=await tx`INSERT INTO public.viagem(solicitacao_id,motorista_id,veiculo_id,status) VALUES (8900202,8900102,8900112,'AGENDADA') RETURNING id::text`;
    expect(await inserirAtribuicaoViagem(tx,viagem.id)).toBe(false);
    const [total]=await tx`SELECT count(*)::int AS quantidade FROM public.notificacao WHERE viagem_id=${viagem.id}`;
    expect(total.quantidade).toBe(0);
    throw new Error('rollback de fixture');
  })).rejects.toThrow('rollback de fixture');
});

test('rotas do motorista restringem caixa e leitura ao destinatario',async()=>{
  const path='/api/motorista/notificacoes';
  expect((await fetch(base+path)).status).toBe(401);
  expect((await get(path,gestor)).status).toBe(403);
  const list=await get(path+'?pagina=1&lida=false',a);expect(list.status).toBe(200);
  const body=await list.json() as {data:{id:string}[],meta:{naoLidas:number}};expect(body.meta.naoLidas).toBeGreaterThan(0);
  const id=body.data[0].id;
  const read=(token:string)=>fetch(base+path+'/'+id+'/lida',{method:'PATCH',headers:{Authorization:'Bearer '+token}});
  expect((await read(b)).status).toBe(404);
  expect((await read(a)).status).toBe(200);expect((await read(a)).status).toBe(200);
  const saved=await (await get(path+'?lida=true',a)).json() as {data:{id:string}[]};expect(saved.data.some(v=>v.id===id)).toBe(true);
});
