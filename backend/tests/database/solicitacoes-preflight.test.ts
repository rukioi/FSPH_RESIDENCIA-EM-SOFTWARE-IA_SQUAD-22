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
  for(const [nome,tamanho] of [['codigo',20],['origem',255],['destino',255]] as const){
    expect(colunas.find(c=>c.table_name==='solicitacao_viagem'&&c.column_name===nome)).toMatchObject({data_type:'character varying',character_maximum_length:tamanho,compatibilidade:'EQUIVALENTE'});
  }
  expect(colunas.find(c=>c.table_name==='log_atividade'&&c.column_name==='descricao')).toMatchObject({data_type:'text',is_nullable:'NO',domain_name:null,domain_schema:null,compatibilidade:'EQUIVALENTE'});
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

test('preflight identifica limite divergente e descricao ausente ou incompatível',async()=>{
  const primeira=readFileSync(resolve(root,'backend/src/database/scripts/inspect-sprint7.sql'),'utf8').split(';')[0];
  const consulta=primeira.replace("table_schema='public'","table_schema=pg_my_temp_schema()::regnamespace::text");
  await sql.begin(async tx=>{
    await tx`CREATE TEMP TABLE solicitacao_viagem (codigo varchar(5) NOT NULL, origem varchar(255) NOT NULL, destino varchar(255) NOT NULL) ON COMMIT DROP`;
    await tx`CREATE TEMP TABLE log_atividade (id bigint) ON COMMIT DROP`;
    const semDescricao=await tx.unsafe(consulta);
    expect(semDescricao.find(c=>c.column_name==='descricao')).toMatchObject({data_type:null,compatibilidade:'AUSENTE'});
    await tx`ALTER TABLE log_atividade ADD COLUMN descricao integer NOT NULL`;
    const linhas=await tx.unsafe(consulta);
    expect(linhas.find(c=>c.column_name==='codigo')).toMatchObject({character_maximum_length:5,limite_esperado:20,is_nullable:'NO',compatibilidade:'DIVERGENTE'});
    expect(linhas.find(c=>c.column_name==='origem')).toMatchObject({character_maximum_length:255,compatibilidade:'EQUIVALENTE'});
    expect(linhas.find(c=>c.column_name==='descricao')).toMatchObject({data_type:'integer',compatibilidade:'DIVERGENTE'});
  });
});

test('domínio text restritivo é divergente mesmo com tipo subjacente equivalente',async()=>{
  const primeira=readFileSync(resolve(root,'backend/src/database/scripts/inspect-sprint7.sql'),'utf8').split(';')[0];
  const consulta=primeira.replace("table_schema='public'","table_schema=pg_my_temp_schema()::regnamespace::text");
  const rollback=new Error('rollback_fixture_dominio_preflight');
  await expect(sql.begin(async tx=>{
    await tx`CREATE TEMP TABLE s7_domain_anchor (id integer) ON COMMIT DROP`;
    await tx`CREATE DOMAIN pg_temp.s7_texto_curto AS text CHECK (length(VALUE) <= 10)`;
    await tx`CREATE TEMP TABLE log_atividade (descricao pg_temp.s7_texto_curto NOT NULL) ON COMMIT DROP`;
    const linhas=await tx.unsafe(consulta);
    expect(linhas.find(c=>c.table_name==='log_atividade'&&c.column_name==='descricao')).toMatchObject({
      data_type:'text',character_maximum_length:null,is_nullable:'NO',domain_name:'s7_texto_curto',compatibilidade:'DIVERGENTE',
    });
    expect(linhas.find(c=>c.column_name==='descricao')?.domain_schema).toMatch(/^pg_temp_/);
    throw rollback;
  })).rejects.toBe(rollback);
});
