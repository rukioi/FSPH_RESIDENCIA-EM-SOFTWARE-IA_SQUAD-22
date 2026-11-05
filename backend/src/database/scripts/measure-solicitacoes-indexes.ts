import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,verifiedSql} from './verify-test-db.js';

/** Mede candidatos em tabelas temporárias; não altera tabelas, índices ou dados da aplicação. */
export async function medirIndicesSolicitacoes(){
  const sql=await verifiedSql();
  try{return await sql.begin(async tx=>{
    await tx`CREATE TEMP TABLE s7_perf_solicitacoes (LIKE public.solicitacao_viagem INCLUDING ALL EXCLUDING INDEXES) ON COMMIT DROP`;
    await tx`ALTER TABLE s7_perf_solicitacoes ADD PRIMARY KEY(id), ADD UNIQUE(codigo)`;
    await tx`INSERT INTO s7_perf_solicitacoes (id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,data_hora_retorno_previsto,status,motorista_id,veiculo_id)
      SELECT n,'PERF-'||n,n%200,'Origem sintética','Destino sintético','Medição isolada',
        timestamp '2097-01-01'+(n%365)*interval '1 day'+(n%24)*interval '1 hour',
        timestamp '2097-01-01'+(n%365)*interval '1 day'+(n%24)*interval '1 hour'+interval '8 hours',
        (CASE WHEN n%20<9 THEN 'PENDENTE' WHEN n%20=9 THEN 'APROVADA' WHEN n%20<14 THEN 'AGENDADA'
          WHEN n%20=14 THEN 'REPROVADA' ELSE 'CONCLUIDA' END)::public.status_solicitacao,n%317,n%439
      FROM generate_series(1,50000) n`;
    await tx`ANALYZE s7_perf_solicitacoes`;
    await tx`CREATE TEMP TABLE s7_perf_logs (LIKE public.log_atividade INCLUDING ALL EXCLUDING INDEXES) ON COMMIT DROP`;
    await tx`ALTER TABLE s7_perf_logs ADD PRIMARY KEY(id)`;
    await tx`CREATE INDEX s7_perf_logs_solicitacao_viagem_id_idx ON s7_perf_logs(solicitacao_viagem_id)`;
    await tx`INSERT INTO s7_perf_logs(id,solicitacao_viagem_id,descricao,data_hora)
      SELECT n,n/3+1,'Evento sintético',timestamp '2097-01-01'+(n%1000)*interval '1 second' FROM generate_series(1,150000) n`;
    await tx`ANALYZE s7_perf_logs`;
    const consultas={
      fila:"SELECT id FROM s7_perf_solicitacoes WHERE status='PENDENTE' ORDER BY criado_em ASC NULLS LAST,id ASC LIMIT 5",
      historico:'SELECT id FROM s7_perf_logs WHERE solicitacao_viagem_id=17 ORDER BY data_hora ASC NULLS LAST,id ASC LIMIT 20',
      autor:'SELECT id FROM s7_perf_solicitacoes WHERE solicitante_id=17 ORDER BY id DESC LIMIT 20',
      status:'SELECT id FROM s7_perf_solicitacoes WHERE status=\'PENDENTE\' ORDER BY id DESC LIMIT 20',
      periodo:"SELECT status,count(*) FROM s7_perf_solicitacoes WHERE data_hora_saida>='2097-06-01' AND data_hora_saida<'2097-06-08' GROUP BY status",
      agenda:"SELECT id FROM s7_perf_solicitacoes WHERE status='AGENDADA' AND data_hora_saida<'2097-06-02' AND data_hora_retorno_previsto>'2097-06-01' ORDER BY data_hora_saida,id LIMIT 20",
      motorista:"SELECT id FROM s7_perf_solicitacoes WHERE status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO') AND motorista_id=17 AND (data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto<=data_hora_saida OR (data_hora_saida<'2097-06-02' AND data_hora_retorno_previsto>'2097-06-01')) LIMIT 1",
      veiculo:"SELECT id FROM s7_perf_solicitacoes WHERE status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO') AND veiculo_id=17 AND (data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto<=data_hora_saida OR (data_hora_saida<'2097-06-02' AND data_hora_retorno_previsto>'2097-06-01')) LIMIT 1",
      conflito:"SELECT id FROM s7_perf_solicitacoes WHERE status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO') AND (motorista_id=17 OR veiculo_id=17) AND (data_hora_retorno_previsto IS NULL OR data_hora_retorno_previsto<=data_hora_saida OR (data_hora_saida<'2097-06-02' AND data_hora_retorno_previsto>'2097-06-01')) LIMIT 1",
    };
    const medir=async()=>{
      const saida:Record<string,unknown>={};
      for(const [nome,query] of Object.entries(consultas)){
        const planos=[];
        for(let n=0;n<3;n++){
          const [row]=await tx.unsafe('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+query);
          planos.push(row['QUERY PLAN'][0]);
        }
        planos.sort((a,b)=>a['Execution Time']-b['Execution Time']);
        saida[nome]=planos[1];
      }
      return saida;
    };
    const antes=await medir();
    // Baseline acima recria apenas PK/UNIQUE e índice de vínculo, mesmo após o novo incremento ter sido aplicado.
    const incremento=readFileSync(resolve(root,'backend/src/database/supabase/migrations/20261105000000_add_solicitacoes_query_indexes.sql'),'utf8');
    await tx.unsafe(incremento.replaceAll('public.solicitacao_viagem','s7_perf_solicitacoes'));
    // Dois candidatos adicionais, deliberadamente não entregues: comparar ganho real.
    await tx`CREATE INDEX s7_perf_status ON s7_perf_solicitacoes(status,id DESC)`;
    await tx`CREATE INDEX s7_perf_historico ON s7_perf_logs(solicitacao_viagem_id,data_hora,id)`;
    const depois=await medir();
    const [version]=await tx`SELECT version() AS version`;
    return {version:version.version,linhas:50000,repeticoes:3,criterio:'mediana de 3 execuções; buffers locais podem exceder local_buffers; baseline de índices explícita; sem enable_seqscan=off',consultas,antes,depois};
  });}finally{await sql.end();}
}

const resultado=await medirIndicesSolicitacoes();
const dir=resolve(root,'.test-db/s7-indicadores');mkdirSync(dir,{recursive:true});
writeFileSync(resolve(dir,'index-performance.json'),JSON.stringify(resultado,null,2)+'\n');
for(const nome of Object.keys(resultado.consultas)){
  const antes=resultado.antes[nome] as Record<string,unknown>;
  const depois=resultado.depois[nome] as Record<string,unknown>;
  const plano=(p:Record<string,unknown>):unknown=>({tipo:p['Node Type'],indice:p['Index Name'],blocos:Number(p['Local Hit Blocks']??0)+Number(p['Local Read Blocks']??0),filtradas:p['Rows Removed by Filter'],filhos:(p.Plans as Record<string,unknown>[]|undefined)?.map(plano)});
  console.log(JSON.stringify({consulta:nome,antesMs:antes['Execution Time'],depoisMs:depois['Execution Time'],antes:plano(antes.Plan as Record<string,unknown>),depois:plano(depois.Plan as Record<string,unknown>)}));
}
