import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

const sql=await verifiedSql();
const server=createApp();
let base='';let atendente='';let motorista1='';let motorista2='';let admin='';
const U=[38100,38101,38102,38103,38104];
const M=[38110,38111,38112];
const V=38120, V2=38121;
const S=[38131,38132,38133,38134,38135];
const O=[38141,38142,38143,38144,38145];
function req(path:string,token:string,method='GET',body?:unknown){return fetch(base+path,{
  method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),
});}

beforeAll(async()=>{
  await sql`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES
    (38100,'Fixture Atendimento S7','s7-at@example.invalid','invalido','ATENDENTE_SVO',TRUE),
    (38101,'Fixture Motorista S7 A','s7-a@example.invalid','invalido','MOTORISTA',TRUE),
    (38102,'Fixture Motorista S7 B','s7-b@example.invalid','invalido','MOTORISTA',TRUE),
    (38103,'Fixture Motorista S7 C','s7-c@example.invalid','invalido','MOTORISTA',TRUE),
    (38104,'Fixture ADM S7','s7-adm@example.invalid','invalido','ADM',TRUE)`;
  await sql`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES
    (38110,38101,'Condutor A','S7A38110','B','2035-12-31','DISPONIVEL'),
    (38111,38102,'Condutor B','S7B38111','B','2035-12-31','DISPONIVEL'),
    (38112,38103,'Condutor C','S7C38112','B','2035-12-31','DISPONIVEL')`;
  await sql`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,is_svo,
    vinculo,capacidade_obitos,capacidade_passageiros) VALUES
    (${V},'S7T3820','CHEVROLET','S10 TESTE',2026,'RABECÃO_SVO','DISPONIVEL',TRUE,'PROPRIO',4,2),
    (${V2},'S7T3821','CHEVROLET','S10 TESTE',2026,'RABECÃO_SVO','DISPONIVEL',TRUE,'PROPRIO',4,2)`;
  for(let i=0;i<5;i++){
    await sql`INSERT INTO public.solicitacao_obito (id,codigo,atendente_id,local_falecimento,endereco_remocao,
      solicitante_nome,status_triagem,triado_por_id,triado_em) VALUES
      (${S[i]},${`#SVO-${S[i]}`},38100,'Unidade fictícia','Rua fictícia','Pessoa fictícia',
        'CONFIRMADA_SVO',38100,CURRENT_TIMESTAMP)`;
    await sql`INSERT INTO public.ordem_coleta (id,solicitacao_obito_id,quantidade_corpos,status)
      VALUES (${O[i]},${S[i]},${i===0?3:i===1?1:i===2?1:i===3?3:2},'PENDENTE_ALOCACAO')`;
  }
  [atendente,motorista1,motorista2,,admin]=await Promise.all(U.map(id=>criarJwt({id:String(id),perfil:'ADM'})));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await sql`DELETE FROM public.log_atividade WHERE usuario_id IN (38100,38101,38102,38103,38104)`;
  await sql`DELETE FROM public.ordem_coleta WHERE id IN (38141,38142,38143,38144,38145)`;
  await sql`DELETE FROM public.solicitacao_obito WHERE id IN (38131,38132,38133,38134,38135)`;
  await sql`DELETE FROM public.veiculo WHERE id IN (38120,38121)`;
  await sql`DELETE FROM public.motorista WHERE id IN (38110,38111,38112)`;
  await sql`DELETE FROM public.usuario WHERE id IN (38100,38101,38102,38103,38104)`;
  await sql.end();
});

test('SCRUM-145 impede motorista de ver fila SVO e atendente de executar ordem',async()=>{
  expect((await req('/api/svo/dashboard',motorista1)).status).toBe(403);
  expect((await req('/api/svo/ordens-coleta/minhas',atendente)).status).toBe(403);
  expect((await req('/api/svo/ordens-coleta/minhas',admin)).status).toBe(403);
  expect((await fetch(base+'/api/svo/ordens-coleta/minhas')).status).toBe(401);
  expect((await req(`/api/svo/ordens-coleta/${O[0]}/iniciar`,atendente,'PATCH',{kmInicial:10})).status).toBe(403);
});

test('SCRUM-132/147 despacha 3/4 e 4/4, bloqueia quinta unidade e preserva SQL',async()=>{
  const recursos=await req('/api/svo/recursos-disponiveis',atendente);
  expect(recursos.status).toBe(200);
  const dados=await recursos.json();
  expect(dados.veiculos.find((v:{id:string})=>v.id===String(V))).toMatchObject({ocupacao:0,capacidade:4});
  const despachar=(order:number,driver:number)=>req(`/api/svo/ordens-coleta/${order}/despachar`,atendente,'PATCH',{
    motoristaId:driver,veiculoId:V,
  });
  expect((await despachar(O[0],M[0])).status).toBe(200);
  expect((await (await req(`/api/svo/veiculos/${V}/ocupacao`,atendente)).json()).ocupacao).toBe(3);
  expect((await despachar(O[1],M[1])).status).toBe(200);
  expect((await (await req(`/api/svo/veiculos/${V}/ocupacao`,atendente)).json()).ocupacao).toBe(4);
  expect((await despachar(O[2],M[2])).status).toBe(409);
  const [ordem]=await sql`SELECT status::text,motorista_id,veiculo_id FROM public.ordem_coleta WHERE id=${O[2]}`;
  expect(ordem).toMatchObject({status:'PENDENTE_ALOCACAO',motorista_id:null,veiculo_id:null});
});

test('SCRUM-145/148 leitura é somente da própria ordem, km e transições são auditados',async()=>{
  const path=`/api/svo/ordens-coleta/${O[0]}`;
  expect((await req('/api/svo/ordens-coleta/minhas',motorista1)).status).toBe(200);
  expect((await req('/api/svo/ordens-coleta/minhas/'+O[0],motorista2)).status).toBe(404);
  expect((await req(path+'/iniciar',motorista2,'PATCH',{kmInicial:10})).status).toBe(404);
  expect((await req(path+'/etapa',motorista1,'PATCH')).status).toBe(409);
  expect((await req(path+'/iniciar',motorista1,'PATCH',{kmInicial:100})).status).toBe(200);
  expect((await req(path+'/iniciar',motorista1,'PATCH',{kmInicial:100})).status).toBe(409);
  expect((await req(path+'/etapa',motorista1,'PATCH')).status).toBe(200);
  expect((await req(path+'/concluir',motorista1,'PATCH',{kmFinal:99})).status).toBe(409);
  expect((await req(path+'/concluir',motorista1,'PATCH',{kmFinal:110})).status).toBe(200);
  expect((await req(path+'/concluir',motorista1,'PATCH',{kmFinal:110})).status).toBe(409);
  const [ordem]=await sql`SELECT status::text,km_inicial,km_final,data_inicio,data_fim FROM public.ordem_coleta WHERE id=${O[0]}`;
  expect(ordem).toMatchObject({status:'CONCLUIDA',km_inicial:100,km_final:110});
  expect(ordem.data_inicio).not.toBeNull();expect(ordem.data_fim).not.toBeNull();
  expect((await (await req(`/api/svo/veiculos/${V}/ocupacao`,atendente)).json()).ocupacao).toBe(1);
  const logs=await sql`SELECT descricao FROM public.log_atividade WHERE usuario_id=${U[1]} ORDER BY id`;
  expect(logs.map(l=>l.descricao)).toEqual([
    `Ordem de coleta #OC-${O[0]} iniciada`,
    `Ordem de coleta #OC-${O[0]} entrou em transporte`,
    `Ordem de coleta #OC-${O[0]} concluída`,
  ]);
  expect((await req(`/api/svo/ordens-coleta/${O[1]}/cancelar`,atendente,'PATCH',{})).status).toBe(200);
  expect((await (await req(`/api/svo/veiculos/${V}/ocupacao`,atendente)).json()).ocupacao).toBe(0);
});

test('SCRUM-147 dois despachos concorrentes não passam de quatro corpos', async()=>{
  const despachar=(order:number,driver:number)=>req(`/api/svo/ordens-coleta/${order}/despachar`,
    atendente,'PATCH',{motoristaId:driver,veiculoId:V2});
  const resultados=await Promise.all([despachar(O[3],M[0]),despachar(O[4],M[1])]);
  expect(resultados.map(r=>r.status).sort()).toEqual([200,409]);
  const [ocupacao]=await sql`SELECT COALESCE(SUM(quantidade_corpos),0)::int AS ocupacao
    FROM public.ordem_coleta WHERE veiculo_id=${V2}
      AND status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE')`;
  expect([2,3]).toContain(Number(ocupacao.ocupacao));
  const ordens=await sql`SELECT status::text,motorista_id,veiculo_id FROM public.ordem_coleta
    WHERE id IN (${O[3]},${O[4]}) ORDER BY id`;
  expect(ordens.filter(r=>r.status==='EM_DESLOCAMENTO')).toHaveLength(1);
  expect(ordens.filter(r=>r.status==='PENDENTE_ALOCACAO')).toHaveLength(1);
});
