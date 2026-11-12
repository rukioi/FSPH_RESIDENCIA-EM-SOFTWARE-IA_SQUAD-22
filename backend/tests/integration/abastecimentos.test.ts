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


test('imagem protegida é persistida atomicamente e devolvida apenas no download autorizado', async () => {
  const bytes = Buffer.from([137,80,78,71,13,10,26,10,1,2,3]);
  const response = await call({...input, tanque_completo:true,
    comprovante:{nome:'comprovante.png',tipo:'image/png',dadosBase64:bytes.toString('base64')}});
  expect(response.status).toBe(201);
  const {data} = await response.json();
  expect(data).toMatchObject({tanque_completo:true, comprovante_nome:'comprovante.png'});
  expect(data).not.toHaveProperty('dados');
  const url = base+`/api/abastecimentos/${data.id}/comprovante`;
  expect((await fetch(url)).status).toBe(401);
  const svo = await criarJwt({id:'30002',perfil:'ATENDENTE_SVO'});
  await sql`update usuario set ativo=true where id=30002`;
  expect((await fetch(url,{headers:{Authorization:`Bearer ${svo}`}})).status).toBe(403);
  const download = await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
  expect(download.status).toBe(200);
  expect(download.headers.get('content-type')).toBe('image/png');
  expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
  const lista = await (await fetch(base+'/api/abastecimentos',{headers:{Authorization:`Bearer ${token}`}})).json();
  const item = lista.data.find((entry: {id:string}) => entry.id === data.id);
  expect(item).toMatchObject({tanque_completo:true,comprovante_nome:'comprovante.png'});
  expect(JSON.stringify(item)).not.toContain(bytes.toString('base64'));
  expect((await fetch(base+'/api/abastecimentos/99999999/comprovante',{headers:{Authorization:`Bearer ${token}`}})).status).toBe(404);
});

test.each([
  {tipo:'image/png',nome:'integridade.png',bytes:Buffer.from([137,80,78,71,13,10,26,10,0,92,255,42])},
  {tipo:'image/jpeg',nome:'integridade.jpg',bytes:Buffer.from([255,216,255,0,92,128,255,217])},
])('bytes originais persistidos para $tipo e retornados no download',async ({tipo,nome,bytes})=>{
  const response=await call({...input,comprovante:{nome,tipo,dadosBase64:bytes.toString('base64')}});
  expect(response.status).toBe(201);
  const {data}=await response.json();
  const [stored]=await sql`SELECT encode(dados,'hex') AS hex,octet_length(dados)::int AS tamanho FROM public.abastecimento_comprovante WHERE abastecimento_id=${data.id}`;
  expect(stored).toEqual({hex:bytes.toString('hex'),tamanho:bytes.length});
  const download=await fetch(base+`/api/abastecimentos/${data.id}/comprovante`,{headers:{Authorization:`Bearer ${token}`}});
  expect(download.status).toBe(200);expect(download.headers.get('content-type')).toBe(tipo);
  expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
});

test('rejeita comprovantes inválidos e preserva cadastro legado sem imagem', async () => {
  for (const comprovante of [
    {nome:'../foto.png',tipo:'image/png',dadosBase64:'iVBORw0KGgo='},
    {nome:'foto.png',tipo:'image/png',dadosBase64:'AAAA'},
    {nome:'foto.png',tipo:'image/png',dadosBase64:'!'},
    {nome:'foto.pdf',tipo:'application/pdf',dadosBase64:'JVBERi0='},
  ]) expect((await call({...input,comprovante})).status).toBe(400);
  const response = await call(input);
  expect(response.status).toBe(201);
  const {data} = await response.json();
  expect(data).toMatchObject({tanque_completo:false,comprovante_nome:null});
});


test('comprovantes não concedem acesso direto a papéis públicos', async () => {
  const [row] = await sql`select c.relrowsecurity,
    has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
    has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='abastecimento_comprovante'`;
  expect(row).toMatchObject({relrowsecurity:true,anon_select:false,authenticated_select:false});
});


test('falha na gravação da imagem reverte o abastecimento', async () => {
  const admin = await verifiedSql(true);
  let funcaoCriada = false;
  let triggerCriado = false;
  try {
    await admin.unsafe(`CREATE FUNCTION public.test_falha_comprovante() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'fixture'; END $$`);
    funcaoCriada = true;
    await admin.unsafe(`CREATE TRIGGER test_falha_comprovante BEFORE INSERT ON public.abastecimento_comprovante
      FOR EACH ROW EXECUTE FUNCTION public.test_falha_comprovante()`);
    triggerCriado = true;

    const [antes] = await sql`select count(*)::int as total from abastecimento where veiculo_id=30001`;
    const response = await call({...input,comprovante:{nome:'foto.png',tipo:'image/png',dadosBase64:'iVBORw0KGgo='}});
    expect(response.status).toBe(500);
    const [depois] = await sql`select count(*)::int as total from abastecimento where veiculo_id=30001`;
    expect(depois.total).toBe(antes.total);
  } finally {
    try {
      if (triggerCriado) await admin.unsafe('DROP TRIGGER test_falha_comprovante ON public.abastecimento_comprovante');
      if (funcaoCriada) await admin.unsafe('DROP FUNCTION public.test_falha_comprovante()');
    } finally { await admin.end(); }
  }
});
