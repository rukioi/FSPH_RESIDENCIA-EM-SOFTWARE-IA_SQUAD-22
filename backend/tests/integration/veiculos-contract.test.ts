import { beforeAll, afterAll, expect, test, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { operations, schemas } from '../../src/shared/contract/registry.js';
import { veiculo, listaVeiculos, respostaVeiculo } from '../../src/modules/veiculos/veiculos.schemas.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let admin: string;
let svo: string;
let negado: string;
let inactive: string;
const input = { placa:'T32TEST', marca:'Fixture', modelo:'Contrato #32', ano:2026 };
beforeAll(async () => {
  await sql`INSERT INTO public.usuario (id,nome,email,senha_hash,perfil,ativo) VALUES
    (32001,'Fixture T32 ADM','t32-adm@example.invalid','sem-login','ADM',true),
    (32002,'Fixture T32 SVO','t32-svo@example.invalid','sem-login','ATENDENTE_SVO',true),
    (32003,'Fixture T32 Motorista','t32-motorista@example.invalid','sem-login','MOTORISTA',true),
    (32004,'Fixture T32 Inativo','t32-inativo@example.invalid','sem-login','ADM',false)`;
  [admin,svo,negado,inactive] = await Promise.all(['32001','32002','32003','32004'].map(id=>criarJwt({id,perfil:'ADM'})));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await sql`DELETE FROM public.documento_veiculo WHERE veiculo_id IN (SELECT id FROM public.veiculo WHERE placa LIKE 'T32%')`;
  await sql`DELETE FROM public.veiculo WHERE placa LIKE 'T32%'`;
  await sql`DELETE FROM public.usuario WHERE id IN (32001,32002,32003,32004)`;
  await sql.end();
});
function call(path:string,method='GET',body?:unknown,token=admin) {
  return fetch(base+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body)});
}
test('todas as operações protegidas do inventário mantêm 401 e a correlação',async()=>{
  for (const operation of operations.filter(o=>o.perfis.length)) {
    const response = await fetch(base+operation.path.replace('{id}','1'),{method:operation.method.toUpperCase()});
    expect(response.status,operation.id).toBe(401);
    expect(response.headers.get('X-Request-Id')).toMatch(/^[a-f0-9-]{36}$/);
  }
});
test('piloto preserva perfis efetivos, conta inativa e método/Allow antes de autenticação',async()=>{
  expect((await call('/api/veiculos','GET',undefined,negado)).status).toBe(403);
  expect((await call('/api/veiculos','GET',undefined,inactive)).status).toBe(401);
  expect((await call('/api/veiculos','POST',input,svo)).status).toBe(403);
  expect((await call('/api/veiculos','GET',undefined,svo)).status).toBe(200);
  const method = await fetch(base+'/api/veiculos',{method:'OPTIONS'});
  expect(method.status).toBe(405); expect(method.headers.get('Allow')).toBe('GET, POST');
  expect((await fetch(base+'/api/veiculos/1')).status).toBe(405);
  expect((await fetch(base+'/api/dashboard/kpis')).status).toBe(404);
});
test('HTTP e PostgreSQL preservam cadastro/defaults, parcialidade, vínculo, duplicidade e exclusão',async()=>{
  expect((await call('/api/veiculos','POST',{...input,capacidade_passageiros:0})).status).toBe(400);
  expect((await call('/api/veiculos','POST',{...input,vinculo:'LOCADO'})).status).toBe(400);
  expect((await call('/api/veiculos','POST',{...input,status:null})).status).toBe(400);
  const created = await call('/api/veiculos','POST',{...input,ignorado:'sem efeito'});
  expect(created.status).toBe(201);
  const row = respostaVeiculo.parse(await created.json()).data;
  expect(row).toMatchObject({tipo:'PASSEIO',status:'DISPONIVEL',capacidade_obitos:0,capacidade_passageiros:5,quilometragem_atual:0,is_svo:false,vinculo:'PROPRIO',fornecedor_locacao:null});
  expect(typeof row.id).toBe('string'); expect(row.criado_em).toMatch(/T/);
  expect((await call('/api/veiculos','POST',input)).status).toBe(409);
  const updated = await call('/api/veiculos/'+row.id,'PUT',{marca:'Fixture editada',ano:1901,tipo:'VAN',capacidade_obitos:99});
  expect(updated.status).toBe(200);
  expect(respostaVeiculo.parse(await updated.json()).data).toMatchObject({marca:'Fixture editada',ano:2026,tipo:'PASSEIO',capacidade_obitos:0});
  const rented = await call('/api/veiculos/'+row.id,'PATCH',{vinculo:'LOCADO',fornecedor_locacao:'Fixture locação'});
  expect(rented.status).toBe(200);
  expect((await call('/api/veiculos/'+row.id,'PATCH',{vinculo:'LOCADO'})).status).toBe(400);
  const retained = respostaVeiculo.parse(await (await call('/api/veiculos/'+row.id,'PATCH',{fornecedor_locacao:null})).json()).data;
  expect(retained.fornecedor_locacao).toBe('Fixture locação');
  const own = respostaVeiculo.parse(await (await call('/api/veiculos/'+row.id,'PATCH',{vinculo:'PROPRIO'})).json()).data;
  expect(own.fornecedor_locacao).toBeNull();
  expect(veiculo.parse(JSON.parse(JSON.stringify((await sql`SELECT * FROM public.veiculo WHERE id=${row.id}`)[0])))).toEqual(own);
  expect((await call('/api/veiculos/0','PATCH',{})).status).toBe(404);
  expect(await (await call('/api/veiculos/'+row.id,'DELETE')).json()).toEqual({data:{success:true}});
  expect((await call('/api/veiculos/'+row.id,'DELETE')).status).toBe(404);
});
test('BIGINT acima de MAX_SAFE_INTEGER e colunas nullable sobrevivem sem conversão silenciosa',async()=>{
  await sql`INSERT INTO public.veiculo (id,placa,marca,modelo,ano,tipo,status,capacidade_obitos,capacidade_passageiros,quilometragem_atual,is_svo,criado_em)
    VALUES (9007199254740993,'T32BIG','Fixture','Precisão',2026,'PASSEIO',null,null,null,null,null,null)`;
  const rows = listaVeiculos.parse(await (await call('/api/veiculos')).json()).data;
  expect(rows.find(row=>row.placa==='T32BIG')).toMatchObject({id:'9007199254740993',status:null,criado_em:null});
});
test('FK de exclusão conserva 500 legado sem SQL/dado sensível',async()=>{
  const row = respostaVeiculo.parse(await (await call('/api/veiculos','POST',{...input,placa:'T32FK'})).json()).data;
  await sql`INSERT INTO public.documento_veiculo (veiculo_id,tipo_documento,data_vencimento) VALUES (${row.id},'Fixture','2030-01-01')`;
  const log = vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
    const response = await call('/api/veiculos/'+row.id,'DELETE');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({error:{code:'ERRO_INTERNO',message:'Falha ao remover veículo.'}});
    expect(JSON.stringify(log.mock.calls)).not.toContain('documento_veiculo');
  } finally { log.mockRestore(); }
});
test('consultas legadas reais correspondem aos schemas sem exigir migração de formato',async()=>{
  for (const operation of operations.filter(o=>o.method==='get' && o.modulo!=='veiculos')) {
    const path = operation.path+(operation.modulo==='svo' ? '?status=AGUARDANDO_DESPACHO' : '');
    const response = await call(path,'GET',undefined,operation.modulo==='svo' ? svo : admin);
    expect(response.status,operation.id).toBe(200);
    const body = await response.json();
    const result = schemas[operation.response].safeParse(body);
    expect(result.success,result.success ? operation.id : operation.id+JSON.stringify(result.error.issues)).toBe(true);
  }
  const paged = await call('/api/admin/auditoria/logs?page=1&limit=2');
  expect(schemas.Auditoria.safeParse(await paged.json()).success).toBe(true);
});
