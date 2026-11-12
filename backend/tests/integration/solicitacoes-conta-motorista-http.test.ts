import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {criarJwt} from '../../src/security/jwt.js';
const sql=await verifiedSql(), server=createApp();let base='',token='',created=false;
const url='/api/solicitacoes-viagem/';
const agendar={motoristaId:'8930101',veiculoId:'8930111',dataHoraRetornoPrevisto:'2099-10-01T12:00:00-03:00'};
function post(id:string,acao:string,dados:unknown){return fetch(base+url+id+'/'+acao,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(dados)});}
beforeAll(async()=>{
 await sql.begin(async t=>{
  await t`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (8930001,'Conta Fixture','s8-c-1@example.invalid','fixture','MOTORISTA',true),(8930002,'Conta Fixture Inativa','s8-c-2@example.invalid','fixture','MOTORISTA',false)`;
  await t`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES (8930101,8930001,'Motorista Ativo','S8-C1','D','2099-12-31','DISPONIVEL'),(8930102,8930002,'Motorista Inativo','S8-C2','D','2099-12-31','DISPONIVEL'),(8930103,NULL,'Motorista Sem Conta','S8-C3','D','2099-12-31','DISPONIVEL')`;
  await t`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status) VALUES (8930111,'S8C0001','Teste','Teste',2026,'PASSEIO','DISPONIVEL')`;
  await t`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status) VALUES (8930201,'S8-C-201',-27003,'A','B','Teste','2099-10-01 08:00','APROVADA'),(8930202,'S8-C-202',-27003,'A','B','Teste','2099-10-03 08:00','APROVADA')`;
 });created=true;token=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
});
afterAll(async()=>{if(server.listening)await new Promise<void>(r=>server.close(()=>r()));try{if(created)await sql.begin(async t=>{
 await t`DELETE FROM public.notificacao WHERE viagem_id IN (SELECT id FROM public.viagem WHERE solicitacao_id IN (8930201,8930202)) OR descricao IN ('Solicitação #S8-C-201','Solicitação #S8-C-202')`;
 await t`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id IN (8930201,8930202)`;
 await t`DELETE FROM public.viagem WHERE solicitacao_id IN (8930201,8930202)`;
 await t`DELETE FROM public.solicitacao_viagem WHERE id IN (8930201,8930202)`;
 await t`DELETE FROM public.motorista WHERE id IN (8930101,8930102,8930103)`;
 await t`DELETE FROM public.veiculo WHERE id=8930111`;
 await t`DELETE FROM public.usuario WHERE id IN (8930001,8930002)`;
 });}finally{await sql.end();await fecharBanco();}});
test.each(['8930102','8930103'])('conta inativa ou ausente impede agendamento %s sem persistir',async motoristaId=>{
 const r=await post('8930201','agendar',{...agendar,motoristaId});expect(r.status).toBe(409);expect((await r.json()).error.code).toBe('MOTORISTA_SEM_CONTA_ATIVA');
 const [row]=await sql`SELECT status::text,(SELECT count(*)::int FROM public.viagem WHERE solicitacao_id=8930201) AS viagens,(SELECT count(*)::int FROM public.log_atividade WHERE solicitacao_viagem_id=8930201) AS logs FROM public.solicitacao_viagem WHERE id=8930201`;
 expect(row).toMatchObject({status:'APROVADA',viagens:0,logs:0});
});
test('agendamento e reagendamento com conta ativa preservam reserva quando motorista sem conta e recusado',async()=>{
 expect((await post('8930201','agendar',agendar)).status).toBe(200);
 const dados={...agendar,motoristaId:'8930103',dataHoraSaida:'2099-10-02T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-10-02T12:00:00-03:00'};
 expect((await post('8930201','reagendar',dados)).status).toBe(409);
 const [v]=await sql`SELECT v.motorista_id::text,(SELECT count(*)::int FROM public.notificacao n WHERE n.viagem_id=v.id AND n.tipo='ATRIBUICAO') AS notificacoes FROM public.viagem v WHERE v.solicitacao_id=8930201`;expect(v).toMatchObject({motorista_id:'8930101',notificacoes:1});
 expect((await post('8930201','reagendar',{...dados,motoristaId:'8930101'})).status).toBe(200);
});
test('desativacao concorrente confirmada antes do lock rejeita o agendamento',async()=>{
 let release!:()=>void;const holding=new Promise<void>(r=>{release=r});let ready!:()=>void;const locked=new Promise<void>(r=>{ready=r});
 const change=sql.begin(async t=>{await t`SELECT id FROM public.usuario WHERE id=8930001 FOR UPDATE`;ready();await holding;await t`UPDATE public.usuario SET ativo=false WHERE id=8930001`;});
 await locked;const pending=post('8930202','agendar',{...agendar,dataHoraRetornoPrevisto:'2099-10-03T12:00:00-03:00'});await new Promise(r=>setTimeout(r,150));release();await change;
 expect((await pending).status).toBe(409);
 const [v]=await sql`SELECT status::text,(SELECT count(*)::int FROM public.viagem WHERE solicitacao_id=8930202) AS viagens FROM public.solicitacao_viagem WHERE id=8930202`;expect(v).toMatchObject({status:'APROVADA',viagens:0});
});
