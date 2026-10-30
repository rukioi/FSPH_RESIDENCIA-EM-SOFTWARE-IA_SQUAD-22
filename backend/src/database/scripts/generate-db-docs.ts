import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, verifiedSql } from './verify-test-db.js';

interface AclObject { name: string; owner: string; acl: string | null }
interface Table extends AclObject { rls: boolean; forceRls: boolean }
interface Column { table: string; name: string; position: number; type: string; nullable: boolean; default: string | null; identity: string; generated: string }
interface Constraint { table: string; name: string; type: string; definition: string; validated: boolean; columns: string[]; references: string | null; referencedColumns: string[] | null; onDelete: string; onUpdate: string }
interface Sequence extends AclObject { type: string; start: string; increment: string; min: string; max: string; cache: string; cycle: boolean; table: string; column: string }
export interface Metadata {
  tables: Table[]; columns: Column[]; constraints: Constraint[];
  enums: (AclObject & { values: string[] })[];
  sequences: Sequence[];
  indexes: { table: string; name: string; definition: string }[];
  schema: AclObject; defaultAcl: { owner: string; type: string; acl: string }[];
  policies: unknown[]; triggers: string[];
}

export const metadataQuery = "select jsonb_build_object(\n'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'acl',c.relacl::text) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),\n'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'position',a.attnum,'type',format_type(a.atttypid,a.atttypmod),'nullable',not a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) order by c.relname,a.attnum) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname='public' and c.relkind='r' and a.attnum>0 and not a.attisdropped),\n'constraints',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',con.conname,'type',con.contype,'definition',pg_get_constraintdef(con.oid,true),'validated',con.convalidated,'columns',(select jsonb_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=c.oid and a.attnum=k.num),'references',r.relname,'referencedColumns',(select jsonb_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=r.oid and a.attnum=k.num),'onDelete',con.confdeltype,'onUpdate',con.confupdtype) order by c.relname,con.conname) from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace left join pg_class r on r.oid=con.confrelid where n.nspname='public'),\n'enums',(select jsonb_agg(jsonb_build_object('name',t.typname,'owner',pg_get_userbyid(t.typowner),'acl',t.typacl::text,'values',(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) order by t.typname) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'),\n'indexes',(select jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) order by tablename,indexname) from pg_indexes where schemaname='public'),\n'sequences',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'type',format_type(s.seqtypid,null),'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle,'table',tc.relname,'column',a.attname) order by c.relname) from pg_sequence s join pg_class c on c.oid=s.seqrelid join pg_namespace n on n.oid=c.relnamespace left join pg_depend dep on dep.objid=c.oid and dep.deptype in ('a','i') left join pg_class tc on tc.oid=dep.refobjid left join pg_attribute a on a.attrelid=tc.oid and a.attnum=dep.refobjsubid where n.nspname='public'),\n'schema',(select jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) from pg_namespace where nspname='public'),\n'defaultAcl',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'type',d.defaclobjtype,'acl',d.defaclacl::text) order by d.defaclobjtype), '[]'::jsonb) from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public'),\n'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname),'[]'::jsonb) from pg_policies p where schemaname='public'),\n'triggers',(select coalesce(jsonb_agg(pg_get_triggerdef(t.oid) order by t.tgname),'[]'::jsonb) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)\n) as metadata;";
const q = (value: string) => '"' + value.replaceAll('"', '""') + '"';
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const privileges: Record<string, string> = {
  a: 'INSERT', r: 'SELECT', w: 'UPDATE', d: 'DELETE', D: 'TRUNCATE',
  x: 'REFERENCES', t: 'TRIGGER', m: 'MAINTAIN', U: 'USAGE', C: 'CREATE', X: 'EXECUTE',
};
const roles = 'PUBLIC, postgres, anon, authenticated, service_role';
function aclItems(acl: string) {
  return acl.slice(1, -1).split(',').filter(Boolean).map(item => {
    const match = /^([^=]*)=([^/]+)\/(.+)$/.exec(item);
    if (!match) throw new Error('ACL não suportada: ' + item);
    return { grantee: match[1] ? q(match[1]) : 'PUBLIC', rights: match[2], grantor: match[3] };
  });
}
function grants(acl: string | null, target: string, prefix = '') {
  if (acl === null) return [];
  return aclItems(acl).flatMap(item => {
    const statements: string[] = [];
    for (const match of item.rights.matchAll(/([arwdDxtmUCX])(\*)?/g)) {
      statements.push(prefix + 'GRANT ' + privileges[match[1]] + ' ON ' + target +
        ' TO ' + item.grantee + (match[2] ? ' WITH GRANT OPTION' : '') + ';');
    }
    return statements;
  });
}

