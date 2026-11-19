import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let token: string;
const veiculo = 91860;
const svo = 91861;
beforeAll(async () => {
  await sql`INSERT INTO usuario (id,nome,email,senha_hash,perfil,ativo) VALUES (91860,'Fixture S9 Gestor','s9-conciliacao@example.invalid','sem-login','GESTOR_FROTA',true)`;
  await sql`INSERT INTO veiculo (id,placa,marca,modelo,ano,tipo,is_svo) VALUES
    (91860,'S9AB060','Fixture','Fixture',2026,'PASSEIO',false),
    (91861,'S9AB061','Fixture','Fixture SVO',2026,'RABECÃO_SVO',true)`;
  token = await criarJwt({id:'91860',perfil:'GESTOR_FROTA'});
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(()=>resolve()));
  await sql`DELETE FROM log_atividade WHERE usuario_id=91860`;
  await sql`DELETE FROM abastecimento WHERE veiculo_id IN (91860,91861)`;
  await sql`DELETE FROM veiculo WHERE id IN (91860,91861)`;
  await sql`DELETE FROM usuario WHERE id=91860`;
  await sql.end();
});
const input={veiculo_id:veiculo,litragem:'12.34',valor_total:'56.78',data_abastecimento:'2026-11-10'};
const post=(body:unknown,auth=true)=>fetch(base+'/api/abastecimentos',{method:'POST',headers:{...(auth?{Authorization:`Bearer ${token}`}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});
test('persiste campos ausentes, autor autenticado e auditoria',async()=>{
  const response=await post({...input,criado_por_id:'-27001'});
  expect(response.status).toBe(201);
  const {data}=await response.json();
  const [row]=await sql`SELECT motorista_id,quilometragem,criado_por_id FROM abastecimento WHERE id=${data.id}`;
  expect(row).toEqual({motorista_id:null,quilometragem:null,criado_por_id:'91860'});
  const [audit]=await sql`SELECT usuario_id FROM log_atividade WHERE usuario_id=91860 AND descricao=${`Registrou abastecimento ID ${data.id}`}`;
  expect(audit.usuario_id).toBe('91860');
});
test('aceita veículo SVO e conserva quilometragem zero',async()=>{
  const response=await post({...input,veiculo_id:svo,quilometragem:0});
  expect(response.status).toBe(201);
  expect((await response.json()).data.quilometragem).toBe(0);
});
test.each([{litragem:0},{valor_total:0},{quilometragem:-1}])('recusa entrada inválida %j',async extra=>{
  expect((await post({...input,...extra})).status).toBe(400);
});
test('exige autenticação',async()=>{expect((await post(input,false)).status).toBe(401);});