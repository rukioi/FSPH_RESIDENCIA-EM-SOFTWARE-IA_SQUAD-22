import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {criarJwt} from '../../src/security/jwt.js';

const sql=await verifiedSql(),admin=await verifiedSql(true),server=createApp();
const foto={nome:'inicio.png',tipo:'image/png',dadosBase64:Buffer.from([137,80,78,71,13,10,26,10,1]).toString('base64')};
let base='',svo='',driverA='',driverB='',created=false;
const casos=[{usuario:8910001,motorista:8910101,veiculo:8910111,pedido:8910201,viagem:8910301,ocorrencia:8910401,ordem:8910501},
  {usuario:8910002,motorista:8910102,veiculo:8910112,pedido:8910202,viagem:8910302,ocorrencia:8910402,ordem:8910502}];
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (8910003,'Atendente corrida','s8-race-svo@example.invalid','fixture','ATENDENTE_SVO',true)`;
    for(const [i,c] of casos.entries()){
      await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (${c.usuario},${'Motorista corrida '+i},${'s8-race-'+i+'@example.invalid'},'fixture','MOTORISTA',true)`;
      await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES (${c.motorista},${c.usuario},'Motorista corrida',${'S8-RACE-'+i},'D','2099-12-31','DISPONIVEL')`;
      await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,is_svo,vinculo,capacidade_obitos,quilometragem_atual) VALUES (${c.veiculo},${'S8R000'+i},'CHEVROLET','S10 Corrida',2026,'PASSEIO','DISPONIVEL',true,'PROPRIO',4,1000)`;
      await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,data_hora_retorno_previsto,status,motorista_id,veiculo_id) VALUES (${c.pedido},${'S8-RACE-'+i},-27003,'A','B','Concorrência','2099-01-01 08:00','2099-01-01 12:00','AGENDADA',${c.motorista},${c.veiculo})`;
      await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (${c.viagem},${c.pedido},${c.motorista},${c.veiculo},'AGENDADA')`;
      await tx`INSERT INTO public.solicitacao_obito(id,codigo,atendente_id,local_falecimento,endereco_remocao,solicitante_nome,status_triagem,triado_por_id,triado_em) VALUES (${c.ocorrencia},${'S8-RACE-SVO-'+i},8910003,'Fixture','Fixture','Fixture','CONFIRMADA_SVO',8910003,clock_timestamp())`;
      await tx`INSERT INTO public.ordem_coleta(id,solicitacao_obito_id,status,quantidade_corpos) VALUES (${c.ordem},${c.ocorrencia},'PENDENTE_ALOCACAO',1)`;
    }
  });created=true;
  svo=await criarJwt({id:'8910003',perfil:'ATENDENTE_SVO'});driverA=await criarJwt({id:String(casos[0].usuario),perfil:'MOTORISTA'});driverB=await criarJwt({id:String(casos[1].usuario),perfil:'MOTORISTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{
  if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
  try{if(created){await admin`DELETE FROM public.viagem_evidencia WHERE viagem_id IN (8910301,8910302)`;await sql.begin(async tx=>{
    await tx`DELETE FROM public.notificacao WHERE usuario_id IN (8910001,8910002,8910003)`;
    await tx`DELETE FROM public.log_atividade WHERE usuario_id IN (8910001,8910002,8910003)`;
    await tx`DELETE FROM public.ordem_coleta WHERE id IN (8910501,8910502)`;
    await tx`DELETE FROM public.solicitacao_obito WHERE id IN (8910401,8910402)`;
    await tx`DELETE FROM public.viagem WHERE id IN (8910301,8910302)`;
    await tx`DELETE FROM public.solicitacao_viagem WHERE id IN (8910201,8910202)`;
    await tx`DELETE FROM public.motorista WHERE id IN (8910101,8910102)`;
    await tx`DELETE FROM public.veiculo WHERE id IN (8910111,8910112)`;
    await tx`DELETE FROM public.usuario WHERE id IN (8910001,8910002,8910003)`;
  });}}finally{await sql.end();await admin.end();await fecharBanco();}
});
function requisitar(path:string,token:string,body:unknown){return fetch(base+path,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}
async function aguardarBloqueio(bloqueador:number,tabela:string) {
  const limite=Date.now()+7000;
  while(Date.now()<limite){
    const rows=await admin`SELECT pid,query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND ${bloqueador}=ANY(pg_blocking_pids(pid)) AND position(${tabela} in query)>0`;
    if(rows.length===1)return rows[0];
    await new Promise(resolve=>setTimeout(resolve,20));
  }
  throw new Error(`Nenhuma sessão bloqueada pelo PID esperado em ${tabela}.`);
}
async function disputar(indice:number,primeiro:'institucional'|'svo') {
  const c=casos[indice],token=indice===0?driverA:driverB,gate=await sql.reserve();let emTransacao=false;
  let primeira:Promise<Response>|undefined,segunda:Promise<Response>|undefined;
  const iniciar=()=>requisitar(`/api/viagens/${c.viagem}/iniciar`,token,{quilometragem:1000,foto});
  const despachar=()=>requisitar(`/api/svo/ordens-coleta/${c.ordem}/despachar`,svo,{motoristaId:c.motorista,veiculoId:c.veiculo});
  try {
    await gate`BEGIN`;emTransacao=true;
    const [own]=await gate`SELECT pg_backend_pid() AS pid`;
    await gate`SELECT id FROM public.veiculo WHERE id=${c.veiculo} FOR UPDATE`;
    primeira=(primeiro==='institucional'?iniciar:despachar)();
    const primeiroBloqueado=await aguardarBloqueio(own.pid,'public.veiculo');
    expect(primeiroBloqueado.query).toContain('FOR UPDATE');
    segunda=(primeiro==='institucional'?despachar:iniciar)();
    const segundoBloqueado=await aguardarBloqueio(primeiroBloqueado.pid,'public.motorista');
    expect(segundoBloqueado.query).toContain('FOR UPDATE');
    await gate`COMMIT`;emTransacao=false;
    const respostas=await Promise.all([primeira,segunda]);
    const institucional=primeiro==='institucional'?respostas[0]:respostas[1];
    const ordem=primeiro==='svo'?respostas[0]:respostas[1];
    expect(institucional.status).toBe(200);expect(ordem.status).toBe(409);
    const erro=await ordem.json();expect(JSON.stringify(erro)).toMatch(/conflit|aloca/i);
  } finally {
    if(emTransacao)await gate`ROLLBACK`;
    await gate.release();
    await Promise.allSettled([primeira,segunda].filter((x):x is Promise<Response>=>x!==undefined));
  }
  const [estado]=await sql`SELECT v.status AS viagem,s.status AS solicitacao,v.km_inicial,v.data_inicio,
    s.motorista_id::text AS reserva_motorista,s.veiculo_id::text AS reserva_veiculo,
    to_char(s.data_hora_saida,'YYYY-MM-DD HH24:MI') AS saida,to_char(s.data_hora_retorno_previsto,'YYYY-MM-DD HH24:MI') AS retorno,
    o.status AS ordem,o.motorista_id AS ordem_motorista,o.veiculo_id AS ordem_veiculo,
    m.status AS motorista,ve.status AS veiculo,ve.quilometragem_atual
    FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id
    JOIN public.motorista m ON m.id=v.motorista_id JOIN public.veiculo ve ON ve.id=v.veiculo_id
    JOIN public.ordem_coleta o ON o.id=${c.ordem} WHERE v.id=${c.viagem}`;
  expect(estado).toMatchObject({viagem:'EM_TRANSPORTE',solicitacao:'EM_ANDAMENTO',km_inicial:1000,ordem:'PENDENTE_ALOCACAO',ordem_motorista:null,ordem_veiculo:null,reserva_motorista:String(c.motorista),reserva_veiculo:String(c.veiculo),saida:'2099-01-01 08:00',retorno:'2099-01-01 12:00',motorista:'DISPONIVEL',veiculo:'DISPONIVEL',quilometragem_atual:1000});
  expect(estado.data_inicio).toBeTruthy();
  const logs=await sql`SELECT usuario_id::text,descricao FROM public.log_atividade WHERE solicitacao_viagem_id=${c.pedido}`;
  expect(logs).toHaveLength(1);expect(logs[0]).toMatchObject({usuario_id:String(c.usuario),descricao:`Iniciou a viagem da solicitação ID ${c.pedido}`});
  const [svoLogs]=await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE descricao=${'Ordem de coleta #OC-'+c.ordem+' despachada'}`;
  expect(svoLogs.total).toBe(0);
  const [avisos]=await sql`SELECT count(*)::int AS total FROM public.notificacao WHERE usuario_id IN (${c.usuario},8910003)`;
  expect(avisos.total).toBe(0);
}
test('início adquire motorista primeiro e despacho SVO é rejeitado sem efeitos parciais',async()=>{await disputar(0,'institucional');},20000);
test('despacho SVO adquire motorista primeiro e recusa reserva institucional existente',async()=>{await disputar(1,'svo');},20000);
