import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { canonical, metadataQuery, generate, type Metadata } from '../../src/database/scripts/generate-db-docs.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { sql = await verifiedSql(); });
afterAll(async () => { await sql?.end(); });

test('reconstrói o snapshot completo auditado, incluindo ACL/RLS e tipos exatos', async () => {
  const expected = JSON.parse(readFileSync(resolve(root, 'docs/database/schema-metadata.json'), 'utf8')) as Metadata;
  const [row] = await sql.unsafe(metadataQuery);
  const metadata = canonical(row.metadata as Metadata);
  expect(metadata).toEqual(expected);
  expect(metadata.tables).toHaveLength(expected.tables.length);
  expect(metadata.columns).toHaveLength(expected.columns.length);
  expect(metadata.enums).toHaveLength(8);
  expect(metadata.indexes).toHaveLength(expected.indexes.length);
  expect(metadata.constraints).toHaveLength(expected.constraints.length);
  expect(metadata.triggers).toEqual([]);
  expect(metadata.policies).toEqual([]);
  expect(metadata.tables.filter(t=>t.name!=='notificacao').every(t => !t.rls && !t.forceRls)).toBe(true);
  expect(metadata.tables.find(t=>t.name==='notificacao')).toMatchObject({rls:true,forceRls:false});
  expect(metadata.constraints.find(c => c.name === 'veiculo_vinculo_check')?.validated).toBe(true);
  expect(metadata.constraints.filter(c => c.table === 'log_atividade' && c.type === 'f').map(c => c.onDelete).sort())
    .toEqual(expected.constraints.filter(c => c.table === 'log_atividade' && c.type === 'f').map(c => c.onDelete).sort());
  expect(metadata.columns.find(c => c.name === 'litragem')?.type).toBe('numeric(10,2)');
});

test('as quatro migrations incrementais estão presentes no catálogo, com tipos, CHECK, FK e índice corretos', async () => {
  const [row] = await sql.unsafe(metadataQuery);
  const metadata = canonical(row.metadata as Metadata);
  for (const [table,name,type] of [
    ['solicitacao_viagem','finalidade','text'],
    ['solicitacao_viagem','data_hora_retorno_previsto','timestamp without time zone'],
    ['log_atividade','solicitacao_viagem_id','bigint'],
  ]) {
    expect(metadata.columns.find(c => c.table === table && c.name === name)).toMatchObject({type,nullable:true,default:null});
  }
  expect(metadata.enums.find(e => e.name === 'status_solicitacao')?.values).toEqual([
    'PENDENTE','APROVADA','AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO','CONCLUIDA','REPROVADA',
  ]);
  const check = metadata.constraints.find(c => c.table === 'solicitacao_viagem' && c.name === 'solicitacao_viagem_retorno_previsto_check');
  expect(check).toMatchObject({type:'c',validated:true});
  expect(check?.definition.replace(/[()]/g,'').replace(/\s+/g,' ')).toBe('CHECK data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto > data_hora_saida');
  const logFks = metadata.constraints.filter(c => c.table === 'log_atividade' && c.type === 'f');
  expect(logFks.find(c => c.name === 'fk_log_atividade_usuario')).toMatchObject({columns:['usuario_id'],references:'usuario',onDelete:'n',validated:true});
  expect(logFks.find(c => c.name === 'log_atividade_usuario_id_fkey')).toMatchObject({columns:['usuario_id'],references:'usuario',onDelete:'a',validated:true});
  expect(logFks.filter(c => c.columns.includes('solicitacao_viagem_id'))).toHaveLength(1);
  expect(logFks.find(c => c.columns.includes('solicitacao_viagem_id'))).toMatchObject({
    references:'solicitacao_viagem',referencedColumns:['id'],onDelete:'a',onUpdate:'a',validated:true,
  });
  expect(metadata.indexes.find(i => i.table === 'log_atividade' && i.name === 'idx_log_atividade_solicitacao_viagem_id')?.definition)
    .toBe('CREATE INDEX idx_log_atividade_solicitacao_viagem_id ON public.log_atividade USING btree (solicitacao_viagem_id)');
});

test('a geração detecta drift de privilégio e volta a passar após restauração', async () => {
  await generate(true);
  try {
    await sql`revoke select on public.usuario from anon`;
    await expect(generate(true)).rejects.toThrow('Drift estrutural');
  } finally {
    await sql`grant select on public.usuario to anon`;
  }
  await generate(true);
});

test('grants locais reproduzem exposição auditada sem consultar dados reais', async () => {
  const [access] = await sql`select has_table_privilege('anon', 'public.usuario', 'SELECT') as read,
    has_table_privilege('authenticated', 'public.usuario', 'UPDATE') as write`;
  expect(access).toEqual({ read: true, write: true });
});
