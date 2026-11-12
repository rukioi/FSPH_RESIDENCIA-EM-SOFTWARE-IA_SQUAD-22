import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';

const sql=await verifiedSql(),adminLimpeza=await verifiedSql(true);
const server=createApp();
let base='',motorista='',outro='',gestor='',created=false;
const viagem='8840301';
const bytesInicial=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
const bytesFinal=Buffer.from([255,216,255,4,5,6]);
const fotoInicial={nome:'inicio.png',tipo:'image/png',dadosBase64:bytesInicial.toString('base64')};
const fotoFinal={nome:'fim.jpg',tipo:'image/jpeg',dadosBase64:bytesFinal.toString('base64')};
function patch(id:string,acao:string,body:unknown,token?:string) {
  return fetch(`${base}/api/viagens/${id}/${acao}`,{method:'PATCH',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
}
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario (id,nome,email,senha_hash,perfil,ativo) VALUES
      (8840001,'Motorista E3','s8-e3-a@example.invalid','fixture','MOTORISTA',true),
      (8840002,'Motorista E3 B','s8-e3-b@example.invalid','fixture','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista (id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES
      (8840101,8840001,'Motorista E3','S8-E3-CNH','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo (id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros,quilometragem_atual) VALUES
      (8840111,'S8E3001','Teste','E3',2026,'PASSEIO','DISPONIVEL',5,1000)`;
    await tx`INSERT INTO public.solicitacao_viagem (id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id,data_hora_retorno_previsto) VALUES
      (8840201,'S8-E3-201',-27003,'A','B','Teste','2026-01-01 08:00','AGENDADA',8840101,8840111,'2026-01-01 12:00')`;
    await tx`INSERT INTO public.viagem (id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8840301,8840201,8840101,8840111,'AGENDADA')`;
    await tx`INSERT INTO public.solicitacao_viagem (id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,data_hora_retorno_previsto,status,motorista_id,veiculo_id) VALUES (8840202,'S8-E3-202',-27003,'A','B','Teste','2026-01-01 08:00','2026-01-01 12:00','AGENDADA',8840101,8840111)`;
    await tx`INSERT INTO public.viagem (id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8840302,8840202,8840101,8840111,'AGENDADA')`;
  });created=true;
  motorista=await criarJwt({id:'8840001',perfil:'MOTORISTA'});outro=await criarJwt({id:'8840002',perfil:'MOTORISTA'});gestor=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{
  if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
  try {if(created){await adminLimpeza`DELETE FROM public.viagem_evidencia WHERE viagem_id IN (8840301,8840302)`;await sql.begin(async tx=>{
    await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id IN (8840201,8840202)`;
    await tx`DELETE FROM public.viagem WHERE id IN (8840301,8840302)`;
    await tx`DELETE FROM public.solicitacao_viagem WHERE id IN (8840201,8840202)`;
    await tx`DELETE FROM public.motorista WHERE id=8840101`;
    await tx`DELETE FROM public.veiculo WHERE id=8840111`;
    await tx`DELETE FROM public.usuario WHERE id IN (8840001,8840002)`;
  });}}finally{await sql.end();await adminLimpeza.end();await fecharBanco();}
});
test('autorização, validação e vínculo do motorista',async()=>{
  expect((await patch(viagem,'iniciar',{quilometragem:1000,foto:fotoInicial})).status).toBe(401);
  expect((await patch(viagem,'iniciar',{quilometragem:1000,foto:fotoInicial},gestor)).status).toBe(403);
  expect((await patch(viagem,'iniciar',{quilometragem:1000,foto:fotoInicial},outro)).status).toBe(404);
  expect((await patch('999999999','iniciar',{quilometragem:1000,foto:fotoInicial},motorista)).status).toBe(404);
  expect((await patch(viagem,'iniciar',{quilometragem:-1,foto:fotoInicial},motorista)).status).toBe(400);
  expect((await patch(viagem,'iniciar',{quilometragem:999,foto:fotoInicial},motorista)).status).toBe(400);
  expect((await patch(viagem,'concluir',{quilometragem:1000,foto:fotoFinal},motorista)).status).toBe(409);
});
test('foto e quilometragem obrigatórias, formatos válidos e limite de 1 MiB',async()=>{
  const grande=Buffer.alloc(1024*1024+1);bytesInicial.copy(grande);
  for(const body of [{quilometragem:1001},{foto:fotoInicial},{quilometragem:1001,foto:{...fotoInicial,dadosBase64:'AAAA'}},
    {quilometragem:1001,foto:{...fotoInicial,tipo:'image/jpeg'}},{quilometragem:1001,foto:{...fotoInicial,dadosBase64:grande.toString('base64')}}]) {
    expect((await patch(viagem,'iniciar',body,motorista)).status).toBe(400);
  }
  const [row]=await sql`SELECT status,km_inicial,data_inicio FROM public.viagem WHERE id=${viagem}`;
  expect(row).toMatchObject({status:'AGENDADA',km_inicial:null,data_inicio:null});
  const [count]=await sql`SELECT count(*)::int AS total FROM public.viagem_evidencia WHERE viagem_id=${viagem}`;expect(count.total).toBe(0);
});
async function comFalhaDeFoto(operacao:()=>Promise<void>) {
  const admin=await verifiedSql(true);let trigger=false,funcao=false;
  try {
    const [existe]=await admin`SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='test_s8_foto_8840301') AS trigger,to_regprocedure('public.test_s8_foto_8840301()') IS NOT NULL AS funcao`;
    if(existe.trigger||existe.funcao)throw new Error('Objeto de teste já existe.');
    await admin.unsafe("CREATE FUNCTION public.test_s8_foto_8840301() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.viagem_id=8840301 THEN RAISE EXCEPTION 'fixture image failure'; END IF; RETURN NEW; END $$");funcao=true;
    await admin.unsafe('CREATE TRIGGER test_s8_foto_8840301 BEFORE INSERT ON public.viagem_evidencia FOR EACH ROW EXECUTE FUNCTION public.test_s8_foto_8840301()');trigger=true;
    await operacao();
  } finally {
    if(trigger)await admin.unsafe('DROP TRIGGER test_s8_foto_8840301 ON public.viagem_evidencia');
    if(funcao)await admin.unsafe('DROP FUNCTION public.test_s8_foto_8840301()');
    await admin.end();
  }
}
test('falha na foto inicial reverte estado, quilômetros e auditoria',async()=>{
  await comFalhaDeFoto(async()=>{expect((await patch(viagem,'iniciar',{quilometragem:1001,foto:fotoInicial},motorista)).status).toBe(500);});
  const [row]=await sql`SELECT v.status,v.km_inicial,v.data_inicio,s.status AS pedido FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE v.id=${viagem}`;
  expect(row).toMatchObject({status:'AGENDADA',pedido:'AGENDADA',km_inicial:null,data_inicio:null});
  const [logs]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=8840201`;expect(logs.total).toBe(0);
  const [fotos]=await sql`SELECT count(*)::int AS total FROM public.viagem_evidencia WHERE viagem_id=${viagem}`;expect(fotos.total).toBe(0);
});
test('ordem SVO ativa impede o início',async()=>{
  await sql`INSERT INTO public.ordem_coleta (id,motorista_id,veiculo_id,status,quantidade_corpos) VALUES (8840501,8840101,8840111,'EM_TRANSPORTE',1)`;
  try { expect((await patch(viagem,'iniciar',{quilometragem:1001,foto:fotoInicial},motorista)).status).toBe(409); }
  finally { await sql`DELETE FROM public.ordem_coleta WHERE id=8840501`; }
});
test('falha da auditoria reverte início e estado da solicitação',async()=>{
  const admin=await verifiedSql(true);let trigger=false,funcao=false;
  try {
    const [existente]=await admin`SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='test_s8_e3_audit_8840201') AS trigger, to_regprocedure('public.test_s8_e3_audit_8840201()') IS NOT NULL AS funcao`;
    if(existente.trigger||existente.funcao)throw new Error('Objeto de teste já existe.');
    await admin.unsafe("CREATE FUNCTION public.test_s8_e3_audit_8840201() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.solicitacao_viagem_id=8840201 THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$");funcao=true;
    await admin.unsafe('CREATE TRIGGER test_s8_e3_audit_8840201 BEFORE INSERT ON public.log_atividade FOR EACH ROW EXECUTE FUNCTION public.test_s8_e3_audit_8840201()');trigger=true;
    expect((await patch(viagem,'iniciar',{quilometragem:1001,foto:fotoInicial},motorista)).status).toBe(500);
    const [row]=await sql`SELECT v.status,s.status AS solicitacao,v.km_inicial FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE v.id=${viagem}`;
    expect(row).toMatchObject({status:'AGENDADA',solicitacao:'AGENDADA',km_inicial:null});
    const [foto]=await sql`SELECT count(*)::int AS total FROM public.viagem_evidencia WHERE viagem_id=${viagem}`;expect(foto.total).toBe(0);
  } finally {
    if(trigger)await admin.unsafe('DROP TRIGGER test_s8_e3_audit_8840201 ON public.log_atividade');
    if(funcao)await admin.unsafe('DROP FUNCTION public.test_s8_e3_audit_8840201()');
    await admin.end();
  }
});
test('início concorrente, ocupação após retorno e conclusão com auditoria',async()=>{
  const respostas=await Promise.all([patch(viagem,'iniciar',{quilometragem:1001,foto:fotoInicial},motorista),patch(viagem,'iniciar',{quilometragem:1001,foto:fotoInicial},motorista)]);
  expect(respostas.map(r=>r.status).sort()).toEqual([200,409]);
  const [inicio]=await sql`SELECT v.status,s.status AS solicitacao,v.km_inicial,v.data_inicio FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE v.id=${viagem}`;
  expect(inicio).toMatchObject({status:'EM_TRANSPORTE',solicitacao:'EM_ANDAMENTO',km_inicial:1001});expect(inicio.data_inicio).toBeTruthy();
  const [fotoGravada]=await sql`SELECT momento,versao,dados,enviado_por_id::text FROM public.viagem_evidencia WHERE viagem_id=${viagem}`;expect(fotoGravada).toMatchObject({momento:'INICIAL',versao:1,enviado_por_id:'8840001'});expect(fotoGravada.dados).toEqual(bytesInicial);
  const periodo='?inicio=2099-01-01T08%3A00%3A00-03%3A00&fim=2099-01-01T12%3A00%3A00-03%3A00';
  const disponibilidade=await fetch(base+'/api/solicitacoes-viagem/disponibilidade'+periodo,{headers:{Authorization:`Bearer ${gestor}`}});
  expect(disponibilidade.status).toBe(200);
  const livres=await disponibilidade.json() as {data:{motoristas:{id:string}[];veiculos:{id:string}[]}};
  expect(livres.data.motoristas.some(m=>m.id==='8840101')).toBe(false);
  expect(livres.data.veiculos.some(v=>v.id==='8840111')).toBe(false);
  await comFalhaDeFoto(async()=>{expect((await patch(viagem,'concluir',{quilometragem:1005,foto:fotoFinal},motorista)).status).toBe(500);});
  const [aposFalha]=await sql`SELECT v.status,v.km_final,v.data_fim,s.status AS pedido,ve.quilometragem_atual FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=${viagem}`;
  expect(aposFalha).toMatchObject({status:'EM_TRANSPORTE',pedido:'EM_ANDAMENTO',km_final:null,data_fim:null,quilometragem_atual:1000});
  const [fotosAposFalha]=await sql`SELECT count(*)::int AS total FROM public.viagem_evidencia WHERE viagem_id=${viagem}`;expect(fotosAposFalha.total).toBe(1);
  const [logsAposFalha]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=8840201`;expect(logsAposFalha.total).toBe(1);
  expect((await patch(viagem,'concluir',{quilometragem:1005,foto:fotoFinal},outro)).status).toBe(404);
  expect((await patch(viagem,'concluir',{quilometragem:1005,foto:fotoFinal},gestor)).status).toBe(403);
  expect((await patch(viagem,'concluir',{quilometragem:1005,foto:{...fotoFinal,dadosBase64:'AAAA'}},motorista)).status).toBe(400);
  expect((await patch(viagem,'concluir',{quilometragem:1000,foto:fotoFinal},motorista)).status).toBe(400);
  expect((await patch(viagem,'concluir',{quilometragem:1005},motorista)).status).toBe(400);
  const concluidas=await Promise.all([patch(viagem,'concluir',{quilometragem:1005,foto:fotoFinal},motorista),patch(viagem,'encerrar',{quilometragem:1005,foto:fotoFinal},motorista)]);
  expect(concluidas.map(r=>r.status).sort()).toEqual([200,409]);
  const depois=await fetch(base+'/api/solicitacoes-viagem/disponibilidade'+periodo,{headers:{Authorization:`Bearer ${gestor}`}});
  const liberados=await depois.json() as {data:{motoristas:{id:string}[];veiculos:{id:string}[]}};
  expect(liberados.data.motoristas.some(m=>m.id==='8840101')).toBe(true);
  expect(liberados.data.veiculos.some(v=>v.id==='8840111')).toBe(true);
  const [fim]=await sql`SELECT v.status,s.status AS solicitacao,v.km_final,v.data_fim,ve.quilometragem_atual FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=${viagem}`;
  expect(fim).toMatchObject({status:'CONCLUIDA',solicitacao:'CONCLUIDA',km_final:1005,quilometragem_atual:1005});expect(fim.data_fim).toBeTruthy();
  const fotos=await sql`SELECT momento,versao,dados,enviado_por_id::text FROM public.viagem_evidencia WHERE viagem_id=${viagem} ORDER BY momento`;expect(fotos).toHaveLength(2);
  expect(fotos[0]).toMatchObject({momento:'FINAL',versao:1,enviado_por_id:'8840001'});expect(fotos[0].dados).toEqual(bytesFinal);
  expect(fotos[1].dados).toEqual(bytesInicial);
  const logs=await sql`SELECT descricao,usuario_id::text FROM public.log_atividade WHERE solicitacao_viagem_id=8840201 ORDER BY id`;
  expect(logs).toHaveLength(2);expect(logs.every(l=>l.usuario_id==='8840001')).toBe(true);
  expect((await patch(viagem,'concluir',{quilometragem:1005,foto:fotoFinal},motorista)).status).toBe(409);
  const validacao=await fetch(`${base}/api/viagens/${viagem}/validar`,{method:'PATCH',headers:{Authorization:`Bearer ${gestor}`}});expect(validacao.status).toBe(200);
});

test('foto com exatamente 1 MiB é aceita e preservada integralmente',async()=>{
  const bytes=Buffer.alloc(1024*1024);bytesInicial.copy(bytes);
  const response=await patch('8840302','iniciar',{quilometragem:1005,foto:{...fotoInicial,dadosBase64:bytes.toString('base64')}},motorista);
  expect(response.status).toBe(200);
  const [row]=await sql`SELECT dados FROM public.viagem_evidencia WHERE viagem_id=8840302 AND momento='INICIAL'`;
  expect(Buffer.isBuffer(row.dados)).toBe(true);expect(row.dados.equals(bytes)).toBe(true);
});
