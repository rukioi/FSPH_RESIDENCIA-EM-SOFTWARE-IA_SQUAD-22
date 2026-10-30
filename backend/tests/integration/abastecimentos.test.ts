import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let token: string;
beforeAll(async () => {
  await sql`insert into usuario (id,nome,email,senha_hash,perfil,ativo) values
    (30001,'Fixture T30 Gestor','t30@example.invalid','sem-login','GESTOR_FROTA',true),
    (30002,'Fixture T30 SVO','t30-svo@example.invalid','sem-login','ATENDENTE_SVO',true)`;
  await sql`insert into veiculo (id,placa,marca,modelo,ano,tipo) values (30001,'T30AB01','Fixture','Fixture',2026,'PASSEIO')`;
  await sql`insert into motorista (id,nome,cnh,categoria_cnh,validade_cnh) values (30001,'Fixture T30','30000000001','B','2099-01-01')`;
  token = await criarJwt({ id:'30001', perfil:'GESTOR_FROTA' });
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await sql`delete from abastecimento where veiculo_id=30001`;
  await sql`delete from motorista where id=30001`;
  await sql`delete from veiculo where id=30001`;
  await sql`delete from usuario where id in (30001,30002)`;
  await sql.end();
});
const input = { veiculo_id:30001, motorista_id:30001, litragem:10.5, valor_total:63,
  quilometragem:1000, data_abastecimento:'2026-01-15', posto:'Fixture T30' };
function call(body: unknown, auth: string | null = token) {
  return fetch(base+'/api/abastecimentos', { method:'POST', headers:{'Content-Type':'application/json',
    ...(auth ? {Authorization:`Bearer ${auth}`} : {})}, body:JSON.stringify(body) });
}
test('exige sessão e perfil efetivo; conta inativa não passa',async () => {
  expect((await call(input,null)).status).toBe(401);
  const svo = await criarJwt({id:'30002',perfil:'GESTOR_FROTA'});
  expect((await call(input,svo)).status).toBe(403);
  await sql`update usuario set ativo=false where id=30002`;
  expect((await call(input,svo)).status).toBe(401);
});
test.each([null,[],42,{...input,motorista_id:null},{...input,quilometragem:null},
  {...input,litragem:{}},{...input,posto:123},{...input,posto:'x'.repeat(256)},{...input,quilometragem:1.5},
  {...input,data_abastecimento:'2026-02-30'}])('entrada técnica inválida retorna 400: %j',async body => {
  const response = await call(body);
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe('DADOS_INVALIDOS');
});
test('referência inexistente retorna 404 e não persiste',async () => {
  for (const body of [{...input,veiculo_id:30000999},{...input,motorista_id:30000999}]) {
    const response=await call(body);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('REFERENCIA_INEXISTENTE');
  }
});
test('JSON malformado retorna 400 e requisição seguinte grava no PostgreSQL isolado',async () => {
  const invalid=await fetch(base+'/api/abastecimentos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{'});
  expect(invalid.status).toBe(400);
  const response=await call(input);
  expect(response.status).toBe(201);
  const body=await response.json();
  const [row]=await sql`select * from abastecimento where id=${body.data.id}`;
  expect(row).toMatchObject({veiculo_id:'30001',motorista_id:'30001',quilometragem:1000,litragem:'10.50',valor_total:'63.00'});
});
