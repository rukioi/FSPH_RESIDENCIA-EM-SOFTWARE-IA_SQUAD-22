import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterAll,beforeAll,expect,test} from 'vitest';
import type postgres from 'postgres';
import {root,verifiedSql} from '../../src/database/scripts/verify-test-db.js';

const migration=readFileSync(resolve(root,'backend/src/database/supabase/migrations/20261104000002_add_retorno_previsto.sql'),'utf8');
const inspection=readFileSync(resolve(root,'backend/src/database/scripts/inspect-retorno-previsto.sql'),'utf8');
let sql:Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async()=>{sql=await verifiedSql(true);});
afterAll(async()=>{await sql?.end();});

// Cada cenário cria uma tabela efêmera, sem tocar na tabela pública ou no histórico.
// Só a qualificação do schema muda no SQL real; o arquivo da migration fica intacto.
async function fixture(name:string,run:(tx:postgres.TransactionSql,table:string,inspect:()=>Promise<Record<string,unknown>>) => Promise<void>) {
  const schema='s7_retorno_'+name;
  await expect(sql.begin(async tx=>{
    await tx.unsafe('CREATE SCHEMA '+schema);
    const table=schema+'.solicitacao_viagem';
    await tx.unsafe('CREATE TABLE '+table+' (data_hora_saida timestamp without time zone NOT NULL)');
    const inspect=async()=>{
      const [row]=await tx.unsafe(inspection.replace("n.nspname = 'public'", "n.nspname = '"+schema+"'"));
      return row as Record<string,unknown>;
    };
    await run(tx,table,inspect);
    throw new Error('rollback_fixture_retornoprevisto');
  })).rejects.toThrow('rollback_fixture_retornoprevisto');
}

test('hash normalizado da migration histórica permanece imutável',()=>{
  expect(createHash('sha256').update(migration.replaceAll('\r\n','\n')).digest('hex'))
    .toBe('a02ee5461e12acccf33207143e694b3e32e86904296e5988206568d72d6b0974');
});

test('A: tabela nova executa a migration e preserva registros antigos com retorno null',async()=>{
  await fixture('novo',async(tx,table,inspect)=>{
    await tx.unsafe("INSERT INTO "+table+" VALUES ('2099-01-01 08:00:00')");
    expect((await inspect()).estado).toBe('AUSENTE');
    await tx.unsafe(migration.replaceAll('public.solicitacao_viagem',table));
    expect(await inspect()).toMatchObject({estado:'EQUIVALENTE',coluna_compativel:true,constraint_validada:true});
    const [old]=await tx.unsafe('SELECT data_hora_retorno_previsto AS retorno FROM '+table);
    expect(old.retorno).toBeNull();
    await expect(tx.savepoint(inner=>inner.unsafe('INSERT INTO '+table+
      " VALUES ('2099-01-01 08:00:00','2099-01-01 08:00:00')"))).rejects.toMatchObject({code:'23514'});
  });
});

test('B: constraint equivalente exige reconciliação, replay continua falhando sem mascarar duplicidade',async()=>{
  await fixture('equivalente',async(tx,table,inspect)=>{
    const ddl=migration.replaceAll('public.solicitacao_viagem',table);
    await tx.unsafe(ddl);
    const before=await inspect();expect(before.estado).toBe('EQUIVALENTE');
    await expect(tx.savepoint(inner=>inner.unsafe(ddl))).rejects.toMatchObject({code:'42710'});
    expect(await inspect()).toEqual(before);
  });
});

test('C: mesmo nome com regra divergente bloqueia reconciliação e preserva a definição',async()=>{
  await fixture('divergente',async(tx,table,inspect)=>{
    await tx.unsafe('ALTER TABLE '+table+' ADD COLUMN data_hora_retorno_previsto timestamp without time zone');
    await tx.unsafe('ALTER TABLE '+table+' ADD CONSTRAINT solicitacao_viagem_retorno_previsto_check '+
      'CHECK (data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto >= data_hora_saida)');
    expect(await inspect()).toMatchObject({estado:'DIVERGENTE',constraint_equivalente:false});
    const [constraint]=await tx.unsafe("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='"+table+"'::regclass AND conname='solicitacao_viagem_retorno_previsto_check'");
    expect(constraint.definition).toContain('>=');
  });
});

test('constraint não validada e coluna parcial não autorizam marcar a migration como aplicada',async()=>{
  await fixture('parcial',async(tx,table,inspect)=>{
    await tx.unsafe('ALTER TABLE '+table+' ADD COLUMN data_hora_retorno_previsto timestamp without time zone');
    expect((await inspect()).estado).toBe('PARCIAL');
    await tx.unsafe('ALTER TABLE '+table+' ADD CONSTRAINT solicitacao_viagem_retorno_previsto_check '+
      'CHECK (data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto > data_hora_saida) NOT VALID');
    expect(await inspect()).toMatchObject({estado:'DIVERGENTE',constraint_validada:false});
  });
});

test('coluna com tipo divergente não é aceita apesar de ADD COLUMN IF NOT EXISTS',async()=>{
  await fixture('tipo',async(tx,table,inspect)=>{
    await tx.unsafe('ALTER TABLE '+table+' ADD COLUMN data_hora_retorno_previsto timestamp with time zone');
    expect(await inspect()).toMatchObject({estado:'DIVERGENTE',coluna_compativel:false});
  });
});
