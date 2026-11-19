import { afterAll, beforeAll, expect, test } from 'vitest';

import type postgres from 'postgres';

import { readFileSync } from 'node:fs';

import { resolve } from 'node:path';

import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;

beforeAll(async () => { sql = await verifiedSql(true); });

afterAll(async () => { await sql?.end(); });

async function ensaio(operacao: (tx: postgres.TransactionSql) => Promise<void>) {

  const rollback = new Error('rollback deliberado da fixture DB-S9-01');

  await expect(sql.begin(async tx => { await operacao(tx); throw rollback; })).rejects.toBe(rollback);

}

test('RF40 permite motorista e km ausentes e mantém veículo/data obrigatórios', async () => {

  const columns = await sql`select column_name, is_nullable from information_schema.columns

    where table_schema='public' and table_name='abastecimento'`;

  const nullable = Object.fromEntries(columns.map(c => [c.column_name, c.is_nullable]));

  expect(nullable).toMatchObject({motorista_id:'YES',quilometragem:'YES',veiculo_id:'NO',data_abastecimento:'NO'});

  await ensaio(async tx => {

    const [row] = await tx`insert into public.abastecimento

      (id,veiculo_id,litragem,valor_total,data_abastecimento)

      values (-918501,-27001,10.50,63.00,'2026-11-13') returning motorista_id,quilometragem,posto`;

    expect(row).toEqual({motorista_id:null,quilometragem:null,posto:null});

  });

});

test.each([null,0,1500])('km %s é preservado e SVO usa o mesmo vínculo de veículo', async km => {

  await ensaio(async tx => {

    const [row] = await tx`insert into public.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,criado_por_id)

      values (-918502,-27004,null,12.34,56.78,${km},'2026-11-13',-27002)

      returning veiculo_id,quilometragem,criado_por_id`;

    expect(row).toEqual({veiculo_id:'-27004',quilometragem:km,criado_por_id:'-27002'});

    const [veiculo] = await tx`select is_svo,quilometragem_atual from public.veiculo where id=-27004`;

    expect(veiculo).toEqual({is_svo:true,quilometragem_atual:1000});

  });

});

test.each([

  ['0','10'],['-1','10'],['NaN','10'],['10','0'],['10','-1'],['10','NaN'],

])('rejeita litros/valor inválidos: %s/%s', async (litros,valor) => {

  await expect(sql.begin(async tx => {

    await tx`insert into public.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento)

      values (-918503,-27001,-27001,${litros},${valor},1000,'2026-11-13')`;

    throw new Error('Banco aceitou valor inválido');

  })).rejects.toMatchObject({code:'23514'});

});

test('rejeita km negativo sem alterar o odômetro do veículo', async () => {

  await expect(sql.begin(async tx => {

    await tx`insert into public.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento)

      values (-918504,-27001,-27001,10,50,-1,'2026-11-13')`;

    throw new Error('Banco aceitou km negativo');

  })).rejects.toMatchObject({code:'23514'});

});

test.each(['veiculo','motorista','autor'])('FK impede referência inexistente: %s', async recurso => {

  await expect(sql.begin(async tx => {

    await tx`insert into public.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,criado_por_id)

      values (-918505,${recurso==='veiculo' ? -918599 : -27001},${recurso==='motorista' ? -918599 : -27001},

        10,50,1000,'2026-11-13',${recurso==='autor' ? -918599 : -27002})`;

    throw new Error('Banco aceitou referência inexistente');

  })).rejects.toMatchObject({code:'23503'});

});

test('data civil inválida é rejeitada pelo PostgreSQL', async () => {

  await expect(sql.begin(async tx => {

    await tx`insert into public.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento)

      values (-918506,-27001,-27001,10,50,1000,'2026-02-30')`;

  })).rejects.toMatchObject({code:'22008'});

});

test('índices suportam veículo/período e período global; autoria antiga não é inventada', async () => {

  const indices=await sql`select indexdef from pg_indexes where schemaname='public' and tablename='abastecimento'`;

  expect(indices.map(i=>i.indexdef)).toContain('CREATE INDEX idx_abastecimento_veiculo_data ON public.abastecimento USING btree (veiculo_id, data_abastecimento DESC, id DESC)');

  expect(indices.map(i=>i.indexdef)).toContain('CREATE INDEX idx_abastecimento_data ON public.abastecimento USING btree (data_abastecimento DESC, id DESC)');

  const [legado]=await sql`select motorista_id,quilometragem,litragem,valor_total,criado_por_id from public.abastecimento where id=-27001`;

  expect(legado).toEqual({motorista_id:'-27001',quilometragem:1000,litragem:'10.50',valor_total:'63.00',criado_por_id:null});

});

