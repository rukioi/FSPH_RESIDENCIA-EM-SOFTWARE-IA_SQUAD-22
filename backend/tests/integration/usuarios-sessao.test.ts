import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { criarJwt } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;
const server = createApp();
let base: string;
let adminToken: string;
const ids = [29001, 29002];
beforeAll(async () => {
  sql = await verifiedSql();
  await sql`insert into public.usuario (id,nome,email,senha_hash,perfil,ativo) values
    (29001,'Fixture T29 Admin','t29-admin@example.invalid','fixture-sem-login','ADM',true),
    (29002,'Fixture T29 Alvo','t29-alvo@example.invalid','fixture-sem-login','GESTOR_FROTA',true)`;
  adminToken = await criarJwt({ id: '29001', perfil: 'ADM' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await sql`delete from public.log_atividade where usuario_id in ${sql(ids)}`;
  await sql`delete from public.usuario where id in ${sql(ids)} or email = 't29-novo@example.invalid'`;
  await sql.end();
});
async function call(path: string, token = adminToken, method = 'GET', body?: unknown) {
  return fetch(base + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
}
test('usuário inativo/inexistente é 401 e perfil efetivo muda acesso sem novo JWT', async () => {
  const token = await criarJwt({ id: '29002', perfil: 'ADM' });
  expect((await call('/api/admin/usuarios', token)).status).toBe(403);
  expect((await (await call('/api/auth/sessao', token)).json()).data.perfil).toBe('GESTOR_FROTA');
  await sql`update public.usuario set perfil='ADM' where id=29002`;
  expect((await call('/api/admin/usuarios', token)).status).toBe(200);
  await sql`update public.usuario set ativo=false where id=29002`;
  expect((await call('/api/auth/sessao', token)).status).toBe(401);
  expect((await call('/api/admin/usuarios', await criarJwt({ id:'29999', perfil:'ADM' }))).status).toBe(401);
});
test('campos internos e perfis visuais são rejeitados sem alterar o registro', async () => {
  for (const extra of [{ativo:false}, {senha_hash:'privado'}, {id:7}, {criado_em:'2020-01-01'}, {perfil:'Gestor da Frota'}]) {
    const response = await call('/api/admin/usuarios/29002', adminToken, 'PUT',
      {nome:'Fixture T29 Alvo',email:'t29-alvo@example.invalid',perfil:'SOLICITANTE_INTERNO',...extra});
    expect(response.status).toBe(400);
  }
});
test('status exige booleano explícito e repetição não inverte nem duplica auditoria', async () => {
  const path='/api/admin/usuarios/29002/status';
  expect((await call(path,adminToken,'PATCH')).status).toBe(400);
  expect((await call(path,adminToken,'PATCH',{ativo:'true'})).status).toBe(400);
  for (let i=0;i<2;i++) {
    const response=await call(path,adminToken,'PATCH',{ativo:true});
    expect(response.status).toBe(200);
    expect((await response.json()).ativo).toBe(true);
  }
  const [row]=await sql`select count(*)::int as n from public.log_atividade where usuario_id=29001 and descricao like '%29002%Ativo%'`;
  expect(row.n).toBe(1);
});
test('cadastro e edição persistem enum real e nunca retornam hash', async () => {
  const dados={nome:'Fixture T29 Novo',email:'t29-novo@example.invalid',perfil:'SOLICITANTE_INTERNO',senha:'T29-fixture-2026!'};
  const response=await call('/api/admin/usuarios',adminToken,'POST',dados);
  expect(response.status).toBe(201);
  const novo=await response.json();
  expect(novo.perfil).toBe('SOLICITANTE_INTERNO');
  expect(novo).not.toHaveProperty('senha_hash');
  const updated=await call(`/api/admin/usuarios/${novo.id}`,adminToken,'PUT',{nome:dados.nome,email:dados.email,perfil:'GESTOR_FROTA'});
  expect(updated.status).toBe(200);
  expect((await updated.json()).perfil).toBe('GESTOR_FROTA');
  expect((await call('/api/admin/usuarios/29999/status',adminToken,'PATCH',{ativo:true})).status).toBe(404);
});

test('todas as famílias protegidas negam ausência de token e usuário desativado', async () => {
  const token=await criarJwt({id:'29002',perfil:'ADM'});
  await sql`update public.usuario set ativo=false where id=29002`;
  for (const [method,path] of [
    ['GET','/api/auth/sessao'], ['GET','/api/dashboard'], ['GET','/api/dashboard/graficos'],
    ['GET','/api/dashboard/pendencias'], ['GET','/api/dashboard/gestor'],
    ['GET','/api/veiculos'], ['POST','/api/veiculos'], ['PUT','/api/veiculos/1'], ['DELETE','/api/veiculos/1'],
    ['GET','/api/motoristas'], ['POST','/api/motoristas'], ['PATCH','/api/motoristas/1'], ['DELETE','/api/motoristas/1'],
    ['GET','/api/documentos'], ['POST','/api/documentos'], ['GET','/api/documentos/pendencias'],
    ['GET','/api/abastecimentos'], ['POST','/api/abastecimentos'],
    ['GET','/api/admin/usuarios'], ['POST','/api/admin/usuarios'], ['PUT','/api/admin/usuarios/1'],
    ['PATCH','/api/admin/usuarios/1/status'], ['GET','/api/admin/auditoria/logs'],
    ['GET','/api/svo/ordens-coleta'], ['POST','/api/svo/solicitacoes'], ['PATCH','/api/svo/ordens-coleta/1/despachar'],
  ]) {
    expect((await fetch(base+path,{method})).status,path).toBe(401);
    expect((await call(path,token,method)).status,path).toBe(401);
  }
  const huge=await criarJwt({id:'99999999999999999999',perfil:'ADM'});
  expect((await call('/api/auth/sessao',huge)).status).toBe(401);
});
test('concorrência de status grava apenas uma mudança e preserva matriz sem equivalência ADM/SVO',async()=>{
  const path='/api/admin/usuarios/29002/status';
  const responses=await Promise.all([call(path,adminToken,'PATCH',{ativo:true}),call(path,adminToken,'PATCH',{ativo:true})]);
  expect(responses.map(r=>r.status)).toEqual([200,200]);
  const [count]=await sql`select count(*)::int as n from public.log_atividade where usuario_id=29001 and descricao like '%29002%Ativo%'`;
  expect(count.n).toBe(2); // One earlier activation and one concurrent transition, not two.
  expect((await call('/api/svo/ordens-coleta',adminToken)).status).toBe(403);
});
