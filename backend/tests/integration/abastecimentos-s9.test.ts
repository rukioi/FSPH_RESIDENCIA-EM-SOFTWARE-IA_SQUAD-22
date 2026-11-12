import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let token: string;
let proibido: string;
const veiculo=91860;
const svo=91861;
beforeAll(async()=>{
  await sql`INSERT INTO usuario (id,nome,email,senha_hash,perfil,ativo) VALUES
    (91860,'Fixture S9 Gestor','s9-abastecimentos@example.invalid','sem-login','GESTOR_FROTA',true)`;
  await sql`INSERT INTO veiculo (id,placa,marca,modelo,ano,tipo,is_svo) VALUES
    (91860,'S9AB060','Fixture','Fixture comum',2026,'PASSEIO',false),
    (91861,'S9AB061','Fixture','Fixture SVO',2026,'RABECÃO_SVO',true)`;
  token=await criarJwt({id:'91860',perfil:'GESTOR_FROTA'});
  proibido=await criarJwt({id:'-27005',perfil:'GESTOR_FROTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await sql`DELETE FROM log_atividade WHERE usuario_id=91860`;
  await sql`DELETE FROM abastecimento WHERE veiculo_id IN (91860,91861)`;
  await sql`DELETE FROM veiculo WHERE id IN (91860,91861)`;
  await sql`DELETE FROM usuario WHERE id=91860`;
  await sql.end();
});
const input={veiculo_id:veiculo,litragem:'12.34',valor_total:'56.78',data_abastecimento:'2026-11-10'};
const get=(path:string,auth:string|null=token)=>fetch(base+path,{headers:auth?{Authorization:`Bearer ${auth}`}:{}});
const post=(body:unknown)=>fetch(base+'/api/abastecimentos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});

test('RF40 cadastra sem km/motorista, ignora autoria do cliente e persiste auditoria/detalhe',async()=>{
  const r=await post({...input,criado_por_id:'-27001'});
  expect(r.status).toBe(201);
  const {data}=await r.json();
  expect(data).toMatchObject({veiculo_id:String(veiculo),motorista_id:null,quilometragem:null,posto:null,criado_por_id:'91860'});
  const [persistido]=await sql`SELECT motorista_id,quilometragem,criado_por_id FROM abastecimento WHERE id=${data.id}`;
  expect(persistido).toEqual({motorista_id:null,quilometragem:null,criado_por_id:'91860'});
  const [atividade]=await sql`SELECT usuario_id,descricao FROM log_atividade WHERE usuario_id=91860 AND descricao=${`Registrou o abastecimento ID ${data.id}`}`;
  expect(atividade).toEqual({usuario_id:'91860',descricao:`Registrou o abastecimento ID ${data.id}`});
  for(let i=0;i<2;i++) {
    const response=await get(`/api/abastecimentos/${data.id}`);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject(data);
  }
});

test('filtros/paginação e histórico retornam cronologia real sem misturar SVO e veículo comum',async()=>{
  for(const [data,km] of [['2026-10-02',0],['2026-10-04',1200],['2026-10-03',null]] as const) {
    expect((await post({...input,veiculo_id:svo,data_abastecimento:data,quilometragem:km})).status).toBe(201);
  }
  const query=`veiculoId=${svo}&inicio=2026-10-01&fim=2026-10-04&pagina=2&limit=1`;
  const r=await get('/api/abastecimentos?'+query);
  expect(r.status).toBe(200);
  const body=await r.json();
  expect(body.meta).toEqual({page:2,limit:1,total:3});
  expect(body.data).toHaveLength(1);
  expect(body.data[0]).toMatchObject({veiculo_id:String(svo),quilometragem:null});
  const history=await get(`/api/veiculos/${svo}/abastecimentos?inicio=2026-10-01&fim=2026-10-04`);
  expect(history.status).toBe(200);
  const historico=await history.json();
  expect(historico.data.map((a:{quilometragem:number|null})=>a.quilometragem)).toEqual([0,null,1200]);
  expect(historico.meta).toEqual({page:1,limit:20,total:3});
  expect(historico.data.every((a:{veiculo_id:string})=>a.veiculo_id===String(svo))).toBe(true);
  expect((await get('/api/abastecimentos?'+query).then(r=>r.json()))).toEqual(body);
  expect(JSON.stringify(historico)).not.toMatch(/cpf|senha|dadosBase64/);
});

test.each(['pagina=0','limit=101','pagina=2&pagina=3','inicio=2026-02-30','inicio=2026-12-01&fim=2026-01-01',"veiculoId=1%27%20OR%201=1"])(
'consulta inválida é 400: %s',async query=>{expect((await get('/api/abastecimentos?'+query)).status).toBe(400);});

test.each(['/api/abastecimentos?pagina=1','/api/abastecimentos/999999999','/api/veiculos/91861/abastecimentos'])(
'consulta exige sessão e perfil atual no backend: %s',async path=>{
  expect((await get(path,null)).status).toBe(401);
  expect((await get(path,proibido)).status).toBe(403);
});

test('detalhe/recurso ausente é 404, histórico sem registros é lista vazia',async()=>{
  expect((await get('/api/abastecimentos/999999999')).status).toBe(404);
  expect((await get('/api/veiculos/999999999/abastecimentos')).status).toBe(404);
  expect((await get(`/api/veiculos/${svo}/abastecimentos?inicio=2025-01-01&fim=2025-01-31`).then(r=>r.json()))).toMatchObject({data:[],meta:{total:0}});
});

test.each([{litragem:0},{litragem:-1},{valor_total:0},{valor_total:'1.001'},{quilometragem:-1},{quilometragem:2147483648}])(
'entrada incompatível com RF40 não persiste: %j',async extra=>{
  const [antes]=await sql`SELECT count(*)::int AS n FROM abastecimento WHERE veiculo_id=${veiculo}`;
  expect((await post({...input,...extra})).status).toBe(400);
  expect((await sql`SELECT count(*)::int AS n FROM abastecimento WHERE veiculo_id=${veiculo}`)[0]).toEqual(antes);
});

test.each([['P0001',500],['40001',409]] as const)('falha transacional %s reverte o cadastro e retorna %s',async(code,status)=>{
  await sql.unsafe(`CREATE FUNCTION public.test_s9_falha_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.usuario_id=91860 THEN RAISE EXCEPTION 'fixture S9' USING ERRCODE='${code}'; END IF; RETURN NEW; END $$`);
  await sql.unsafe(`CREATE TRIGGER test_s9_falha_auditoria BEFORE INSERT ON public.log_atividade
    FOR EACH ROW EXECUTE FUNCTION public.test_s9_falha_auditoria()`);
  try {
    const [antes]=await sql`SELECT count(*)::int AS n FROM abastecimento WHERE veiculo_id=${veiculo}`;
    const response=await post(input);
    expect(response.status).toBe(status);
    if(status===409) expect((await response.json()).error.code).toBe('CONFLITO');
    expect((await sql`SELECT count(*)::int AS n FROM abastecimento WHERE veiculo_id=${veiculo}`)[0]).toEqual(antes);
  } finally {
    await sql.unsafe('DROP TRIGGER test_s9_falha_auditoria ON public.log_atividade');
    await sql.unsafe('DROP FUNCTION public.test_s9_falha_auditoria()');
  }
});

test('indicadores usam agregado decimal real para 0/1/3 registros e incluem SVO',async()=>{
  const url=(id:number,inicio:string,fim:string)=>`/api/abastecimentos/indicadores?veiculoId=${id}&inicio=${inicio}&fim=${fim}`;
  const vazio=await get(url(svo,'2025-01-01','2025-01-31'));
  expect(vazio.status).toBe(200);
  expect((await vazio.json()).data).toMatchObject({estado:'SEM_ABASTECIMENTOS',quantidade:0,totalLitros:'0.00',totalCusto:'0.00',custoPorLitro:null,
    periodoObservado:{inicio:null,fim:null},consumoPorDistancia:{valor:null,estado:'INDISPONIVEL',motivo:'REGRA_DE_NEGOCIO_PENDENTE'},kmObservadosPorVeiculo:[]});
  const um=await get(url(veiculo,'2026-11-10','2026-11-10'));
  expect(um.status).toBe(200);
  expect((await um.json()).data).toMatchObject({estado:'DISPONIVEL',quantidade:1,totalLitros:'12.34',totalCusto:'56.78',custoPorLitro:'4.6013',
    kmObservadosPorVeiculo:[{veiculoId:String(veiculo),leiturasComKm:0,leiturasSemKm:1,menorKm:null,maiorKm:null}]});
  const tres=await get(url(svo,'2026-10-01','2026-10-04'));
  const body=await tres.json();
  expect(tres.status).toBe(200);
  expect(body.data).toMatchObject({quantidade:3,totalLitros:'37.02',totalCusto:'170.34',custoPorLitro:'4.6013',
    periodoObservado:{inicio:'2026-10-02',fim:'2026-10-04'},kmObservadosPorVeiculo:[{veiculoId:String(svo),leiturasComKm:2,leiturasSemKm:1,menorKm:0,maiorKm:1200}]});
  expect((await get(url(svo,'2026-10-01','2026-10-04')).then(r=>r.json()))).toEqual(body);
});

test('leituras repetidas/regressivas são observações; não geram distância ou consumo inventado',async()=>{
  for(const km of [1200,1200,1000]) expect((await post({...input,veiculo_id:svo,quilometragem:km,data_abastecimento:'2026-09-01'})).status).toBe(201);
  const {data}=await get(`/api/abastecimentos/indicadores?veiculoId=${svo}&inicio=2026-09-01&fim=2026-09-01`).then(r=>r.json());
  expect(data.consumoPorDistancia).toEqual({valor:null,estado:'INDISPONIVEL',motivo:'REGRA_DE_NEGOCIO_PENDENTE'});
  expect(data.kmObservadosPorVeiculo).toEqual([{veiculoId:String(svo),leiturasComKm:3,leiturasSemKm:0,menorKm:1000,maiorKm:1200}]);
  expect(data).not.toHaveProperty('distanciaPercorrida');
});

test('indicadores autorizam no servidor e validam filtros sem usar paginação na soma',async()=>{
  const path='/api/abastecimentos/indicadores';
  expect((await get(path,null)).status).toBe(401);
  expect((await get(path,proibido)).status).toBe(403);
  for(const query of ['inicio=2026-02-30','veiculoId=abc','pagina=1','veiculoId=91861&veiculoId=91860']) {
    expect((await get(path+'?'+query)).status).toBe(400);
  }
  expect((await get(path+'?veiculoId=999999999')).status).toBe(404);
});
