import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {afterAll,beforeAll,expect,test} from 'vitest';
import {root,verifiedSql} from '../../src/database/scripts/verify-test-db.js';

let sql:Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async()=>{sql=await verifiedSql();});
afterAll(async()=>{await sql?.end();});
const directory=resolve(root,'backend/src/database/supabase/migrations');
const incremento=readFileSync(resolve(directory,'20261105000000_add_solicitacoes_query_indexes.sql'),'utf8');
const names=['solicitacao_viagem_autor_id_idx','solicitacao_viagem_saida_status_idx','solicitacao_viagem_motorista_reserva_idx','solicitacao_viagem_veiculo_reserva_idx','solicitacao_viagem_fila_pendente_idx'];

test('as quatro migrations institucionais históricas preservam seus hashes normalizados',()=>{
  const hashes={
    '20261104000000_add_finalidade_solicitacao_viagem.sql':'c522963492a7507d27d40517d2122f1c60fa2d7be30fc761ebe9317f4559bc8c',
    '20261104000001_add_status_aprovada.sql':'ac61d1d1d1048cfcbd730baecc7b36a2e0e66c783e32ebd3cc6d21d2e2784971',
    '20261104000002_add_retorno_previsto.sql':'a02ee5461e12acccf33207143e694b3e32e86904296e5988206568d72d6b0974',
    '20261104000003_add_solicitacao_viagem_id_log_atividade.sql':'eb948c721d2bee2c3bf4e094b6a83d02ad6c73851a975c7989d2e497bbbba6d5',
  };
  for(const [name,hash] of Object.entries(hashes))expect(createHash('sha256').update(readFileSync(resolve(directory,name),'utf8').replaceAll('\r\n','\n')).digest('hex'),name).toBe(hash);
});

test('índices medidos estão válidos e prontos, sem candidatos redundantes de status/histórico',async()=>{
  const indexes=await sql`SELECT c.relname AS name,i.indisvalid AS valid,i.indisready AS ready,pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid='public.solicitacao_viagem'::regclass`;
  for(const name of names)expect(indexes.find(i=>i.name===name),name).toMatchObject({valid:true,ready:true});
  expect(indexes.find(i=>i.name==='solicitacao_viagem_autor_id_idx')?.definition).toContain('(solicitante_id, id DESC)');
  expect(indexes.find(i=>i.name==='solicitacao_viagem_saida_status_idx')?.definition).toContain('(data_hora_saida, status, id)');
  for(const name of names.filter(n=>n.includes('_reserva_'))){
    const definition=indexes.find(i=>i.name===name)?.definition;
    expect(definition).toContain('INCLUDE (data_hora_retorno_previsto)');expect(definition).toContain('EM_ANDAMENTO');
  }
  const [history]=await sql`SELECT sha256 FROM fsph_test_harness.migrations WHERE name='20261105000000_add_solicitacoes_query_indexes.sql'`;
  expect(history.sha256).toBe(createHash('sha256').update(incremento.replaceAll('\r\n','\n')).digest('hex'));
});

test('o incremento aditivo preserva linhas e seu rollback transacional não deixa objetos temporários',async()=>{
  const rollback=new Error('rollback_fixture_s7_indices');
  await expect(sql.begin(async tx=>{
    await tx`CREATE TEMP TABLE s7_index_rollback (LIKE public.solicitacao_viagem INCLUDING ALL EXCLUDING INDEXES) ON COMMIT DROP`;
    await tx`INSERT INTO s7_index_rollback(id,codigo,origem,destino,data_hora_saida,finalidade)
      VALUES (1,'S7-IDX-ROLLBACK','Origem legada','Destino legado','2099-01-01 08:00',NULL)`;
    const before=await tx`SELECT row_to_json(s) AS row FROM s7_index_rollback s`;
    await tx.unsafe(incremento.replaceAll('public.solicitacao_viagem','s7_index_rollback'));
    expect(await tx`SELECT row_to_json(s) AS row FROM s7_index_rollback s`).toEqual(before);
    const [count]=await tx`SELECT count(*)::int AS total FROM pg_index WHERE indrelid='pg_temp.s7_index_rollback'::regclass`;
    expect(count.total).toBe(5);
    throw rollback;
  })).rejects.toBe(rollback);
  const [row]=await sql`SELECT to_regclass('pg_temp.s7_index_rollback') AS name`;expect(row.name).toBeNull();
});