const version='20261113000000_db_s9_01_abastecimentos_rf40.sql';

const forward=()=>readFileSync(resolve(root,'backend/src/database/supabase/migrations',version),'utf8');

const backward=()=>readFileSync(resolve(root,'backend/src/database/supabase/rollbacks',version),'utf8');

const validationVersion='20261114000000_db_s9_01_abastecimentos_rf40_validate.sql';

const validation=()=>readFileSync(resolve(root,'backend/src/database/supabase/migrations',validationVersion),'utf8');

const rollbackValidation=()=>readFileSync(resolve(root,'backend/src/database/supabase/rollbacks',validationVersion),'utf8');

const checkedConstraints=['abastecimento_criado_por_id_fkey','abastecimento_litragem_positiva',

  'abastecimento_valor_positivo','abastecimento_quilometragem_valida'];

async function estadosValidacao(tx:postgres.TransactionSql,relacao:string) {

  const rows=await tx`SELECT conname,convalidated FROM pg_constraint

    WHERE conrelid=to_regclass(${relacao}) AND conname=ANY(${checkedConstraints}::text[])`;

    return Object.fromEntries(rows.map(row=>[String(row.conname), row.convalidated]));

}

// Cópia estrutural da baseline real em um schema transacional do MESMO banco verificado.

// Não esvazia public nem altera histórico/hashes do harness para simular uma instalação nova.

async function baselineDoEnsaio(tx: postgres.TransactionSql, schema = 's9_abastecimento_fixture') {

  const baseline=readFileSync(resolve(root,'backend/src/database/supabase/migrations/20261030000000_baseline.sql'),'utf8');

  const tabela=baseline.match(/CREATE TABLE public\."abastecimento" \([\s\S]*?\n\);/)?.[0];

  if(!tabela) throw new Error('Tabela da baseline não encontrada');

  await tx.unsafe(`CREATE SCHEMA ${schema} AUTHORIZATION postgres`); await tx.unsafe('SET LOCAL ROLE postgres');

  await tx.unsafe(`SET LOCAL search_path=${schema},public,pg_catalog`);

  for(const nome of ['veiculo','motorista','usuario']) {

    await tx.unsafe(`CREATE TABLE ${schema}.${nome} (LIKE public.${nome} INCLUDING ALL)`);

    await tx.unsafe(`INSERT INTO ${schema}.${nome} SELECT * FROM public.${nome} WHERE id=-27001`);

  }

  await tx.unsafe(tabela.replaceAll('public.',`${schema}.`));

  for(const linha of baseline.split('\n').filter(l=>l.startsWith('ALTER TABLE public."abastecimento" ADD CONSTRAINT'))) {

    await tx.unsafe(linha.replaceAll('public.',`${schema}.`));

  }

  // Incremento pré-S9 já publicado: somente a coluna da entidade; os bytes não são duplicados.

  await tx.unsafe(`ALTER TABLE ${schema}.abastecimento ADD COLUMN tanque_completo boolean NOT NULL DEFAULT false`);

}

test.each([false,true])('forward/rollback no PostgreSQL, tabela legada com registro=%s', async legado => {

  await ensaio(async tx => {

    await baselineDoEnsaio(tx);

    if(legado) await tx`INSERT INTO s9_abastecimento_fixture.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,posto)

      VALUES (-918510,-27001,-27001,10.50,63,1000,'2026-01-15','Fixture legada S9')`;

    const antes=await tx`select to_jsonb(a) as dados from s9_abastecimento_fixture.abastecimento a`;

    await tx.unsafe(forward().replaceAll('public.','s9_abastecimento_fixture.'));

    const depois=await tx`select to_jsonb(a) as dados from s9_abastecimento_fixture.abastecimento a`;

    expect(depois).toEqual(antes.map(r=>({dados:{...r.dados,criado_por_id:null}})));

    const [coluna]=await tx`select is_nullable from information_schema.columns

      where table_schema='s9_abastecimento_fixture' and table_name='abastecimento' and column_name='quilometragem'`;

    expect(coluna.is_nullable).toBe('YES');

        expect(await estadosValidacao(tx,'s9_abastecimento_fixture.abastecimento'))

      .toEqual(Object.fromEntries(checkedConstraints.map(name=>[name,false])));

    await tx.unsafe(validation().replaceAll('public.','s9_abastecimento_fixture.'));

    expect(await estadosValidacao(tx,'s9_abastecimento_fixture.abastecimento'))

      .toEqual(Object.fromEntries(checkedConstraints.map(name=>[name,true])));

    await tx.unsafe(rollbackValidation().replaceAll('public.','s9_abastecimento_fixture.'));

    expect(await estadosValidacao(tx,'s9_abastecimento_fixture.abastecimento'))

      .toEqual(Object.fromEntries(checkedConstraints.map(name=>[name,false])));

    await tx.unsafe(backward().replaceAll('public.','s9_abastecimento_fixture.'));

    expect(await tx`select to_jsonb(a) as dados from s9_abastecimento_fixture.abastecimento a`).toEqual(antes);

    await tx.unsafe(forward().replaceAll('public.','s9_abastecimento_fixture.'));

    await tx`INSERT INTO s9_abastecimento_fixture.abastecimento

      (id,veiculo_id,litragem,valor_total,data_abastecimento,criado_por_id)

      VALUES (-918511,-27001,10,50,'2026-11-13',-27001)`;

  });

});

