import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {afterAll,beforeAll,expect,test} from 'vitest';
import {root,verifiedSql} from '../../src/database/scripts/verify-test-db.js';
let sql:Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async()=>{sql=await verifiedSql();});
afterAll(async()=>{await sql?.end();});
test('preflight de rollout executa somente leitura e evidencia schema efetivo',async()=>{
  const consultas=readFileSync(resolve(root,'backend/src/database/scripts/inspect-sprint7.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean);
  const resultados=await sql.begin('isolation level repeatable read read only',async tx=>{
    const rows=[];for(const consulta of consultas)rows.push(await tx.unsafe(consulta));return rows;
  });
  const [colunas,estados,constraints,indices,historico]=resultados;
  expect(colunas.find(c=>c.column_name==='finalidade')).toMatchObject({data_type:'text',is_nullable:'YES'});
  expect(colunas.find(c=>c.column_name==='data_hora_retorno_previsto')).toMatchObject({data_type:'timestamp without time zone',is_nullable:'YES'});
  expect(colunas.find(c=>c.column_name==='solicitacao_viagem_id')).toMatchObject({data_type:'bigint',is_nullable:'YES'});
  expect(estados.map(e=>e.enumlabel)).toEqual(['PENDENTE','APROVADA','AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO','CONCLUIDA','REPROVADA']);
  expect(constraints.find(c=>c.conname==='solicitacao_viagem_retorno_previsto_check')).toMatchObject({contype:'c',convalidated:true});
  expect(constraints.some(c=>c.tabela==='log_atividade'&&c.contype==='f'&&String(c.definicao).includes('solicitacao_viagem_id')&&c.convalidated)).toBe(true);
  expect(indices.find(i=>i.nome==='idx_log_atividade_solicitacao_viagem_id')).toMatchObject({indisvalid:true,indisready:true});
  expect(indices.filter(i=>String(i.nome).startsWith('solicitacao_viagem_')&&String(i.nome).endsWith('_idx'))).toHaveLength(5);
  expect(historico[0].historico_isolado).toBe('fsph_test_harness.migrations');
});