/** Canonicaliza somente ordem de ACLs; mantém grantor, privilégios e definições. */
export function canonical(metadata: Metadata): Metadata {
  const copy: Metadata = JSON.parse(JSON.stringify(metadata));
  const sorted = (acl: string | null) => acl === null ? null :
    '{' + acl.slice(1, -1).split(',').sort().join(',') + '}';
  for (const item of [...copy.tables, ...copy.enums, ...copy.sequences, copy.schema]) item.acl = sorted(item.acl);
  copy.defaultAcl = copy.defaultAcl.map(item => ({ ...item, acl: sorted(item.acl)! }))
    .sort((a, b) => (a.owner + a.type).localeCompare(b.owner + b.type));
  return copy;
}

/** Reconstrói DDL apenas dos metadados auditados, sem dados nem regras inferidas. */
export function renderSchema(m: Metadata): string {
  if (m.policies.length || m.triggers.length || m.columns.some(c => c.identity || c.generated)) {
    throw new Error('Metadado novo exige suporte explícito no gerador.');
  }
  const lines = [
    '-- Gerado de metadados PostgreSQL: T1 (#27). Não editar manualmente.',
    '-- Grants amplos e RLS desativada reproduzem o estado anterior.',
    '-- NÃO é configuração segura para nova publicação ou aplicação em banco existente.',
    'SET search_path = public, pg_catalog;',
  ];
  for (const e of m.enums) {
    lines.push('CREATE TYPE public.' + q(e.name) + ' AS ENUM (' + e.values.map(literal).join(', ') + ');');
    lines.push('ALTER TYPE public.' + q(e.name) + ' OWNER TO ' + q(e.owner) + ';');
    lines.push(...grants(e.acl, 'TYPE public.' + q(e.name)));
  }
  for (const s of m.sequences) {
    lines.push('CREATE SEQUENCE public.' + q(s.name) + ' AS ' + s.type +
      ' INCREMENT BY ' + s.increment + ' MINVALUE ' + s.min + ' MAXVALUE ' + s.max +
      ' START WITH ' + s.start + ' CACHE ' + s.cache + (s.cycle ? ' CYCLE' : ' NO CYCLE') + ';');
    lines.push('ALTER SEQUENCE public.' + q(s.name) + ' OWNER TO ' + q(s.owner) + ';');
  }
  for (const t of m.tables) {
    lines.push('CREATE TABLE public.' + q(t.name) + ' (\n' +
      m.columns.filter(c => c.table === t.name).map(c => '  ' + q(c.name) + ' ' + c.type +
        (c.default !== null ? ' DEFAULT ' + c.default : '') + (c.nullable ? '' : ' NOT NULL')).join(',\n') + '\n);');
    lines.push('ALTER TABLE public.' + q(t.name) + ' OWNER TO ' + q(t.owner) + ';');
  }
  for (const s of m.sequences) lines.push('ALTER SEQUENCE public.' + q(s.name) +
    ' OWNED BY public.' + q(s.table) + '.' + q(s.column) + ';');
  for (const c of [...m.constraints.filter(c => c.type !== 'f'), ...m.constraints.filter(c => c.type === 'f')]) {
    // O cast explícito de array reanalisado distribui casts nos elementos em PG17.
    // A expressão do incremental original preserva também a árvore/deparse auditada.
    const definition = c.name === 'veiculo_vinculo_check' &&
      c.definition === "CHECK (vinculo::text = ANY (ARRAY['PROPRIO'::character varying, 'LOCADO'::character varying]::text[]))"
      ? "CHECK (vinculo IN ('PROPRIO', 'LOCADO'))" : c.definition;
    lines.push('ALTER TABLE public.' + q(c.table) + ' ADD CONSTRAINT ' + q(c.name) + ' ' + definition + ';');
  }
  for (const index of m.indexes.filter(i => !m.constraints.some(c => c.table === i.table && c.name === i.name && ['p', 'u'].includes(c.type)))) {
    lines.push(index.definition + ';');
  }
  for (const t of m.tables) {
    const target = 'TABLE public.' + q(t.name);
    lines.push('ALTER TABLE public.' + q(t.name) + (t.rls ? ' ENABLE' : ' DISABLE') + ' ROW LEVEL SECURITY;');
    lines.push('ALTER TABLE public.' + q(t.name) + (t.forceRls ? ' FORCE' : ' NO FORCE') + ' ROW LEVEL SECURITY;');
    lines.push('REVOKE ALL ON ' + target + ' FROM ' + roles + ';', ...grants(t.acl, target));
  }
  for (const s of m.sequences) {
    const target = 'SEQUENCE public.' + q(s.name);
    lines.push('REVOKE ALL ON ' + target + ' FROM ' + roles + ';', ...grants(s.acl, target));
  }
  lines.push('ALTER SCHEMA public OWNER TO ' + q(m.schema.owner) + ';',
    'REVOKE ALL ON SCHEMA public FROM ' + roles + ', pg_database_owner;',
    ...grants(m.schema.acl, 'SCHEMA public'));
  for (const d of m.defaultAcl) {
    const category = ({ r: 'TABLES', S: 'SEQUENCES', f: 'FUNCTIONS' } as Record<string, string>)[d.type];
    if (!category) throw new Error('Categoria ACL não suportada.');
    const prefix = 'ALTER DEFAULT PRIVILEGES FOR ROLE ' + q(d.owner) + ' IN SCHEMA public ';
    lines.push(prefix + 'REVOKE ALL ON ' + category + ' FROM ' + roles + ';',
      ...grants(d.acl, category, prefix));
  }
  return lines.join('\n') + '\n';
}

