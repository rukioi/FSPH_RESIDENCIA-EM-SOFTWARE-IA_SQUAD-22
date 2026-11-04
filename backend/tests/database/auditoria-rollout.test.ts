import {expect,test} from 'vitest';
import {randomUUID} from 'node:crypto';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';

test('rollout de auditoria em etapas valida FK e cria índice concorrente fora de transação',async()=>{
  const sql=await verifiedSql(true);
  const schema='s7_rollout_'+randomUUID().replaceAll('-','');
  const logs=schema+'.log_atividade',pedidos=schema+'.solicitacao_viagem';
  try{
    await sql.unsafe('CREATE SCHEMA '+schema);
    await sql.unsafe('CREATE TABLE '+pedidos+' (id bigint PRIMARY KEY)');
    await sql.unsafe('CREATE TABLE '+logs+' (id bigint PRIMARY KEY,descricao text NOT NULL)');
    await sql.unsafe("INSERT INTO "+logs+" SELECT n,'Fixture legada' FROM generate_series(1,10) n");
    await sql.begin(async tx=>{await tx.unsafe('ALTER TABLE '+logs+' ADD COLUMN solicitacao_viagem_id bigint');});
    await sql.begin(async tx=>{await tx.unsafe('ALTER TABLE '+logs+' ADD CONSTRAINT log_atividade_solicitacao_viagem_id_fkey FOREIGN KEY (solicitacao_viagem_id) REFERENCES '+pedidos+'(id) NOT VALID');});
    const [before]=await sql`SELECT convalidated FROM pg_constraint WHERE conrelid=${logs}::regclass AND contype='f'`;
    expect(before.convalidated).toBe(false);
    await sql.begin(async tx=>{await tx.unsafe('ALTER TABLE '+logs+' VALIDATE CONSTRAINT log_atividade_solicitacao_viagem_id_fkey');});
    await sql.unsafe('CREATE INDEX CONCURRENTLY idx_log_atividade_solicitacao_viagem_id ON '+logs+' (solicitacao_viagem_id)');
    const [after]=await sql`SELECT convalidated FROM pg_constraint WHERE conrelid=${logs}::regclass AND contype='f'`;
    expect(after.convalidated).toBe(true);
    const [index]=await sql`SELECT indisvalid,indisready FROM pg_index WHERE indrelid=${logs}::regclass AND indexrelid=${schema+'.idx_log_atividade_solicitacao_viagem_id'}::regclass`;
    expect(index).toEqual({indisvalid:true,indisready:true});
    const [rows]=await sql.unsafe('SELECT count(*)::int AS total,count(solicitacao_viagem_id)::int AS vinculados FROM '+logs);
    expect(rows).toEqual({total:10,vinculados:0});
  }finally{await sql.end();}
});
