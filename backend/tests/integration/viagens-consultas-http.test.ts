import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {criarJwt} from '../../src/security/jwt.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {viagensSchemas} from '../../src/modules/viagens/viagens.schemas.js';
const sql=await verifiedSql(),server=createApp();let base='',gestor='',a='',b='',solicitante='',created=false;
function get(path:string,token?:string){return fetch(base+'/api/viagens'+path,{headers:token?{Authorization:`Bearer ${token}`}:{}});}
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (8870001,'Motorista E5 A','s8-e5-a@example.invalid','fixture','MOTORISTA',true),(8870002,'Motorista E5 B','s8-e5-b@example.invalid','fixture','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES (8870101,8870001,'Motorista E5 A','S8-E5-CNH-A','D','2099-12-31','DISPONIVEL'),(8870102,8870002,'Motorista E5 B','S8-E5-CNH-B','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros) VALUES (8870111,'S8E5001','Teste','E5',2026,'PASSEIO','DISPONIVEL',5)`;
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES
      (8870201,'S8-E5-201',-27003,'Origem A','Destino A','Teste','2099-01-01 08:00','CONCLUIDA',8870101,8870111),
      (8870202,'S8-E5-202',-27003,'Origem B','Destino B','Teste','2099-01-02 08:00','AGENDADA',8870102,8870111)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status,km_inicial,km_final,data_inicio,data_fim) VALUES
      (8870301,8870201,8870101,8870111,'CONCLUIDA',100,110,'2099-01-01 08:00','2099-01-01 09:00'),
      (8870302,8870202,8870102,8870111,'AGENDADA',NULL,NULL,NULL,NULL)`;
    await tx`INSERT INTO public.log_atividade(id,usuario_id,solicitacao_viagem_id,descricao,data_hora,tipo_evento) VALUES
      (8870401,8870001,8870201,'Iniciou a viagem da solicitação ID 8870201','2099-01-01 08:00','solicitacao_viagem_iniciada'),
      (8870402,8870001,8870201,'Concluiu a viagem da solicitação ID 8870201','2099-01-01 09:00','solicitacao_viagem_concluida'),
      (8870403,-27002,8870201,'Validou a viagem da solicitação ID 8870201','2099-01-01 09:00','solicitacao_viagem_validada'),
      (8870404,-27002,8870201,'Aprovou a solicitação de transporte ID 8870201','2099-01-01 07:00',NULL),
      (8870405,-27002,8870201,'Validou a viagem da solicitação ID 8870201','2099-01-01 10:00',NULL),
      (8870406,-27002,8870201,'Correção administrativa','2099-01-01 11:00','solicitacao_viagem_quilometragem_corrigida')`;
  });created=true;
  gestor=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});a=await criarJwt({id:'8870001',perfil:'MOTORISTA'});b=await criarJwt({id:'8870002',perfil:'MOTORISTA'});solicitante=await criarJwt({id:'-27003',perfil:'SOLICITANTE_INTERNO'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));try{if(created)await sql.begin(async tx=>{
  await tx`DELETE FROM public.log_atividade WHERE id IN (8870401,8870402,8870403,8870404,8870405,8870406)`;
  await tx`DELETE FROM public.viagem WHERE id IN (8870301,8870302)`;
  await tx`DELETE FROM public.solicitacao_viagem WHERE id IN (8870201,8870202)`;
  await tx`DELETE FROM public.motorista WHERE id IN (8870101,8870102)`;
  await tx`DELETE FROM public.veiculo WHERE id=8870111`;
  await tx`DELETE FROM public.usuario WHERE id IN (8870001,8870002)`;
});}finally{await sql.end();await fecharBanco();}});
test('autenticação, permissões e parâmetros inválidos',async()=>{
  expect((await get('')).status).toBe(401);expect((await get('',a)).status).toBe(403);expect((await get('/8870301',solicitante)).status).toBe(403);
  expect((await get('?motoristaId=9223372036854775808',gestor)).status).toBe(400);
  expect((await get('?limit=101',gestor)).status).toBe(400);expect((await get('?status=INVALIDA',gestor)).status).toBe(400);
  expect((await get('?inicio=2099-01-03T00:00:00Z&fim=2099-01-01T00:00:00Z',gestor)).status).toBe(400);
  expect((await get('/9223372036854775808',gestor)).status).toBe(400);expect((await get('/999999999',gestor)).status).toBe(404);
});
test('listagem administrativa filtra período, status e paginação com ordem estável',async()=>{
  const r=await get('?status=CONCLUIDA&inicio=2099-01-01T10%3A00%3A00Z&fim=2099-01-01T13%3A00%3A00Z&page=1&limit=1',gestor);expect(r.status).toBe(200);
  const x=viagensSchemas.ListaViagens.parse(await r.json());expect(x.data[0]).toMatchObject({id:'8870301',status:'CONCLUIDA'});expect(x.meta).toMatchObject({page:1,limit:1,total:1});
  const porMotorista=viagensSchemas.ListaViagens.parse(await (await get('?motoristaId=8870102',gestor)).json());expect(porMotorista.data.map(i=>i.id)).toEqual(['8870302']);
  const r2=await get('?page=1&limit=2',gestor);const y=viagensSchemas.ListaViagens.parse(await r2.json());expect(y.data.map(i=>i.id)).toEqual(['8870302','8870301']);
});
test('detalhes e histórico isolam motoristas e expõem apenas eventos reais',async()=>{
  for(const path of ['/8870301','/8870301/historico'])expect((await get(path,b)).status).toBe(404);
  const detalhe=await get('/8870301',a);expect(detalhe.status).toBe(200);expect(viagensSchemas.DetalheViagem.parse(await detalhe.json()).data).toMatchObject({id:'8870301',motorista:{id:'8870101'},finalidade:'Teste'});
  const h=await get('/8870301/historico?page=1&limit=2',a);expect(h.status).toBe(200);const x=viagensSchemas.HistoricoViagem.parse(await h.json());expect(x.meta.total).toBe(2);expect(x.data.map(i=>i.id)).toEqual(['8870401','8870402']);
  const h2=viagensSchemas.HistoricoViagem.parse(await (await get('/8870301/historico?page=2&limit=2',gestor)).json());expect(h2.meta.total).toBe(4);expect(h2.data.map(i=>i.id)).toEqual(['8870403','8870406']);
  const geral=await fetch(base+'/api/solicitacoes-viagem/8870201/historico?page=1&limit=20',{headers:{Authorization:`Bearer ${gestor}`}});expect(geral.status).toBe(200);const historicoGeral=await geral.json();expect(historicoGeral.data.map((i:{id:string})=>i.id)).toContain('8870405');
  expect((await get('/8870301/historico?limit=0',a)).status).toBe(400);
});