test('NOT VALID preserva legado inválido, bloqueia nova violação e mantém dados se VALIDATE falhar',async()=>{

  await ensaio(async tx=>{

    await baselineDoEnsaio(tx);

    await tx`INSERT INTO s9_abastecimento_fixture.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento)

      VALUES (-918520,-27001,-27001,-1,50,1000,'2026-01-15')`;

    await tx.unsafe(forward().replaceAll('public.','s9_abastecimento_fixture.'));

    expect(await estadosValidacao(tx,'s9_abastecimento_fixture.abastecimento'))

      .toEqual(Object.fromEntries(checkedConstraints.map(name=>[name,false])));

    const [legado]=await tx`SELECT litragem::text FROM s9_abastecimento_fixture.abastecimento WHERE id=-918520`;

    expect(legado.litragem).toBe('-1.00');

    await expect(tx.savepoint(sp=>sp`INSERT INTO s9_abastecimento_fixture.abastecimento

      (id,veiculo_id,litragem,valor_total,data_abastecimento)

      VALUES (-918521,-27001,-1,50,'2026-01-16')`)).rejects.toMatchObject({code:'23514'});

    await expect(tx.savepoint(sp=>sp.unsafe(validation().replaceAll('public.','s9_abastecimento_fixture.'))))

      .rejects.toMatchObject({code:'23514'});

    expect(await estadosValidacao(tx,'s9_abastecimento_fixture.abastecimento'))

      .toEqual(Object.fromEntries(checkedConstraints.map(name=>[name,false])));

    await tx.unsafe(rollbackValidation().replaceAll('public.','s9_abastecimento_fixture.'));

    await tx.unsafe(backward().replaceAll('public.','s9_abastecimento_fixture.'));

    const [preservado]=await tx`SELECT litragem::text FROM s9_abastecimento_fixture.abastecimento WHERE id=-918520`;

    expect(preservado.litragem).toBe('-1.00');

  });

});

test('VALIDATE CONSTRAINT permite INSERT concorrente durante a validação',async()=>{

  const schema='s9_abastecimento_concorrente';
  let criacaoIniciada=false;
  let escritor: Awaited<ReturnType<typeof verifiedSql>> | undefined;
  let validador: Awaited<ReturnType<typeof verifiedSql>> | undefined;
  let conexao: Awaited<ReturnType<typeof sql.reserve>> | undefined;
  let validacao:Promise<unknown>|undefined;
  let transacaoAberta=false;
  try {
  criacaoIniciada=true;
  await sql.begin(async tx=>{
    await baselineDoEnsaio(tx, schema);
    await tx.unsafe(forward().replaceAll('public.',schema+'.'));
  });
    escritor=await verifiedSql();
    validador=await verifiedSql();
    conexao=await escritor.reserve();
    await conexao`BEGIN`;

    transacaoAberta=true;

    await conexao`INSERT INTO s9_abastecimento_concorrente.abastecimento

      (id,veiculo_id,litragem,valor_total,data_abastecimento)

      VALUES (-918522,-27001,10,50,'2026-01-17')`;

    validacao=validador.begin(async tx=>{
      await tx`SET LOCAL lock_timeout='5s'`;
      await tx.unsafe(validation().replaceAll('public.',schema+'.'));
    });
    await validacao;
    await conexao`COMMIT`;
    transacaoAberta=false;
    const estados = await validador`
  SELECT conname, convalidated
  FROM pg_constraint
  WHERE conrelid = to_regclass(${schema + '.abastecimento'})
    AND conname = ANY(${checkedConstraints}::text[])
`;

expect(Object.fromEntries(
  estados.map(row => [String(row.conname), row.convalidated])
)).toEqual(
  Object.fromEntries(checkedConstraints.map(name => [name, true]))
);

expect(
  Object.fromEntries(
    estados.map(row => [row.conname, row.convalidated])
  )
).toEqual(
  Object.fromEntries(checkedConstraints.map(name => [name, true]))
);
  } finally {

    if(transacaoAberta && conexao) await conexao`ROLLBACK`;
    await validacao?.catch(()=>undefined);
    conexao?.release();
    await escritor?.end();
    await validador?.end();
    if(criacaoIniciada) await sql.unsafe('DROP SCHEMA IF EXISTS '+schema+' CASCADE');
  }

});

