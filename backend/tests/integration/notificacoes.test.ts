import { beforeAll, afterAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';
import { notificacoesSchemas } from '../../src/modules/notificacoes/notificacoes.schemas.js';
import { registrarAtividades } from '../../src/modules/auditoria/auditoria.service.js';

const sql = await verifiedSql();
const server = createApp();
let base: string, gestor: string, outro: string, inativo: string;
beforeAll(async()=>{
  await sql`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES
    (91001,'Fixture notificações','notif-gestor@example.invalid','sem-login','GESTOR_FROTA',true),
    (91002,'Fixture destinatário','notif-outro@example.invalid','sem-login','SOLICITANTE_INTERNO',true),
    (91003,'Fixture inativo','notif-inativo@example.invalid','sem-login','ADM',false)`;
  [gestor,outro,inativo] = await Promise.all(['91001','91002','91003'].map(id=>criarJwt({id,perfil:'ADM'})));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await sql`DELETE FROM public.notificacao WHERE descricao='Solicitação #TRP-91001'`;
  await sql`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id=91001`;
  await sql`DELETE FROM public.solicitacao_viagem WHERE id=91001`;
  await sql`DELETE FROM public.motorista WHERE id=91001`;
  await sql`DELETE FROM public.usuario WHERE id IN (91001,91002,91003)`;
  await sql.end();
});
function call(path='',method='GET',token=gestor) {
  return fetch(base+'/api/notificacoes'+path,{method,headers:{Authorization:`Bearer ${token}`}});
}
test('caixa exige sessão atual, limita filtros e oculta destinatários alheios',async()=>{
  expect((await fetch(base+'/api/notificacoes')).status).toBe(401);
  expect((await call('','GET',inativo)).status).toBe(401);
  for (const query of ['?page=0','?limit=101','?usuarioId=91002','?filtro=outro','?page=1&page=2']) {
    expect((await call(query)).status).toBe(400);
  }
  const [row] = await sql`INSERT INTO public.notificacao(usuario_id,chave,titulo,descricao,categoria)
    VALUES(91001,'fixture-leitura','Aviso real','Descrição mínima','informacao') RETURNING id::text`;
  const caixa = notificacoesSchemas.ListaNotificacoes.parse(await (await call()).json());
  expect(caixa.data.some(n=>n.id===row.id)).toBe(true);
  expect((await call(`/${row.id}/ler`,'POST',outro)).status).toBe(404);
  expect((await call(`/${row.id}/ler`,'POST')).status).toBe(200);
  const [lida] = await sql`SELECT lida_em FROM public.notificacao WHERE id=${row.id}`;
  expect(lida.lida_em).toBeInstanceOf(Date);
  await call(`/${row.id}/ler`,'POST');
  const [repetida] = await sql`SELECT lida_em FROM public.notificacao WHERE id=${row.id}`;
  expect(repetida.lida_em).toEqual(lida.lida_em);
});
test('evento de solicitação e aviso são atômicos; rollback não deixa notificação',async()=>{
  const [antes] = await sql`SELECT count(*)::int AS total FROM public.notificacao WHERE usuario_id=91001`;
  await expect(sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,data_hora_saida)
      VALUES(91001,'TRP-91001',91002,'Sede','Unidade','2030-01-01 10:00:00')`;
    await registrarAtividades(tx,'91002',[{operacao:'solicitacao_viagem_criada',recursoId:'91001'}]);
    const [aviso] = await tx`SELECT titulo FROM public.notificacao WHERE usuario_id=91001 AND descricao='Solicitação #TRP-91001'`;
    expect(aviso.titulo).toBe('Nova solicitação aguardando análise');
    throw new Error('rollback da fixture');
  })).rejects.toThrow('rollback da fixture');
  const [depois] = await sql`SELECT count(*)::int AS total FROM public.notificacao WHERE usuario_id=91001`;
  expect(depois.total).toBe(antes.total);
});

test('evento confirmado aparece na caixa do solicitante e vencimento não duplica a cada sincronização',async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,data_hora_saida)
      VALUES(91001,'TRP-91001',91002,'Sede','Unidade','2030-01-01 10:00:00')`;
    await registrarAtividades(tx,'91002',[{operacao:'solicitacao_viagem_criada',recursoId:'91001'}]);
  });
  const caixa = notificacoesSchemas.ListaNotificacoes.parse(await (await call('','GET',outro)).json());
  expect(caixa.data.some(n=>n.descricao==='Solicitação #TRP-91001')).toBe(true);
  await sql`INSERT INTO public.motorista(id,nome,cnh,categoria_cnh,validade_cnh)
    VALUES(91001,'Fixture CNH notificações','NOTIF91001','B',timezone('America/Maceio',CURRENT_TIMESTAMP)::date-1)`;
  expect((await call('/sincronizar','POST')).status).toBe(200);
  expect((await call('/sincronizar','POST')).status).toBe(200);
  const rows = await sql`SELECT categoria FROM public.notificacao WHERE usuario_id=91001 AND chave LIKE 'cnh:91001:%'`;
  expect(rows).toHaveLength(1);expect(rows[0].categoria).toBe('urgente');
  const outraCaixa = await sql`SELECT id FROM public.notificacao WHERE usuario_id=91002 AND chave LIKE 'cnh:%'`;
  expect(outraCaixa).toHaveLength(0);
});
