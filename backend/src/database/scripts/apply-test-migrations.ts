import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ReservedSql } from 'postgres';
import { root, verifiedSql, isS10, testProfile } from './verify-test-db.js';

async function transaction(connection: ReservedSql, operation: () => Promise<unknown>) {
  await connection`begin`;
  try {
    await operation();
    await connection`commit`;
  } catch (error) {
    await connection`rollback`;
    throw error;
  }
}

/** Confirma cada migration antes do seed, sob lock de sessão e proveniência isolada verificada. */
export async function prepare(options:{seed?:boolean; through?:string}={}) {
  if (options.through !== undefined && (!['s10-upgrade', 's10-integracao-upgrade', 's10-consolidada-upgrade'].includes(testProfile) || !/^\d{14}$/.test(options.through))) {
    throw new Error('Corte de versão permitido apenas no upgrade Sprint 10.');
  }
  const sql = await verifiedSql(true);
  try {
    const connection = await sql.reserve();
    let locked = false;
    try {
      await connection`select pg_advisory_lock(270027)`;
      locked = true;
      await transaction(connection, async () => {
        await connection`create schema if not exists fsph_test_harness`;
        await connection`create table if not exists fsph_test_harness.migrations
          (name text primary key, sha256 text not null)`;
      });
      const directory = resolve(root, 'backend/src/database/supabase/migrations');
      const migrations = readdirSync(directory).filter(n => /^\d+_[a-z0-9_-]+\.sql$/.test(n)).sort().map(name => {
        const source = readFileSync(resolve(directory, name), 'utf8').replaceAll('\r\n', '\n');
        const hash = createHash('sha256').update(source).digest('hex');
        return {name,source,hash};
      });
      const history = await connection`select name, sha256 from fsph_test_harness.migrations`;
      const applied = new Map(history.map(row => [String(row.name), String(row.sha256)]));
      const through = options.through;
      if (through !== undefined && (migrations.filter(m => m.name.startsWith(through + '_')).length !== 1 ||
          history.some(row => String(row.name).split('_')[0] > through))) {
        throw new Error('Versão de corte não é única ou o banco já avançou além dela.');
      }
      if (isS10) {
        await connection`GRANT USAGE ON SCHEMA fsph_test_harness TO postgres`;
        await connection`GRANT SELECT ON fsph_test_harness.migrations TO postgres`;
      }
      // Verifica todo o histórico antes de executar qualquer migration pendente.
      for (const migration of migrations) {
        if (applied.has(migration.name) && applied.get(migration.name) !== migration.hash) {
          throw new Error('Migration já aplicada foi alterada: ' + migration.name);
        }
      }
      for (const {name,source,hash} of migrations) {
        if (applied.has(name) || (through !== undefined && name.split('_')[0] > through)) continue;
        await transaction(connection, async () => {
          // O runner controla a transação do DDL e do checksum. O envelope
          // externo do SQL também permite aplicar a migration manualmente.
          const body = source.match(/^BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/i)?.[1] ?? source;
          await connection.unsafe(body);
          await connection`insert into fsph_test_harness.migrations values (${name}, ${hash})`;
        });
      }
      // O novo valor de enum já foi confirmado em outra transação.
      if(options.seed!==false)await transaction(connection, () => connection.unsafe(readFileSync(resolve(root, 'backend/src/database/supabase/seed.sql'), 'utf8')));
    } finally {
      try { if (locked) await connection`select pg_advisory_unlock(270027)`; }
      finally { await connection.release(); }
    }
  } finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const seed=!process.argv.includes('--no-seed');
  const cutoff = process.argv.find(arg => arg.startsWith('--through='));
  await prepare({seed, through: cutoff?.slice('--through='.length)});
  console.log(seed?'Migrations e seed aplicados no banco isolado.':'Migrations aplicadas no banco isolado, sem seed.');
}
