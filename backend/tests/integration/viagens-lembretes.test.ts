import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {fecharBanco} from '../../src/database/connection.js';
import {criarJwt} from '../../src/security/jwt.js';
import {createApp} from '../../src/app.js';
import {gerarLembretes} from '../../src/modules/notificacoes/lembretes.repository.js';
import {iniciarLembretes} from '../../src/modules/notificacoes/lembretes.service.js';

const sql=await verifiedSql(),server=createApp();let base='',gestor='',created=false;
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (8970001,'Motorista L1','lembrete1@example.invalid','fixture','MOTORISTA',true),(8970002,'Motorista L2','lembrete2@example.invalid','fixture','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES (8970101,8970001,'Motorista L1','S8-LEMBRETE-1','D','2099-12-31','DISPONIVEL'),(8970102,8970002,'Motorista L2','S8-LEMBRETE-2','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros) VALUES (8970111,'S8L0001','Teste','L1',2026,'PASSEIO','DISPONIVEL',5)`;
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,data_hora_retorno_previsto,status,motorista_id,veiculo_id) VALUES (8970201,'S8-L-201',-27003,'A','B','Teste','2099-01-01 07:30','2099-01-01 09:30','AGENDADA',8970101,8970111)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8970301,8970201,8970101,8970111,'AGENDADA')`;
  });created=true;gestor=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));try{if(created)await sql.begin(async tx=>{
  await tx`DELETE FROM public.notificacao WHERE viagem_id=8970301 OR descricao='Solicitação #S8-L-201'`;
  await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id=8970201`;
  await tx`DELETE FROM public.viagem WHERE id=8970301`;await tx`DELETE FROM public.solicitacao_viagem WHERE id=8970201`;
  await tx`DELETE FROM public.motorista WHERE id IN (8970101,8970102)`;await tx`DELETE FROM public.veiculo WHERE id=8970111`;await tx`DELETE FROM public.usuario WHERE id IN (8970001,8970002)`;
});}finally{await sql.end();await fecharBanco();}});

test('janela, concorrencia, reinicio e reagendamento preservam destinatarios e historico',async()=>{
  expect(await gerarLembretes(30,'2099-01-01T09:59:59.000Z')).toBe(0);
  const resultados=await Promise.all([gerarLembretes(30,'2099-01-01T10:00:00.000Z'),gerarLembretes(30,'2099-01-01T10:00:00.000Z')]);
  expect(resultados.reduce((a,b)=>a+b,0)).toBe(1);
  expect(await gerarLembretes(30,'2099-01-01T10:01:00.000Z')).toBe(0);
  let rows=await sql`SELECT usuario_id::text,titulo,tipo FROM public.notificacao WHERE viagem_id=8970301 AND tipo='LEMBRETE'`;
  expect(rows).toMatchObject([{usuario_id:'8970001',titulo:'Lembrete de viagem',tipo:'LEMBRETE'}]);
  const response=await fetch(base+'/api/solicitacoes-viagem/8970201/reagendar',{method:'POST',headers:{Authorization:`Bearer ${gestor}`,'Content-Type':'application/json'},body:JSON.stringify({motoristaId:'8970102',veiculoId:'8970111',dataHoraSaida:'2099-01-01T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-01-01T10:00:00-03:00'})});
  expect(response.status).toBe(200);
  rows=await sql`SELECT usuario_id::text,titulo,tipo FROM public.notificacao WHERE viagem_id=8970301 AND tipo='LEMBRETE' ORDER BY usuario_id`;
  expect(rows[0]).toMatchObject({usuario_id:'8970001',titulo:'Lembrete desatualizado'});
  expect(await gerarLembretes(30,'2099-01-01T10:30:00.000Z')).toBe(1);
  expect(await gerarLembretes(30,'2099-01-01T10:31:00.000Z')).toBe(0);
  rows=await sql`SELECT usuario_id::text,titulo,tipo FROM public.notificacao WHERE viagem_id=8970301 AND tipo='LEMBRETE' ORDER BY usuario_id`;
  expect(rows).toMatchObject([{usuario_id:'8970001',titulo:'Lembrete desatualizado'},{usuario_id:'8970002',titulo:'Lembrete de viagem'}]);
});


test('retorno ao mesmo horario reativa o lembrete sem duplicar',async()=>{
  const reagendar=(motoristaId:string,saida:string,retorno:string)=>fetch(base+'/api/solicitacoes-viagem/8970201/reagendar',{method:'POST',headers:{Authorization:`Bearer ${gestor}`,'Content-Type':'application/json'},body:JSON.stringify({motoristaId,veiculoId:'8970111',dataHoraSaida:saida,dataHoraRetornoPrevisto:retorno})});
  expect((await reagendar('8970101','2099-01-01T07:30:00-03:00','2099-01-01T09:30:00-03:00')).status).toBe(200);
  expect(await gerarLembretes(30,'2099-01-01T10:00:00.000Z')).toBe(1);
  expect(await gerarLembretes(30,'2099-01-01T10:01:00.000Z')).toBe(0);
  const rows=await sql`SELECT usuario_id::text,titulo FROM public.notificacao WHERE viagem_id=8970301 AND tipo='LEMBRETE' ORDER BY usuario_id`;
  expect(rows).toEqual([{usuario_id:'8970001',titulo:'Lembrete de viagem'},{usuario_id:'8970002',titulo:'Lembrete desatualizado'}]);
  expect((await reagendar('8970102','2099-01-01T08:00:00-03:00','2099-01-01T10:00:00-03:00')).status).toBe(200);
});

test('conta inativa e saida ja ocorrida nao geram avisos',async()=>{
  await sql`UPDATE public.usuario SET ativo=false WHERE id=8970002`;
  try {
    await sql`UPDATE public.solicitacao_viagem SET data_hora_saida='2099-01-01 08:30' WHERE id=8970201`;
    expect(await gerarLembretes(30,'2099-01-01T11:00:00.000Z')).toBe(0);
    await sql`UPDATE public.usuario SET ativo=true WHERE id=8970002`;
    expect(await gerarLembretes(30,'2099-01-01T11:30:00.000Z')).toBe(0);
    const [row]=await sql`SELECT count(*)::int AS total FROM public.notificacao WHERE viagem_id=8970301 AND tipo='LEMBRETE'`;
    expect(row.total).toBe(2);
  } finally {await sql`UPDATE public.usuario SET ativo=true WHERE id=8970002`;}
});


test('solicitacao pronta para iniciar mantem viagem elegivel',async()=>{
  await sql`UPDATE public.solicitacao_viagem SET status='PRONTA_PARA_INICIAR' WHERE id=8970201`;
  expect(await gerarLembretes(30,'2099-01-01T11:00:00.000Z')).toBe(1);
  const [row]=await sql`SELECT usuario_id::text,titulo FROM public.notificacao WHERE viagem_id=8970301 AND tipo='LEMBRETE' AND titulo='Lembrete de viagem'`;
  expect(row).toEqual({usuario_id:'8970002',titulo:'Lembrete de viagem'});
});


test('processo automatico grava aviso real sem chamada de disparo HTTP',async()=>{
  const [outras]=await sql`SELECT count(*)::int AS total FROM public.solicitacao_viagem s JOIN public.viagem v ON v.solicitacao_id=s.id JOIN public.motorista m ON m.id=v.motorista_id JOIN public.usuario u ON u.id=m.usuario_id WHERE s.status IN ('AGENDADA','PRONTA_PARA_INICIAR') AND v.status='AGENDADA' AND u.ativo AND s.motorista_id=v.motorista_id AND s.veiculo_id=v.veiculo_id AND s.data_hora_saida>(clock_timestamp() AT TIME ZONE 'America/Maceio') AND s.data_hora_saida<=(clock_timestamp() AT TIME ZONE 'America/Maceio')+interval '31 minutes'`;
  expect(outras.total).toBe(0);
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,data_hora_retorno_previsto,status,motorista_id,veiculo_id) VALUES (8970202,'S8-L-202',-27003,'A','B','Teste',(clock_timestamp() AT TIME ZONE 'America/Maceio')+interval '20 minutes',(clock_timestamp() AT TIME ZONE 'America/Maceio')+interval '2 hours','AGENDADA',8970101,8970111)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8970302,8970202,8970101,8970111,'AGENDADA')`;
  });
  try {
    const parar=iniciarLembretes();await parar();
    const rows=await sql`SELECT usuario_id::text,tipo,titulo FROM public.notificacao WHERE viagem_id=8970302`;
    expect(rows).toEqual([{usuario_id:'8970001',tipo:'LEMBRETE',titulo:'Lembrete de viagem'}]);
    const token=await criarJwt({id:'8970001',perfil:'MOTORISTA'});
    const response=await fetch(base+'/api/motorista/notificacoes?pagina=1&lida=false',{headers:{Authorization:`Bearer ${token}`}});
    expect(response.status).toBe(200);const body=await response.json() as {data:{titulo:string}[]};
    expect(body.data.some(n=>n.titulo==='Lembrete de viagem')).toBe(true);
  } finally {
    await sql.begin(async tx=>{await tx`DELETE FROM public.notificacao WHERE viagem_id=8970302`;await tx`DELETE FROM public.viagem WHERE id=8970302`;await tx`DELETE FROM public.solicitacao_viagem WHERE id=8970202`;});
  }
});


