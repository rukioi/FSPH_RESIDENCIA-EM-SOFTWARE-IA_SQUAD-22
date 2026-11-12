import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { viagensSchemas } from '../../src/modules/viagens/viagens.schemas.js';

const sql=await verifiedSql();
const server=createApp();
let base='',gestor='',adm='',motorista='',created=false;
function patch(id:string,token?:string) {return fetch(`${base}/api/viagens/${id}/validar`,{method:'PATCH',headers:token?{Authorization:`Bearer ${token}`}:{}});}
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem (id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES
      (8860201,'S8-E4-201',-27003,'A','B','Teste','2026-01-01 08:00','CONCLUIDA',-27001,-27001),
      (8860202,'S8-E4-202',-27003,'A','B','Teste','2026-01-01 08:00','CONCLUIDA',-27001,-27001),
      (8860203,'S8-E4-203',-27003,'A','B','Teste','2026-01-01 08:00','AGENDADA',-27001,-27001)`;
    await tx`INSERT INTO public.viagem (id,solicitacao_id,motorista_id,veiculo_id,status,km_inicial,km_final,data_inicio,data_fim) VALUES
      (8860301,8860201,-27001,-27001,'CONCLUIDA',1000,1010,'2026-01-01 08:00','2026-01-01 09:00'),
      (8860302,8860202,-27001,-27001,'CONCLUIDA',1000,1010,'2026-01-01 08:00','2026-01-01 09:00'),
      (8860303,8860203,-27001,-27001,'AGENDADA',NULL,NULL,NULL,NULL)`;
  });created=true;
  gestor=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});adm=await criarJwt({id:'-27001',perfil:'ADM'});motorista=await criarJwt({id:'-27004',perfil:'MOTORISTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{
  if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
  try {if(created)await sql.begin(async tx=>{
    await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id IN (8860201,8860202,8860203)`;
    await tx`DELETE FROM public.viagem WHERE id IN (8860301,8860302,8860303)`;
    await tx`DELETE FROM public.solicitacao_viagem WHERE id IN (8860201,8860202,8860203)`;
  });}finally{await sql.end();await fecharBanco();}
});
test('validação exige sessão, perfil, identificador válido e estado concluído',async()=>{
  expect((await patch('8860301')).status).toBe(401);
  expect((await patch('8860301',motorista)).status).toBe(403);
  expect((await patch('9223372036854775808',gestor)).status).toBe(400);
  expect((await patch('999999999',gestor)).status).toBe(404);
  expect((await patch('8860303',gestor)).status).toBe(409);
});
test('falha de auditoria reverte a validação',async()=>{
  const admin=await verifiedSql(true);let trigger=false,funcao=false;
  try {
    const [existente]=await admin`SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='test_s8_e4_audit_8860202') AS trigger, to_regprocedure('public.test_s8_e4_audit_8860202()') IS NOT NULL AS funcao`;
    if(existente.trigger||existente.funcao)throw new Error('Objeto de teste já existe.');
    await admin.unsafe("CREATE FUNCTION public.test_s8_e4_audit_8860202() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.solicitacao_viagem_id=8860202 THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$");funcao=true;
    await admin.unsafe('CREATE TRIGGER test_s8_e4_audit_8860202 BEFORE INSERT ON public.log_atividade FOR EACH ROW EXECUTE FUNCTION public.test_s8_e4_audit_8860202()');trigger=true;
    expect((await patch('8860302',gestor)).status).toBe(500);
    const [row]=await sql`SELECT validada_por_gestor,validada_por_id,validada_em FROM public.viagem WHERE id=8860302`;
    expect(row).toMatchObject({validada_por_gestor:false,validada_por_id:null,validada_em:null});
    const [logs]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=8860202`;expect(logs.total).toBe(0);
  } finally {
    if(trigger)await admin.unsafe('DROP TRIGGER test_s8_e4_audit_8860202 ON public.log_atividade');
    if(funcao)await admin.unsafe('DROP FUNCTION public.test_s8_e4_audit_8860202()');
    await admin.end();
  }
});
test('validação concorrente registra um ator e um evento e preserva execução',async()=>{
  const [antes]=await sql`SELECT km_inicial,km_final,data_inicio::text,data_fim::text FROM public.viagem WHERE id=8860301`;
  const respostas=await Promise.all([patch('8860301',gestor),patch('8860301',adm)]);
  expect(respostas.map(r=>r.status).sort()).toEqual([200,409]);
  const sucesso=respostas.find(r=>r.status===200)!;
  const dto=viagensSchemas.ValidacaoViagem.parse(await sucesso.json()).data;
  expect(['-27001','-27002']).toContain(dto.validadaPorId);expect(dto.status).toBe('CONCLUIDA');
  const [depois]=await sql`SELECT km_inicial,km_final,data_inicio::text,data_fim::text,validada_por_gestor,validada_por_id::text,validada_em FROM public.viagem WHERE id=8860301`;
  expect(depois).toMatchObject({...antes,validada_por_gestor:true,validada_por_id:dto.validadaPorId});expect(depois.validada_em).toBeTruthy();
  const logs=await sql`SELECT usuario_id::text,descricao FROM public.log_atividade WHERE solicitacao_viagem_id=8860201`;
  expect(logs).toHaveLength(1);expect(logs[0]).toMatchObject({usuario_id:dto.validadaPorId,descricao:'Validou a viagem da solicitação ID 8860201'});
  expect((await patch('8860301',gestor)).status).toBe(409);
});


test('gestor consulta quilometragens e fotos antes de validar com auditoria',async()=>{
  const inicial=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
  const final=Buffer.from([255,216,255,4,5,6]);
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem (id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES (8860204,'S8-E4-204',-27003,'A','B','Teste','2026-01-01 08:00','CONCLUIDA',-27001,-27001)`;
    await tx`INSERT INTO public.viagem (id,solicitacao_id,motorista_id,veiculo_id,status,km_inicial,km_final,data_inicio,data_fim) VALUES (8860304,8860204,-27001,-27001,'CONCLUIDA',1000,1010,'2026-01-01 08:00','2026-01-01 09:00')`;
    await tx`INSERT INTO public.viagem_evidencia (id,viagem_id,momento,versao,nome,tipo,dados,enviado_por_id) VALUES (8860401,8860304,'INICIAL',1,'inicio.png','image/png',${inicial},-27004),(8860402,8860304,'FINAL',1,'fim.jpg','image/jpeg',${final},-27004)`;
  });
  try {
    const get=(path:string)=>fetch(base+'/api/viagens'+path,{headers:{Authorization:`Bearer ${gestor}`}});
    const detalhe=await get('/8860304');expect(detalhe.status).toBe(200);
    expect(viagensSchemas.DetalheViagem.parse(await detalhe.json()).data).toMatchObject({id:'8860304',status:'CONCLUIDA',kmInicial:1000,kmFinal:1010,validadaPorGestor:false});
    const evidencias=await get('/8860304/evidencias');expect(evidencias.status).toBe(200);
    const lista=await evidencias.json() as {data:{id:string;momento:string}[]};
    expect(lista.data.map(e=>[e.id,e.momento])).toEqual([['8860401','INICIAL'],['8860402','FINAL']]);
    for(const [id,bytes] of [['8860401',inicial],['8860402',final]] as const) {
      const foto=await get('/evidencias/'+id);expect(foto.status).toBe(200);expect(Buffer.from(await foto.arrayBuffer())).toEqual(bytes);
    }
    const resposta=await patch('8860304',gestor);expect(resposta.status).toBe(200);
    const validacao=viagensSchemas.ValidacaoViagem.parse(await resposta.json()).data;
    expect(validacao).toMatchObject({id:'8860304',status:'CONCLUIDA',validadaPorId:'-27002'});
    const [row]=await sql`SELECT validada_por_gestor,validada_por_id::text,to_char(validada_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS validada_em FROM public.viagem WHERE id=8860304`;
    expect(row).toMatchObject({validada_por_gestor:true,validada_por_id:'-27002',validada_em:validacao.validadaEm});
    const logs=await sql`SELECT usuario_id::text,solicitacao_viagem_id::text,tipo_evento,data_hora FROM public.log_atividade WHERE solicitacao_viagem_id=8860204`;
    expect(logs).toHaveLength(1);expect(logs[0]).toMatchObject({usuario_id:'-27002',solicitacao_viagem_id:'8860204',tipo_evento:'solicitacao_viagem_validada'});expect(logs[0].data_hora).toBeTruthy();
  } finally {
    const admin=await verifiedSql(true);
    try {await admin`DELETE FROM public.viagem_evidencia WHERE id IN (8860401,8860402)`;} finally {await admin.end();}
    await sql.begin(async tx=>{await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id=8860204`;await tx`DELETE FROM public.viagem WHERE id=8860304`;await tx`DELETE FROM public.solicitacao_viagem WHERE id=8860204`;});
  }
});