/** Gera DER com nullabilidade, unicidade, cardinalidade e ações de exclusão. */
export function renderDer(m: Metadata): string {
  const lines = ['%% Gerado por db:docs:generate. Não editar.', 'erDiagram'];
  for (const t of m.tables) {
    lines.push('  ' + t.name + ' {');
    for (const c of m.columns.filter(c => c.table === t.name)) {
      const constraints = m.constraints.filter(k => k.table === t.name && k.columns?.includes(c.name));
      const keys = [...new Set(constraints.map(k => ({ p: 'PK', f: 'FK', u: 'UK' } as Record<string, string>)[k.type]).filter(Boolean))];
      lines.push('    ' + c.type.replaceAll(/[^a-zA-Z0-9_]/g, '_') + ' ' + c.name +
        (keys.length ? ' ' + keys.join(',') : '') + ' "' + (c.nullable ? 'nullable' : 'NOT NULL') + '"');
    }
    lines.push('  }');
  }
  const actions: Record<string, string> = { a: 'NO ACTION', n: 'SET NULL', c: 'CASCADE', r: 'RESTRICT', d: 'SET DEFAULT' };
  for (const fk of m.constraints.filter(c => c.type === 'f')) {
    const nullable = m.columns.some(c => c.table === fk.table && fk.columns.includes(c.name) && c.nullable);
    const unique = m.constraints.some(c => c.table === fk.table && ['p', 'u'].includes(c.type) &&
      JSON.stringify(c.columns) === JSON.stringify(fk.columns));
    lines.push('  ' + fk.references + (nullable ? ' |o--' : ' ||--') + (unique ? 'o|' : 'o{') +
      ' ' + fk.table + ' : "' + fk.name + ' DELETE ' + actions[fk.onDelete] + '"');
  }
  return lines.join('\n') + '\n';
}

/** Lê só catálogos no banco local comprovado e verifica todos os artefatos gerados. */
export async function generate(check: boolean) {
  const sql = await verifiedSql();
  let metadata: Metadata;
  try {
    await sql`set search_path = public, pg_catalog`;
    const [row] = await sql.unsafe(metadataQuery);
    metadata = canonical(row.metadata as Metadata);
  } finally { await sql.end(); }
  const directory = resolve(root, 'docs/database');
  mkdirSync(directory, { recursive: true });
  const outputs = {
    'schema-metadata.json': JSON.stringify(metadata, null, 2) + '\n',
    'schema.sql': renderSchema(metadata),
    'der.mmd': renderDer(metadata),
  };
  for (const [name, source] of Object.entries(outputs)) {
    const path = resolve(directory, name);
    if (check) {
      if (readFileSync(path, 'utf8').replaceAll('\r\n', '\n') !== source) throw new Error('Drift estrutural: ' + name);
    } else { writeFileSync(path, source); }
  }
  console.log(check ? 'Sem drift nos metadados, schema e DER.' : 'Metadados, schema e DER gerados do banco isolado.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const auditIndex = process.argv.indexOf('--baseline-from-audit');
  if (auditIndex >= 0) {
    const metadata = JSON.parse(readFileSync(process.argv[auditIndex + 1], 'utf8')) as Metadata;
    const baseline = resolve(root, 'backend/src/database/supabase/migrations/20261030000000_baseline.sql');
    if (readFileSync(resolve(root, 'backend/src/database/supabase/config.toml'), 'utf8').includes('enabled = true')) {
      throw new Error('Aplicação automática deve estar desativada.');
    }
    mkdirSync(resolve(baseline, '..'), { recursive: true });
    writeFileSync(baseline, renderSchema(metadata));
  } else { await generate(process.argv.includes('--check')); }
}
