import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {criarJwt} from '../../src/security/jwt.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {viagensSchemas} from '../../src/modules/viagens/viagens.schemas.js';
const sql=await verifiedSql(),admin=await verifiedSql(true),server=createApp();let base='',gestor='',adm='',motorista='',created=false;
const foto=Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
function patch(id:string,body:unknown,token?:string){return fetch(`${base}/api/viagens/${id}/corrigir-quilometragem`,{method:'PATCH',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});}
function get(path:string,token:string){return fetch(base+path,{headers:{Authorization:`Bearer ${token}`}});}
beforeAll(async()=>{
  await sql.begin(async tx=>{
    for(let i=1;i<=5;i++)await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,quilometragem_atual) VALUES (${8920100+i},${'S8C000'+i},'Teste','Correção',2026,'PASSEIO','DISPONIVEL',${i===2||i===3?1500:1000})`;
    for(let i=1;i<=6;i++){
      const veiculo=i===6?8920102:8920100+i;
      await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES (${8920200+i},${'S8-CORR-'+i},-27003,'A','B','Teste','2026-01-01 08:00',${i===5?'AGENDADA':'CONCLUIDA'},-27001,${veiculo})`;
      if(i===5)await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (${8920300+i},${8920200+i},-27001,${veiculo},'AGENDADA')`;
      else if(i===6)await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status,km_inicial,km_final,data_inicio,data_fim) VALUES (${8920300+i},${8920200+i},-27001,${veiculo},'CONCLUIDA',1300,1500,'2026-01-02 08:00','2026-01-02 09:00')`;
      else await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status,km_inicial,km_final,data_inicio,data_fim) VALUES (${8920300+i},${8920200+i},-27001,${veiculo},'CONCLUIDA',900,1000,'2026-01-01 08:00','2026-01-01 09:00')`;
    }
    await tx`INSERT INTO public.viagem_evidencia(id,viagem_id,momento,versao,nome,tipo,dados,enviado_por_id) VALUES (8920401,8920301,'FINAL',1,'final.png','image/png',${foto},-27004)`;
    await tx`INSERT INTO public.abastecimento(id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento) VALUES (8920501,8920104,-27001,10,50,950,'2026-01-01')`;
  });created=true;
  gestor=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});adm=await criarJwt({id:'-27001',perfil:'ADM'});motorista=await criarJwt({id:'-27004',perfil:'MOTORISTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));try{if(created){
  await admin`DELETE FROM public.viagem_correcao WHERE viagem_id BETWEEN 8920301 AND 8920306`;
  await admin`DELETE FROM public.viagem_evidencia WHERE id=8920401`;
  await sql.begin(async tx=>{await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id BETWEEN 8920201 AND 8920206`;await tx`DELETE FROM public.abastecimento WHERE id=8920501`;
    await tx`DELETE FROM public.viagem WHERE id BETWEEN 8920301 AND 8920306`;await tx`DELETE FROM public.solicitacao_viagem WHERE id BETWEEN 8920201 AND 8920206`;await tx`DELETE FROM public.veiculo WHERE id BETWEEN 8920101 AND 8920105`;});
}}finally{await sql.end();await admin.end();await fecharBanco();}});
test('autorização, justificativa, quilometragem e estado são validados',async()=>{
  expect((await patch('8920301',{kmFinal:1100,justificativa:'Teste'})).status).toBe(401);
  expect((await patch('8920301',{kmFinal:1100,justificativa:'Teste'},motorista)).status).toBe(403);
  for(const body of [{kmFinal:1100},{kmFinal:1100,justificativa:' '},{kmInicial:1001,kmFinal:1000,justificativa:'Teste'},{kmFinal:-1,justificativa:'Teste'},{kmFinal:1100,justificativa:'Teste',autorId:'1'}])expect((await patch('8920301',body,gestor)).status).toBe(400);
  expect((await patch('999999999',{kmFinal:1000,justificativa:'Teste'},gestor)).status).toBe(404);
  expect((await patch('8920305',{kmFinal:1000,justificativa:'Teste'},gestor)).status).toBe(409);
  expect((await patch('8920301',{kmFinal:1100,justificativa:'Teste'},gestor)).status).toBe(409);
});
test('viagem antiga preserva odômetro e viagem posterior e verifica coerência',async()=>{
  const [antes]=await sql`SELECT row_to_json(v) AS viagem FROM public.viagem v WHERE id=8920306`;
  await sql`INSERT INTO public.ordem_coleta(id,veiculo_id,motorista_id,status,quantidade_corpos,km_inicial,km_final,data_inicio,data_fim) VALUES (8920601,8920102,-27001,'CONCLUIDA',1,1100,1200,'2026-01-03 08:00','2026-01-03 09:00')`;
  try {expect((await patch('8920302',{kmFinal:1200,justificativa:'Leitura conflitante'},gestor)).status).toBe(409);}
  finally {await sql`DELETE FROM public.ordem_coleta WHERE id=8920601`;}
  const r=await patch('8920302',{kmFinal:1200,justificativa:'Leitura corrigida'},gestor);expect(r.status).toBe(200);
  expect(viagensSchemas.RespostaCorrecaoViagem.parse(await r.json()).data).toMatchObject({kmFinalAnterior:1000,kmFinal:1200,autorId:'-27002',odometroAtualizado:false,versao:1});
  const [veiculo]=await sql`SELECT quilometragem_atual FROM public.veiculo WHERE id=8920102`;expect(veiculo.quilometragem_atual).toBe(1500);
  const [depois]=await sql`SELECT row_to_json(v) AS viagem FROM public.viagem v WHERE id=8920306`;expect(depois).toEqual(antes);
  expect((await patch('8920302',{kmFinal:1350,justificativa:'Teste'},gestor)).status).toBe(409);
  expect((await patch('8920302',{kmFinal:1250,confirmarOdometroAtual:true,justificativa:'Teste'},gestor)).status).toBe(409);
});
test('leituras sem ordem comprovável ou odômetro divergente bloqueiam correção',async()=>{
  expect((await patch('8920303',{kmFinal:1100,confirmarOdometroAtual:true,justificativa:'Teste'},gestor)).status).toBe(409);
  expect((await patch('8920304',{kmFinal:1100,confirmarOdometroAtual:true,justificativa:'Teste'},gestor)).status).toBe(409);
});
test('ordem SVO ativa impede correção até a leitura ser conhecida',async()=>{
  await sql`INSERT INTO public.ordem_coleta(id,veiculo_id,motorista_id,status,quantidade_corpos) VALUES (8920602,8920103,-27001,'EM_TRANSPORTE',1)`;
  try {expect((await patch('8920303',{kmInicial:950,justificativa:'Teste'},gestor)).status).toBe(409);}
  finally {await sql`DELETE FROM public.ordem_coleta WHERE id=8920602`;}
});
test('correção somente do km inicial não altera o odômetro',async()=>{
  const r=await patch('8920303',{kmInicial:950,justificativa:'Leitura inicial'},gestor);expect(r.status).toBe(200);
  const dto=viagensSchemas.RespostaCorrecaoViagem.parse(await r.json()).data;expect(dto).toMatchObject({kmInicialAnterior:900,kmInicial:950,kmFinal:1000,odometroAtualizado:false});
  const [veiculo]=await sql`SELECT quilometragem_atual FROM public.veiculo WHERE id=8920103`;expect(veiculo.quilometragem_atual).toBe(1500);
  expect((await patch('8920303',{kmInicial:1001,justificativa:'Inválida'},gestor)).status).toBe(400);
});
test('quilometragem inicial não pode contradizer leitura SVO anterior',async()=>{
  await sql`INSERT INTO public.ordem_coleta(id,veiculo_id,motorista_id,status,quantidade_corpos,km_inicial,km_final,data_inicio,data_fim) VALUES (8920603,8920103,-27001,'CONCLUIDA',1,800,975,'2025-12-31 08:00','2025-12-31 09:00')`;
  try {
    expect((await patch('8920303',{kmInicial:960,justificativa:'Teste'},gestor)).status).toBe(409);
    const [v]=await sql`SELECT km_inicial FROM public.viagem WHERE id=8920303`;expect(v.km_inicial).toBe(950);
  } finally {await sql`DELETE FROM public.ordem_coleta WHERE id=8920603`;}
});
test('correções concorrentes são versionadas, atualizam odômetro confirmado e preservam foto',async()=>{
  const validacao=await fetch(`${base}/api/viagens/8920301/validar`,{method:'PATCH',headers:{Authorization:`Bearer ${gestor}`}});expect(validacao.status).toBe(200);
  const respostas=await Promise.all([patch('8920301',{kmFinal:1100,confirmarOdometroAtual:true,justificativa:'Primeira'},gestor),patch('8920301',{kmFinal:1200,confirmarOdometroAtual:true,justificativa:'Segunda'},adm)]);
  expect(respostas.map(r=>r.status)).toEqual([200,200]);
  const lista=viagensSchemas.ListaCorrecoesViagem.parse(await (await get('/api/viagens/8920301/correcoes?limit=10',gestor)).json());
  expect(lista.data).toHaveLength(2);expect(lista.data.map(r=>r.versao)).toEqual([1,2]);expect(lista.data[1].kmFinalAnterior).toBe(lista.data[0].kmFinal);
  const [row]=await sql`SELECT v.km_final,v.status,v.motorista_id::text,v.veiculo_id::text,ve.quilometragem_atual,to_char(v.data_inicio,'YYYY-MM-DD HH24:MI') AS inicio,to_char(v.data_fim,'YYYY-MM-DD HH24:MI') AS fim FROM public.viagem v JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=8920301`;
  expect(row).toMatchObject({status:'CONCLUIDA',motorista_id:'-27001',veiculo_id:'8920101',km_final:lista.data[1].kmFinal,quilometragem_atual:lista.data[1].kmFinal,inicio:'2026-01-01 08:00',fim:'2026-01-01 09:00'});
  const [evidencia]=await sql`SELECT dados FROM public.viagem_evidencia WHERE id=8920401`;expect(evidencia.dados).toEqual(foto);
  const historico=await (await get('/api/viagens/8920301/historico',gestor)).json() as {data:{descricao:string}[]};expect(historico.data.filter(e=>e.descricao.startsWith('Corrigiu a quilometragem')).length).toBe(2);
  expect((await get('/api/viagens/8920301/correcoes',motorista)).status).toBe(403);
});
test('última leitura confirmada também pode corrigir um valor informado acima do real',async()=>{
  const r=await patch('8920301',{kmFinal:950,confirmarOdometroAtual:true,justificativa:'Odômetro conferido'},gestor);expect(r.status).toBe(200);
  expect(viagensSchemas.RespostaCorrecaoViagem.parse(await r.json()).data).toMatchObject({versao:3,kmFinal:950,odometroAtualizado:true});
  const [row]=await sql`SELECT v.status,v.validada_por_gestor,ve.quilometragem_atual FROM public.viagem v JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=8920301`;
  expect(row).toMatchObject({status:'CONCLUIDA',validada_por_gestor:true,quilometragem_atual:950});
});
test('falha de auditoria reverte correção, odômetro e preserva versões e foto',async()=>{
  let trigger=false,funcao=false;
  try{
    const [existe]=await admin`SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='test_s8_c_8920201') AS trigger,to_regprocedure('public.test_s8_c_8920201()') IS NOT NULL AS funcao`;
    if(existe.trigger||existe.funcao)throw new Error('Objeto de teste já existe.');
    await admin.unsafe("CREATE FUNCTION public.test_s8_c_8920201() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.solicitacao_viagem_id=8920201 THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$");funcao=true;
    await admin.unsafe('CREATE TRIGGER test_s8_c_8920201 BEFORE INSERT ON public.log_atividade FOR EACH ROW EXECUTE FUNCTION public.test_s8_c_8920201()');trigger=true;
    const [antes]=await sql`SELECT v.km_final,ve.quilometragem_atual FROM public.viagem v JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=8920301`;
    expect((await patch('8920301',{kmFinal:1300,confirmarOdometroAtual:true,justificativa:'Falha'},gestor)).status).toBe(500);
    const [depois]=await sql`SELECT v.km_final,ve.quilometragem_atual FROM public.viagem v JOIN public.veiculo ve ON ve.id=v.veiculo_id WHERE v.id=8920301`;expect(depois).toEqual(antes);
    const [n]=await sql`SELECT count(*)::int AS total FROM public.viagem_correcao WHERE viagem_id=8920301`;expect(n.total).toBe(3);
    const [e]=await sql`SELECT dados FROM public.viagem_evidencia WHERE id=8920401`;expect(e.dados).toEqual(foto);
  }finally{if(trigger)await admin.unsafe('DROP TRIGGER test_s8_c_8920201 ON public.log_atividade');if(funcao)await admin.unsafe('DROP FUNCTION public.test_s8_c_8920201()');}
});
