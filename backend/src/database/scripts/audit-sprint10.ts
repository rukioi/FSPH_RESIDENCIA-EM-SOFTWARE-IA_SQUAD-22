import assert from 'node:assert/strict';
import type { TransactionSql } from 'postgres';
import { verifiedSql } from './verify-test-db.js';

interface Plan {
  'Node Type': string;
  'Index Name'?: string;
  'Local Hit Blocks': number;
  'Local Read Blocks': number;
  'Actual Rows': number;
  Plans?: Plan[];
}

function planIndexes(plan: Plan): string[] {
  return [...(plan['Index Name'] ? [plan['Index Name']] : []), ...(plan.Plans ?? []).flatMap(planIndexes)];
}

async function catalog(tx: TransactionSql) {
  const roles = await tx`
    SELECT rolname AS papel, rolsuper AS superusuario, rolbypassrls AS ignora_rls, rolinherit AS herda
    FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'postgres', 'service_role') ORDER BY rolname
  `;
  assert.equal(roles.length, 4);
  console.log('SCRUM-205 papeis SQL', JSON.stringify(roles));

  const tables = await tx`
    SELECT c.relname AS tabela, c.relowner::regrole::text AS dono, c.relrowsecurity AS rls,
      c.relforcerowsecurity AS force_rls, r.rolname AS papel,
      has_schema_privilege(r.oid, n.oid, 'USAGE') AS uso_schema,
      has_table_privilege(r.oid, c.oid, 'SELECT') AS leitura,
      has_any_column_privilege(r.oid, c.oid, 'SELECT') AS leitura_coluna,
      has_table_privilege(r.oid, c.oid, 'INSERT') AS inclusao,
      has_any_column_privilege(r.oid, c.oid, 'INSERT') AS inclusao_coluna,
      has_table_privilege(r.oid, c.oid, 'UPDATE') AS alteracao,
      has_any_column_privilege(r.oid, c.oid, 'UPDATE') AS alteracao_coluna,
      has_table_privilege(r.oid, c.oid, 'DELETE') AS exclusao,
      has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS truncamento,
      (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas
    FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid CROSS JOIN pg_roles r
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND r.rolname IN ('anon', 'authenticated', 'postgres', 'service_role')
    ORDER BY c.relname, r.rolname
  `;
  const privateTables = [
    'abastecimento_comprovante', 'anexo', 'anotacao', 'documento_historico',
    'notificacao', 'viagem_correcao', 'viagem_evidencia',
  ];
  for (const tabela of privateTables) {
    for (const papel of ['anon', 'authenticated']) {
      const row = tables.find(table => table.tabela === tabela && table.papel === papel);
      assert.ok(row?.rls, `RLS ausente em ${tabela}`);
      assert.ok(!row.leitura_coluna && !row.inclusao_coluna && !row.alteracao_coluna && !row.exclusao && !row.truncamento,
        `Permissão direta inesperada para ${papel} em ${tabela}`);
    }
  }
  for (const row of tables) console.log('SCRUM-205 ACL', JSON.stringify(row));
  const defaults = await tx`
    SELECT d.defaclrole::regrole::text AS dono, coalesce(n.nspname, 'global') AS esquema,
      d.defaclobjtype AS objeto, d.defaclacl::text AS acl
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    WHERE (n.nspname='public' OR d.defaclnamespace=0)
      AND d.defaclrole::regrole::text IN ('postgres','supabase_admin','service_role')
    ORDER BY dono, esquema, objeto
  `;
  for (const row of defaults) console.log('SCRUM-205 ACL padrao', JSON.stringify(row));
  const [resumo] = await tx`
    SELECT count(*)::int AS tabelas, count(*) FILTER (WHERE c.relrowsecurity)::int AS com_rls
    FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
  `;
  console.log('SCRUM-205 catalogo', JSON.stringify({ ...resumo, tabelasPrivadasConferidas: privateTables.length }));
}