test('reagendamento concorrente bloqueia aviso para atribuicao anterior',async()=>{
  await sql`UPDATE public.solicitacao_viagem SET status='AGENDADA',data_hora_saida='2099-01-01 09:00' WHERE id=8970201`;
  let liberar:()=>void=()=>{};let pronto:()=>void=()=>{};
  const porta=new Promise<void>(resolve=>{liberar=resolve;});const bloqueado=new Promise<void>(resolve=>{pronto=resolve;});
  const lock=sql.begin(async tx=>{await tx`SELECT id FROM public.solicitacao_viagem WHERE id=8970201 FOR UPDATE`;pronto();await porta;});
  await bloqueado;
  let resposta:Promise<Response>|undefined;
  try {
    resposta=fetch(base+'/api/solicitacoes-viagem/8970201/reagendar',{method:'POST',headers:{Authorization:`Bearer ${gestor}`,'Content-Type':'application/json'},body:JSON.stringify({motoristaId:'8970101',veiculoId:'8970111',dataHoraSaida:'2099-01-01T09:15:00-03:00',dataHoraRetornoPrevisto:'2099-01-01T10:00:00-03:00'})});
    expect(await gerarLembretes(30,'2099-01-01T11:30:00.000Z')).toBe(0);
  } finally {liberar();await lock;}
  expect((await resposta!).status).toBe(200);
  expect(await gerarLembretes(30,'2099-01-01T11:45:00.000Z')).toBe(1);
  const rows=await sql`SELECT usuario_id::text FROM public.notificacao WHERE viagem_id=8970301 AND tipo='LEMBRETE' AND titulo='Lembrete de viagem'`;
  expect(rows).toEqual([{usuario_id:'8970001'}]);
});