test.each(['ausencia','autoria'])('rollback recusa perda/incompatibilidade de registros: %s', async caso => {

  await expect(sql.begin(async tx=>{

    await tx`insert into public.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,criado_por_id)

      values (-918512,-27001,${caso==='ausencia'?null:-27001},10,50,${caso==='ausencia'?null:1000},

        '2026-11-13',${caso==='autoria'?-27001:null})`;

    await tx.unsafe(backward());

  })).rejects.toThrow('Rollback SCRUM-185 recusado');

});

test('forward mantém legado inválido e VALIDATE recusa sem alterar o registro', async () => {
  await ensaio(async tx => {
    await baselineDoEnsaio(tx);
    await tx`INSERT INTO s9_abastecimento_fixture.abastecimento
      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento)
      VALUES (-918513,-27001,-27001,-1,50,1000,'2026-01-15')`;
    await tx.unsafe(forward().replaceAll('public.','s9_abastecimento_fixture.'));
    await expect(tx.savepoint(sp => sp.unsafe(
      validation().replaceAll('public.','s9_abastecimento_fixture.')
    ))).rejects.toMatchObject({code:'23514'});
    const [registro] = await tx`SELECT litragem::text FROM s9_abastecimento_fixture.abastecimento WHERE id=-918513`;
    expect(registro.litragem).toBe('-1.00');
  });
});

test('rollback revalida autoria após aguardar gravação concorrente e não a descarta',async()=>{

  // Schema próprio criado pela mesma fixture oficial; public e histórico do harness não são revertidos.

  await sql.begin(async tx=>{

    await baselineDoEnsaio(tx, 's9_abastecimento_rollback');

    await tx.unsafe(forward().replaceAll('public.','s9_abastecimento_rollback.'));

  });

  const escritor=await verifiedSql();

  const reversor=await verifiedSql();

  const conexao=await escritor.reserve();

  let reversao:Promise<unknown>|undefined;

  try {

    await conexao`BEGIN`;

    await conexao`INSERT INTO s9_abastecimento_rollback.abastecimento

      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,criado_por_id)

      VALUES (-918514,-27001,-27001,10,50,1000,'2026-11-13',-27001)`;

    reversao=reversor.begin(async tx=>{

      await tx`SET LOCAL lock_timeout='5s'`;

      await tx.unsafe(backward().replaceAll('public.','s9_abastecimento_rollback.'));

      // Mesmo a versão defeituosa é totalmente revertida neste ensaio.

      throw new Error('Rollback aceitou descartar autoria concorrente');

    }).catch((error:unknown)=>error);

    await expect.poll(async()=>{

      const [row]=await sql`SELECT EXISTS(SELECT 1 FROM pg_locks

        WHERE relation='s9_abastecimento_rollback.abastecimento'::regclass

          AND mode='AccessExclusiveLock' AND NOT granted) AS aguardando`;

      return row.aguardando;

    },{timeout:2000}).toBe(true);

    await conexao`COMMIT`;

    expect(await reversao).toMatchObject({message:expect.stringContaining('Rollback SCRUM-185 recusado')});

    const [registro]=await sql`SELECT criado_por_id FROM s9_abastecimento_rollback.abastecimento WHERE id=-918514`;

    expect(registro).toEqual({criado_por_id:'-27001'});

  } finally {

    await conexao`ROLLBACK`.catch(() => undefined);

    await reversao?.catch(() => undefined);

    conexao.release();

    await escritor.end();

    await reversor.end();

    await sql.unsafe('DROP SCHEMA IF EXISTS s9_abastecimento_rollback CASCADE');

  }

});
