import {jpegViagem,pngViagem} from '../viagens-imagens.js';
import {verificarDownloadPrivado} from '../helpers/download-privado.js';
import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {criarJwt} from '../../src/security/jwt.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
const sql=await verifiedSql(),admin=await verifiedSql(true),server=createApp();
let base='',gestor='',motorista='',outro='',solicitante='',created=false;
const png=pngViagem;
function get(path:string,token?:string){return fetch(base+'/api/viagens'+path,{headers:token?{Authorization:`Bearer ${token}`}:{}});}
beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (8880001,'Motorista Evidência A','s8-e6-a@example.invalid','fixture','MOTORISTA',true),(8880002,'Motorista Evidência B','s8-e6-b@example.invalid','fixture','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status)
      VALUES (8880101,8880001,'Motorista Evidência A','S8-E6-CNH-A','D','2099-12-31','DISPONIVEL'),
             (8880102,8880002,'Motorista Evidência B','S8-E6-CNH-B','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros) VALUES (8880111,'S8E6001','Teste','E6',2026,'PASSEIO','DISPONIVEL',5)`;
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id) VALUES (8880201,'S8-E6-201',-27003,'A','B','Teste','2099-01-01 08:00','AGENDADA',8880101,8880111)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8880301,8880201,8880101,8880111,'AGENDADA')`;
    await tx`INSERT INTO public.viagem_evidencia(id,viagem_id,momento,versao,nome,tipo,dados,enviado_por_id,criado_em)
      VALUES (8880401,8880301,'INICIAL',1,'odometro.png','image/png',${png},8880001,'2026-01-01T12:00:00Z'),
             (8880402,8880301,'INICIAL',2,'odometro2.jpg','image/jpeg',${jpegViagem},8880001,'2026-01-01T12:05:00Z')`;
  });created=true;
  gestor=await criarJwt({id:'-27002',perfil:'GESTOR_FROTA'});motorista=await criarJwt({id:'8880001',perfil:'MOTORISTA'});outro=await criarJwt({id:'8880002',perfil:'MOTORISTA'});solicitante=await criarJwt({id:'-27003',perfil:'SOLICITANTE_INTERNO'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{
  if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
  try{if(created){await admin`DELETE FROM public.viagem_evidencia WHERE id IN (8880401,8880402)`;await sql.begin(async tx=>{
    await tx`DELETE FROM public.viagem WHERE id=8880301`;await tx`DELETE FROM public.solicitacao_viagem WHERE id=8880201`;
    await tx`DELETE FROM public.motorista WHERE id IN (8880101,8880102)`;await tx`DELETE FROM public.veiculo WHERE id=8880111`;await tx`DELETE FROM public.usuario WHERE id IN (8880001,8880002)`;
  });}}finally{await sql.end();await admin.end();await fecharBanco();}
});
test('metadados são paginados e protegidos por perfil e vínculo',async()=>{
  expect((await get('/8880301/evidencias')).status).toBe(401);
  expect((await get('/8880301/evidencias',solicitante)).status).toBe(403);
  expect((await get('/8880301/evidencias',outro)).status).toBe(404);
  expect((await get('/8880301/evidencias?limit=0',motorista)).status).toBe(400);
  const resposta=await get('/8880301/evidencias?limit=1',motorista);expect(resposta.status).toBe(200);
  const body=await resposta.json() as {data:Record<string,unknown>[];meta:{total:number}};
  expect(body.meta.total).toBe(2);expect(body.data[0]).toMatchObject({id:'8880401',versao:1,momento:'INICIAL',enviadoPorId:'8880001'});
  expect(body.data[0]).not.toHaveProperty('dados');expect((await get('/8880301/evidencias',gestor)).status).toBe(200);
});
test('downloads privados preservam duas versões e revalidam o motorista após reatribuição', async () => {
  const primeira = '/evidencias/8880401';
  const segunda = '/evidencias/8880402';
  expect((await get(primeira)).status).toBe(401);
  expect((await get(primeira, solicitante)).status).toBe(403);
  const alheia = await get(primeira, outro);
  const ausente = await get('/evidencias/999999999', outro);
  expect(alheia.status).toBe(404);
  expect(ausente.status).toBe(404);
  expect(await alheia.json()).toEqual(await ausente.json());
  await verificarDownloadPrivado(await get(primeira, motorista), png, 'image/png', 'evidencia');
  await verificarDownloadPrivado(await get(segunda, gestor), jpegViagem, 'image/jpeg', 'evidencia');

  const reatribuir = (motoristaId: number) => sql.begin(async tx => {
    await tx`UPDATE public.solicitacao_viagem SET motorista_id=${motoristaId} WHERE id=8880201`;
    await tx`UPDATE public.viagem SET motorista_id=${motoristaId} WHERE id=8880301`;
  });
  await reatribuir(8880102);
  try {
    expect((await get(primeira, motorista)).status).toBe(404);
    expect((await get(segunda, motorista)).status).toBe(404);
    await verificarDownloadPrivado(await get(primeira, outro), png, 'image/png', 'evidencia');
    await verificarDownloadPrivado(await get(segunda, outro), jpegViagem, 'image/jpeg', 'evidencia');
    const lista = await get('/8880301/evidencias', outro);
    expect(lista.status).toBe(200);
    expect((await lista.json()).data).toMatchObject([
      {id:'8880401',versao:1,momento:'INICIAL',enviadoPorId:'8880001'},
      {id:'8880402',versao:2,momento:'INICIAL',enviadoPorId:'8880001'},
    ]);
  } finally {
    await reatribuir(8880101);
  }
});
