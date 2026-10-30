import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, verifiedSql } from './verify-test-db.js';

/** Aplica somente migrations novas em transação; recusa alteração de histórico. */
export async function prepare() {
  const sql = await verifiedSql(true);
  try {
    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(270027)`;
      await tx`create schema if not exists fsph_test_harness`;
      await tx`create table if not exists fsph_test_harness.migrations
        (name text primary key, sha256 text not null)`;
      const directory = resolve(root, 'backend/src/database/supabase/migrations');
      for (const name of readdirSync(directory).filter(n => /^\d+_[a-z0-9_-]+\.sql$/.test(n)).sort()) {
        const source = readFileSync(resolve(directory, name), 'utf8').replaceAll('\r\n', '\n');
        const hash = createHash('sha256').update(source).digest('hex');
        const [applied] = await tx`select sha256 from fsph_test_harness.migrations where name = ${name}`;
        if (applied && applied.sha256 !== hash) throw new Error('Migration já aplicada foi alterada: ' + name);
        if (!applied) {
          await tx.unsafe(source);
          await tx`insert into fsph_test_harness.migrations values (${name}, ${hash})`;
        }
      }
      await tx.unsafe(readFileSync(resolve(root, 'backend/src/database/supabase/seed.sql'), 'utf8'));
    });
  } finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepare();
  console.log('Migrations e seed aplicados no banco isolado.');
}
