import {afterAll,afterEach,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {createApp} from '../../src/app.js';
import {prepararAnexos,falharAuditoriaAnexo,pngAnexo} from '../helpers/anexos-fixture.js';
import {gestaoDocumentalSchemas} from '../../src/modules/documentos/documentos.gestao.schemas.js';
const server=createApp();let fixture:Awaited<ReturnType<typeof prepararAnexos>>;let base:string;
beforeAll(async()=>{fixture=await prepararAnexos();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterEach(async()=>{
  await fixture?.limparUploads();
  if(fixture){
    await fixture.sql`DELETE FROM documento_veiculo WHERE veiculo_id IN (92194,92195) AND id NOT IN (92194,92195)`;
    await fixture.sql`DELETE FROM motorista WHERE cnh='92193000001'`;
    await fixture.sql`UPDATE documento_veiculo SET data_vencimento='2028-02-29',tipo_documento='Documento teste' WHERE id IN (92194,92195)`;
    await fixture.sql`UPDATE motorista SET validade_cnh='2030-12-31',cnh='CNH-TESTE-92194',categoria_cnh='D' WHERE id=92199`;
  }
});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));await fixture?.limpar();});
const headers=(ator:string|null='ADM'):Record<string,string>=>ator?{Authorization:`Bearer ${fixture.tokens[ator]}`}:{ };
const get=(path:string,ator:string|null='ADM')=>fetch(base+path,{headers:headers(ator)});
const write=(path:string,body:unknown,method='PATCH',ator:string|null='ADM')=>fetch(base+path,{method,headers:{...headers(ator),'Content-Type':'application/json'},body:JSON.stringify(body)});

test('legado sem histórico retorna versão 0 e lista vazia, sem autor inventado',async()=>{
  const atual=await get('/api/documentos/92194');expect(atual.status).toBe(200);
  expect(gestaoDocumentalSchemas.DetalheDocumental.parse(await atual.json()).data).toMatchObject({id:'92194',versao:0,registroId:'92194',dataValidade:'2028-02-29'});
  expect(await(await get('/api/documentos/92194/historico')).json()).toEqual({data:[],meta:{page:1,limit:20,total:0}});
  expect((await(await get('/api/documentos/92199?tipo=CNH_MOTORISTA')).json()).data.numeroCnh).toBe('CNH-TESTE-92194');
});

test.each(['DOCUMENTO_VEICULO','CNH_MOTORISTA'])('edição %s guarda versão/autor/instante reais e persiste após reload',async tipo=>{
  const id=tipo==='CNH_MOTORISTA'?'92199':'92194';const path=`/api/documentos/${id}?tipo=${tipo}`;
  const response=await write(path,{versao:0,dataValidade:'2028-02-29'});expect(response.status).toBe(200);
  expect((await response.json()).data.versao).toBe(1);
  for(let reload=0;reload<2;reload++){
    expect((await(await get(path)).json()).data).toMatchObject({versao:1,dataValidade:'2028-02-29'});
    const historico=gestaoDocumentalSchemas.HistoricoDocumental.parse(await(await get(`/api/documentos/${id}/historico?tipo=${tipo}`)).json());
    expect(historico.data).toHaveLength(1);expect(historico.data[0]).toMatchObject({versao:1,autorId:'92194',dataValidade:'2028-02-29'});
  }
  expect((await write(path,{versao:0,dataValidade:'2029-01-01'})).status).toBe(409);
});

test('duas edições da mesma versão confirmam uma alteração e um 409',async()=>{
  const resultados=await Promise.all([write('/api/documentos/92194',{versao:0,dataValidade:'2029-01-01'}),
    write('/api/documentos/92194',{versao:0,dataValidade:'2029-02-01'})]);
  expect(resultados.map(r=>r.status).sort()).toEqual([200,409]);
  expect(await fixture.sql`SELECT versao FROM documento_historico WHERE documento_veiculo_id=92194`).toEqual([{versao:1}]);
});

test('CNH editada pela gestão legada também gera histórico; motorista nunca edita',async()=>{
  const path='/api/motoristas/92199';
  expect((await write(path,{validade_cnh:'2029-03-31'})).status).toBe(200);
  const h=await(await get('/api/documentos/92199/historico?tipo=CNH_MOTORISTA')).json();
  expect(h.data[0]).toMatchObject({versao:1,autorId:'92194',dataValidade:'2029-03-31'});
  expect((await write(path,{nome:'Fixture motorista'})).status).toBe(200);
  expect((await(await get('/api/documentos/92199/historico?tipo=CNH_MOTORISTA')).json()).meta.total).toBe(1);
  expect((await write('/api/documentos/92199?tipo=CNH_MOTORISTA',{versao:1,dataValidade:'2030-01-01'},'PATCH','MOTORISTA')).status).toBe(403);
});