async function measure(tx: TransactionSql) {
  // LIKE conserva a forma das tabelas e os índices. Os IDs explícitos evitam
  // tocar as sequências públicas. As tabelas temporárias somem no fim da sessão.
  await tx.unsafe(`
    CREATE TEMP TABLE solicitacao_viagem (LIKE public.solicitacao_viagem INCLUDING INDEXES) ON COMMIT DROP;
    CREATE TEMP TABLE viagem (LIKE public.viagem INCLUDING INDEXES) ON COMMIT DROP;
    CREATE TEMP TABLE motorista (LIKE public.motorista INCLUDING INDEXES) ON COMMIT DROP;
    CREATE TEMP TABLE documento_veiculo (LIKE public.documento_veiculo INCLUDING INDEXES) ON COMMIT DROP;
    CREATE TEMP TABLE abastecimento (LIKE public.abastecimento INCLUDING INDEXES) ON COMMIT DROP;
    INSERT INTO pg_temp.solicitacao_viagem (id,codigo,solicitante_id,origem,destino,data_hora_saida,status)
      SELECT n,'AUD-'||n,1+n%200,'Origem de teste','Destino de teste',date '2097-01-01'+n%365,
        (CASE WHEN n%3=0 THEN 'PENDENTE' ELSE 'AGENDADA' END)::public.status_solicitacao
      FROM generate_series(1,50000) n;
    INSERT INTO pg_temp.viagem (id,solicitacao_id,veiculo_id,motorista_id,status)
      SELECT n,n,1+n%227,1+n%211,(CASE WHEN n%3=0 THEN 'CONCLUIDA' ELSE 'AGENDADA' END)::public.status_viagem
      FROM generate_series(1,50000) n;
    INSERT INTO pg_temp.motorista (id,usuario_id,nome,cnh,categoria_cnh,validade_cnh)
      SELECT n,n,'Motorista de teste','CNH-'||n,'B',date '2097-01-01'+n%365 FROM generate_series(1,2000) n;
    INSERT INTO pg_temp.documento_veiculo (id,veiculo_id,tipo_documento,data_vencimento)
      SELECT n,1+n%227,'Documento de teste',date '2097-01-01'+n%365 FROM generate_series(1,50000) n;
    INSERT INTO pg_temp.abastecimento (id,veiculo_id,litragem,valor_total,data_abastecimento,tanque_completo)
      SELECT n,1+n%227,30,180,date '2097-01-01'+n%365,n%2=0 FROM generate_series(1,50000) n;
    ANALYZE pg_temp.solicitacao_viagem;
    ANALYZE pg_temp.viagem;
    ANALYZE pg_temp.motorista;
    ANALYZE pg_temp.documento_veiculo;
    ANALYZE pg_temp.abastecimento;
  `);
  // Recortes dos filtros e ordenações dos módulos, com valores fixos e projeção mínima.
  const queries = {
    solicitacoes: `SELECT s.id FROM pg_temp.solicitacao_viagem s
      WHERE s.solicitante_id=17 AND s.status::text='PENDENTE' ORDER BY s.id DESC LIMIT 20`,
    viagens: `SELECT v.id FROM pg_temp.viagem v JOIN pg_temp.solicitacao_viagem s ON s.id=v.solicitacao_id
      JOIN pg_temp.motorista m ON m.id=v.motorista_id WHERE m.usuario_id=17
      AND v.status::text='CONCLUIDA' ORDER BY v.id DESC LIMIT 20`,
    documentos: `SELECT id,tipo,validade FROM (
      SELECT id,'DOCUMENTO_VEICULO'::text AS tipo,data_vencimento AS validade FROM pg_temp.documento_veiculo
      UNION ALL SELECT id,'CNH_MOTORISTA',validade_cnh FROM pg_temp.motorista
    ) AS documentos WHERE validade BETWEEN DATE '2097-06-01' AND DATE '2097-06-07'
      ORDER BY validade,tipo,id LIMIT 20`,
    abastecimentos: `SELECT id FROM pg_temp.abastecimento
      WHERE veiculo_id=17 AND data_abastecimento BETWEEN DATE '2097-06-01' AND DATE '2097-06-30'
      ORDER BY data_abastecimento DESC,id DESC LIMIT 20`,
  };
  for (const [consulta, query] of Object.entries(queries)) {
    const measurements = [];
    for (let run = 0; run < 3; run++) {
      const [row] = await tx.unsafe<{ 'QUERY PLAN': { 'Execution Time': number; Plan: Plan }[] }[]>(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + query);
      measurements.push(row['QUERY PLAN'][0]);
    }
    const { 'Execution Time': execucao_ms, Plan: plan } =
      measurements.sort((first, last) => first['Execution Time'] - last['Execution Time'])[1];
    assert.ok(Number.isFinite(execucao_ms) && plan['Actual Rows'] > 0, 'Amostra inválida: ' + consulta);
    console.log('SCRUM-205 EXPLAIN', JSON.stringify({
      consulta, execucao_ms, linhas: plan['Actual Rows'], plano: plan['Node Type'],
      blocos_locais: plan['Local Hit Blocks'] + plan['Local Read Blocks'],
      indices_temporarios: [...new Set(planIndexes(plan))],
    }));
  }
}

const sql = await verifiedSql();
try {
  const [version] = await sql`SHOW server_version`;
  console.log('SCRUM-205 PostgreSQL', version.server_version);
  await sql.begin('read only', catalog);
  await sql.begin(measure);
} finally {
  await sql.end();
}