test('fila de validacao exige gestao, pagina e retorna apenas pendentes reais',async()=>{
  expect((await get('/pendentes-validacao')).status).toBe(401);
  expect((await get('/pendentes-validacao',a)).status).toBe(403);
  expect((await get('/pendentes-validacao?pagina=0',gestor)).status).toBe(400);
  const r=await get('/pendentes-validacao?pagina=1&limit=100',gestor);expect(r.status).toBe(200);
  const body=viagensSchemas.ListaViagens.parse(await r.json());
  expect(body.data.some(v=>v.id==='8870301')).toBe(true);
  expect(body.data.every(v=>v.status==='CONCLUIDA' && v.validadaPorGestor!==true)).toBe(true);
  expect(body.data.some(v=>v.id==='8870302')).toBe(false);
});

test('fila exclui viagem ja validada e inclui a concluida pendente',async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES (8870203,'S8-E5-203',-27003,'A','B','Teste','2099-01-03 08:00','CONCLUIDA',8870101,8870111)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status,km_inicial,km_final,data_inicio,data_fim,validada_por_gestor,validada_por_id,validada_em) VALUES (8870303,8870203,8870101,8870111,'CONCLUIDA',100,110,'2099-01-03 08:00','2099-01-03 09:00',true,-27002,clock_timestamp())`;
  });
  try {
    const response=await get('/pendentes-validacao?pagina=1&limit=100',gestor);expect(response.status).toBe(200);
    const body=viagensSchemas.ListaViagens.parse(await response.json());
    expect(body.data.some(v=>v.id==='8870301')).toBe(true);
    expect(body.data.some(v=>v.id==='8870303')).toBe(false);
  } finally {
    await sql.begin(async tx=>{await tx`DELETE FROM public.viagem WHERE id=8870303`;await tx`DELETE FROM public.solicitacao_viagem WHERE id=8870203`;});
  }
});


test('viagem cancelada respeita consultas, filtro, autorizacao e bloqueio de transicoes',async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES (8870210,'S8-E5-210',-27003,'A','B','Teste','2099-01-10 08:00','AGENDADA',8870101,8870111)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8870310,8870210,8870101,8870111,'CANCELADA')`;
  });
  try {
    const adm=await criarJwt({id:'-27001',perfil:'ADM'});
    for(const token of [gestor,adm,a]) {
      const response=await get('/8870310',token);expect(response.status).toBe(200);
      expect(viagensSchemas.DetalheViagem.parse(await response.json()).data).toMatchObject({id:'8870310',status:'CANCELADA'});
    }
    expect((await get('/8870310',b)).status).toBe(404);
    expect((await get('/8870310',solicitante)).status).toBe(403);
    expect((await get('/8870310')).status).toBe(401);
    const lista=viagensSchemas.ListaViagens.parse(await (await get('?status=CANCELADA&motoristaId=8870101',gestor)).json());
    expect(lista.data.map(v=>v.id)).toContain('8870310');expect(lista.data.every(v=>v.status==='CANCELADA')).toBe(true);
    const minhas=viagensSchemas.ListaMinhasViagens.parse(await (await get('/minhas?status=CANCELADA',a)).json());
    expect(minhas.data.map(v=>v.id)).toContain('8870310');
    const outras=viagensSchemas.ListaMinhasViagens.parse(await (await get('/minhas?status=CANCELADA',b)).json());
    expect(outras.data.map(v=>v.id)).not.toContain('8870310');
    const foto={nome:'odometro.png',tipo:'image/png',dadosBase64:Buffer.from([137,80,78,71,13,10,26,10,1,2,3]).toString('base64')};
    const patch=(acao:string,token?:string)=>fetch(base+'/api/viagens/8870310/'+acao,{method:'PATCH',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({quilometragem:1000,foto})});
    for(const acao of ['iniciar','concluir','encerrar']) {
      expect((await patch(acao,a)).status).toBe(409);
      expect((await patch(acao,b)).status).toBe(404);
      expect((await patch(acao,gestor)).status).toBe(403);
      expect((await patch(acao)).status).toBe(401);
    }
    const [row]=await sql`SELECT v.status,v.km_inicial,v.km_final,v.data_inicio,v.data_fim,s.status AS pedido FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE v.id=8870310`;
    expect(row).toMatchObject({status:'CANCELADA',pedido:'AGENDADA',km_inicial:null,km_final:null,data_inicio:null,data_fim:null});
    const [counts]=await sql`SELECT (SELECT count(*)::int FROM public.log_atividade WHERE solicitacao_viagem_id=8870210) AS logs,(SELECT count(*)::int FROM public.viagem_evidencia WHERE viagem_id=8870310) AS fotos`;
    expect(counts).toEqual({logs:0,fotos:0});
  } finally {
    await sql.begin(async tx=>{await tx`DELETE FROM public.viagem WHERE id=8870310`;await tx`DELETE FROM public.solicitacao_viagem WHERE id=8870210`;});
  }
});