test('cadastros legados documental e CNH capturam primeira versão atomicamente',async()=>{
  const response=await write('/api/documentos',{veiculo_id:92194,tipo_documento:'CRLV TESTE',data_vencimento:'2028-02-29'},'POST');
  expect(response.status).toBe(201);const {data}=await response.json();
  expect((await(await get(`/api/documentos/${data.id}/historico`)).json()).data[0]).toMatchObject({versao:1,autorId:'92194'});
  const motorista=await write('/api/motoristas',{nome:'Fixture CNH S9',cnh:'92193000001',categoria_cnh:'D',validade_cnh:'2030-12-31'},'POST');
  expect(motorista.status).toBe(201);const m=await motorista.json();
  expect((await(await get(`/api/documentos/${m.data.id}/historico?tipo=CNH_MOTORISTA`)).json()).data[0]).toMatchObject({versao:1,numeroCnh:'92193000001'});
});

test('multipart documental conserva bytes reais e versão, sem normalizar data inválida',async()=>{
  const body=new FormData();body.append('veiculo_id','92194');body.append('tipo_documento','CRLV TESTE');body.append('data_vencimento','2028-02-29');
  body.append('arquivo',new Blob([new Uint8Array(pngAnexo)],{type:'image/png'}),'fixture.png');
  const response=await fetch(base+'/api/documentos',{method:'POST',headers:headers(),body});expect(response.status).toBe(201);
  const {data}=await response.json();
  expect((await fixture.sql`SELECT arquivo_dados FROM documento_veiculo WHERE id=${data.id}`)[0].arquivo_dados).toEqual(pngAnexo);
  expect((await(await get(`/api/documentos/${data.id}/historico`)).json()).meta.total).toBe(1);
});

test.each(['2027-02-29','2026-04-31','2026-02-30'])('data civil inválida %s não escreve histórico',async dataValidade=>{
  expect((await write('/api/documentos/92194',{versao:0,dataValidade})).status).toBe(400);
  expect(await fixture.sql`SELECT id FROM documento_historico WHERE documento_veiculo_id=92194`).toHaveLength(0);
});

test('filtros por veículo SVO, CNH, situação e período civil inclusivo usam registros reais',async()=>{
  await fixture.sql`UPDATE documento_veiculo SET data_vencimento=CURRENT_DATE WHERE id=92194`;
  const hoje=await get('/api/documentos/consulta?veiculoId=92194&situacao=HOJE');expect(hoje.status).toBe(200);
  expect((await hoje.json()).data).toHaveLength(1);
  expect((await(await get('/api/documentos/consulta?motoristaId=92199&tipo=CNH_MOTORISTA')).json()).data[0].registroId).toBe('92199');
  expect((await(await get('/api/documentos/consulta?veiculoId=92195&inicio=2028-02-29&fim=2028-02-29')).json()).data).toHaveLength(1);
  expect((await(await get('/api/documentos/consulta?veiculoId=92195&inicio=2028-03-01')).json()).meta.total).toBe(0);
  for(const query of ['inicio=2026-02-30','inicio=2028-03-01&fim=2028-02-29','page=1e2','tipo=OUTRO','limit=101','page=1&page=2'])
    expect((await get('/api/documentos/consulta?'+query)).status).toBe(400);
});

test('anexo de outra entidade não pode integrar versão; arquivo correto pode',async()=>{
  const form=new FormData();form.append('tipoRegistro','DOCUMENTO_VEICULO');form.append('registroId','92195');
  form.append('arquivo',new Blob([new Uint8Array(pngAnexo)],{type:'image/png'}),'x.png');
  const {data}=await(await fetch(base+'/api/anexos',{method:'POST',headers:headers(),body:form})).json();
  expect((await write('/api/documentos/92194',{versao:0,dataValidade:'2029-01-01',anexoId:data.id})).status).toBe(404);
  expect((await write('/api/documentos/92195',{versao:0,dataValidade:'2029-01-01',anexoId:data.id})).status).toBe(200);
  expect((await(await get('/api/documentos/92195/historico')).json()).data[0].anexoId).toBe(data.id);
});

test('401/403/404 protegem listagem, detalhe/histórico e edição',async()=>{
  for(const path of ['/api/documentos/consulta','/api/documentos/92194','/api/documentos/92194/historico']){
    expect((await get(path,null)).status).toBe(401);
    for(const perfil of ['MOTORISTA','ATENDENTE_SVO','SOLICITANTE_INTERNO'])expect((await get(path,perfil)).status).toBe(403);
  }
  expect((await get('/api/documentos/999999999')).status).toBe(404);
  expect((await get('/api/documentos/999999999/historico')).status).toBe(404);
});

test('falha real de auditoria reverte alteração e versão; legado não persiste cadastro parcial',async()=>{
  await falharAuditoriaAnexo(fixture.admin,async()=>{
    expect((await write('/api/documentos/92194',{versao:0,dataValidade:'2029-01-01'})).status).toBe(500);
    expect((await write('/api/documentos',{veiculo_id:92194,tipo_documento:'Não deve persistir',data_vencimento:'2029-01-01'},'POST')).status).toBe(500);
  });
  expect((await(await get('/api/documentos/92194')).json()).data).toMatchObject({dataValidade:'2028-02-29',versao:0});
  expect(await fixture.sql`SELECT id FROM documento_veiculo WHERE tipo_documento='Não deve persistir' AND veiculo_id=92194`).toHaveLength(0);
});
