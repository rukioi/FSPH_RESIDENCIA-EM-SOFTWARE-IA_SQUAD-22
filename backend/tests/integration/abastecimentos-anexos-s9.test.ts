import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { request } from 'node:http';
import { createApp } from '../../src/app.js';
import { anexosSchemas } from '../../src/modules/anexos/anexos.schemas.js';
import { falharAuditoriaAnexo, pngAnexo, prepararAnexos } from '../helpers/anexos-fixture.js';

const server=createApp();
let fixture:Awaited<ReturnType<typeof prepararAnexos>>;
let base:string;
beforeAll(async()=>{
  fixture=await prepararAnexos();
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async()=>{await fixture?.limparUploads();});
afterAll(async()=>{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await fixture?.limpar();
});
const headers=(ator:string|null='ADM'):Record<string,string>=>ator?{Authorization:`Bearer ${fixture.tokens[ator]}`}:{ };
const get=(path:string,ator:string|null='ADM')=>fetch(base+path,{headers:headers(ator)});
const caminho='/api/abastecimentos/92194/comprovante';
function enviar(bytes=pngAnexo,tipo='image/png',nome='comprovante.png',ator:string|null='ADM',path=caminho,extra=false){
  const body=new FormData();body.append('arquivo',new Blob([new Uint8Array(bytes)],{type:tipo}),nome);
  if(extra)body.append('registroId','92195');
  return fetch(base+path,{method:'POST',headers:headers(ator),body});
}

test.each(['image/png','image/jpeg','application/pdf'])('comprovante %s persiste no anexo comum e sobrevive à reconsulta',async tipo=>{
  const bytes=tipo==='image/png'?pngAnexo:tipo==='image/jpeg'?Buffer.from('ffd8ff01','hex'):Buffer.from('%PDF-1.7 fixture');
  const response=await enviar(bytes,tipo,'comprovante-privado');
  expect(response.status).toBe(201);
  const {data}=anexosSchemas.RespostaAnexo.parse(await response.json());
  expect(data).toMatchObject({tipoRegistro:'ABASTECIMENTO',registroId:'92194',autorId:'92194'});
  expect(await fixture.sql`SELECT abastecimento_id,dados FROM anexo WHERE id=${data.id}`)
    .toEqual([{abastecimento_id:'92194',dados:bytes}]);
  expect(await fixture.sql`SELECT * FROM abastecimento_comprovante WHERE abastecimento_id=92194`).toHaveLength(0);
  for(let reload=0;reload<2;reload++){
    const detalhe=await(await get('/api/abastecimentos/92194')).json();
    expect(detalhe.data.comprovante_nome).toBe('comprovante-privado');
    const download=await get(caminho);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe(tipo);
    expect(download.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
    expect((await(await get('/api/anexos?tipoRegistro=ABASTECIMENTO&registroId=92194')).json()).data).toEqual([data]);
  }
  expect((await get('/api/abastecimentos/92195/comprovante')).status).toBe(404);
});

test('reenvio acrescenta histórico, devolve último confirmado e não duplica linhas da listagem',async()=>{
  const primeiro=await(await enviar()).json();
  const pdf=Buffer.from('%PDF-1.7 segundo');
  const segundo=await(await enviar(pdf,'application/pdf','novo.pdf')).json();
  expect(primeiro.data.id).not.toBe(segundo.data.id);
  const lista=await(await get('/api/abastecimentos?veiculoId=92194&pagina=1')).json();
  expect(lista.data).toHaveLength(1);
  expect(lista.data[0].comprovante_nome).toBe('novo.pdf');
  expect(Buffer.from(await(await get(caminho)).arrayBuffer())).toEqual(pdf);
  expect(Buffer.from(await(await get('/api/anexos/'+primeiro.data.id)).arrayBuffer())).toEqual(pngAnexo);
});

test('401/403 usam perfil atual; 404 não fabrica vínculo e ID do form não substitui o path',async()=>{
  expect((await enviar(pngAnexo,'image/png','x',null)).status).toBe(401);
  for(const ator of ['MOTORISTA','ATENDENTE_SVO','SOLICITANTE_INTERNO']){
    expect((await enviar(pngAnexo,'image/png','x',ator)).status).toBe(403);
    expect((await get(caminho,ator)).status).toBe(403);
  }
  expect((await enviar(pngAnexo,'image/png','x','ADM','/api/abastecimentos/999999999/comprovante')).status).toBe(404);
  expect((await enviar(pngAnexo,'image/png','x','ADM',caminho,true)).status).toBe(400);
  expect(await fixture.sql`SELECT id FROM anexo WHERE autor_id=92194`).toHaveLength(0);
});

test('415/413 preservam comprovante anterior e o abastecimento',async()=>{
  const anterior=await(await enviar()).json();
  expect((await enviar(Buffer.from('falsificado'),'application/pdf')).status).toBe(415);
  expect((await enviar(pngAnexo,'text/plain')).status).toBe(415);
  const grande=Buffer.alloc(5242881,1);pngAnexo.copy(grande);
  expect((await enviar(grande)).status).toBe(413);
  const getAnterior=await get(caminho);
  expect(Buffer.from(await getAnterior.arrayBuffer())).toEqual(pngAnexo);
  expect(await fixture.sql`SELECT id FROM anexo WHERE abastecimento_id=92194`).toEqual([{id:anterior.data.id}]);
  expect(await fixture.sql`SELECT id FROM abastecimento WHERE id=92194`).toHaveLength(1);
});

test('falha da auditoria não substitui comprovante nem remove cadastro',async()=>{
  await enviar(pngAnexo,'image/png','anterior.png','GESTOR_FROTA');
  await falharAuditoriaAnexo(fixture.admin,async()=>{
    const response=await enviar(Buffer.from('%PDF-1.7 novo'),'application/pdf','novo.pdf');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/SQL|stack|fixture|novo.pdf/);
  });
  expect(await fixture.sql`SELECT nome FROM anexo WHERE abastecimento_id=92194`).toEqual([{nome:'anterior.png'}]);
  expect((await(await get('/api/abastecimentos/92194')).json()).data.comprovante_nome).toBe('anterior.png');
  expect((await enviar()).status).toBe(201);
});

test('conexão interrompida antes do corpo completo não grava anexo nem derruba serviço',async()=>{
  await new Promise<void>(resolve=>{
    const req=request(base+caminho,{method:'POST',headers:{...headers(),
      'Content-Type':'multipart/form-data; boundary=teste-anexo','Content-Length':'100000'}},response=>response.resume());
    req.on('error',()=>resolve());
    req.on('close',()=>resolve());
    req.write('--teste-anexo\r\nContent-Disposition: form-data; name="arquivo"; filename="x.png"\r\n');
    req.end();
    setTimeout(()=>req.destroy(),30);
  });
  expect(await fixture.sql`SELECT id FROM anexo WHERE abastecimento_id=92194`).toHaveLength(0);
  expect((await enviar()).status).toBe(201);
});
