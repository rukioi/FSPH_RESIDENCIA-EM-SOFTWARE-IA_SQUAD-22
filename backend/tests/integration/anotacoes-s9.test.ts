import { afterAll,afterEach,beforeAll,expect,test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { anotacoesSchemas } from '../../src/modules/anotacoes/anotacoes.schemas.js';
import { prepararAnexos,falharAuditoriaAnexo } from '../helpers/anexos-fixture.js';
const server=createApp();let fixture:Awaited<ReturnType<typeof prepararAnexos>>;let base:string;
beforeAll(async()=>{fixture=await prepararAnexos();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterEach(async()=>{await fixture?.limparUploads();});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));await fixture?.limpar();});
const headers=(ator:string|null):Record<string,string>=>ator?{Authorization:`Bearer ${fixture.tokens[ator]}`}:{ };
const post=(body:unknown,ator:string|null='ADM')=>fetch(base+'/api/anotacoes',{method:'POST',headers:{...headers(ator),'Content-Type':'application/json'},body:JSON.stringify(body)});
const get=(tipo='VEICULO',id='92194',ator:string|null='ADM',extra='')=>fetch(base+`/api/anotacoes?tipoRegistro=${tipo}&registroId=${id}${extra}`,{headers:headers(ator)});
const entrada={tipoRegistro:'VEICULO',registroId:'92194',texto:'Nota operacional sintética'};

test.each([
  ['VEICULO','ADM'],['SOLICITACAO_VIAGEM','SOLICITANTE_INTERNO'],['VIAGEM','MOTORISTA'],
  ['ORDEM_SVO','MOTORISTA'],['SOLICITACAO_SVO','ATENDENTE_SVO'],
])('nota %s persiste com ator/instante reais sem alterar estado',async(tipoRegistro,ator)=>{
  const antes=await fixture.sql`SELECT status FROM ordem_coleta WHERE id=92194`;
  const response=await post({...entrada,tipoRegistro},ator);expect(response.status).toBe(201);
  const {data}=anotacoesSchemas.RespostaAnotacao.parse(await response.json());
  expect(await fixture.sql`SELECT texto,autor_id,criado_em FROM anotacao WHERE id=${data.id}`)
    .toEqual([{texto:entrada.texto,autor_id:data.autorId,criado_em:new Date(data.criadoEm)}]);
  for(let reload=0;reload<2;reload++)expect(anotacoesSchemas.ListaAnotacoes.parse(await(await get(tipoRegistro,'92194',ator)).json()).data).toEqual([data]);
  expect(await fixture.sql`SELECT status FROM ordem_coleta WHERE id=92194`).toEqual(antes);
  expect((await(await get(tipoRegistro,'92195',ator==='MOTORISTA'?'outroMotorista':ator==='SOLICITANTE_INTERNO'?'outroSolicitante':ator)).json()).data).toEqual([]);
});

test('401/403/404 protegem lista e inclusão; não há edição/exclusão',async()=>{
  expect((await post(entrada,null)).status).toBe(401);expect((await get('VEICULO','92194',null)).status).toBe(401);
  expect((await post(entrada,'MOTORISTA')).status).toBe(403);expect((await get('VEICULO','92194','ATENDENTE_SVO')).status).toBe(403);
  for(const [tipo,ator] of [['SOLICITACAO_VIAGEM','outroSolicitante'],['VIAGEM','outroMotorista'],['ORDEM_SVO','outroMotorista']]){
    expect((await post({...entrada,tipoRegistro:tipo},ator)).status).toBe(404);
    expect((await get(tipo,'92194',ator)).status).toBe(404);
  }
  expect((await post({...entrada,registroId:'999999999'})).status).toBe(404);
  expect((await fetch(base+'/api/anotacoes',{method:'DELETE',headers:headers('ADM')})).status).toBe(405);
});

test('400 valida limite, controles, vínculo, autor injetado e campos extras',async()=>{
  for(const body of [{...entrada,texto:''},{...entrada,texto:'   '},{...entrada,texto:'x'.repeat(2001)},
    {...entrada,texto:'x\u0000y'},{...entrada,tipoRegistro:'ABASTECIMENTO'}, {...entrada,autorId:'92195'},
    {...entrada,registroId:'1 OR 1=1'}])expect((await post(body)).status).toBe(400);
  expect((await post({...entrada,texto:'x'.repeat(2000)})).status).toBe(201);
  expect((await get('ABASTECIMENTO')).status).toBe(400);
});

test('texto perigoso é dado JSON, não HTML; auditoria não copia o texto',async()=>{
  const texto='<script>alert("sentinela-privada")</script> & "texto"\nsegunda linha';
  const response=await post({...entrada,texto});expect(response.status).toBe(201);
  expect(response.headers.get('content-type')).toContain('application/json');
  const {data}=await response.json();expect(data.texto).toBe(texto);
  expect((await(await get()).json()).data[0].texto).toBe(texto);
  expect(await fixture.sql`SELECT descricao FROM log_atividade WHERE usuario_id=92194`)
    .toEqual([{descricao:`Registrou anotação ID ${data.id}`}]);
});

test('paginação e reenvio mantêm histórico de inserções confirmadas, sem deduplicação presumida',async()=>{
  const a=await(await post(entrada)).json();await post(entrada);await post({...entrada,registroId:'92195'});
  expect(await(await get('VEICULO','92194','ADM','&page=2&limit=1')).json())
    .toMatchObject({data:[a.data],meta:{page:2,limit:1,total:2}});
  for(const q of ['&page=1&page=2','&limit=101','&page=1e2','&extra=x'])expect((await get('VEICULO','92194','ADM',q)).status).toBe(400);
});

test('falha transacional não confirma nota; retry posterior confirma uma nota real',async()=>{
  await falharAuditoriaAnexo(fixture.admin,async()=>{
    const response=await post(entrada);expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/fixture|SQL|stack|operacional/);
    expect(await fixture.sql`SELECT id FROM anotacao WHERE autor_id=92194`).toHaveLength(0);
  });
  expect((await post(entrada)).status).toBe(201);
  expect((await(await get()).json()).meta.total).toBe(1);
});
