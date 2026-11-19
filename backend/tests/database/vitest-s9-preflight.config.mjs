import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { verifiedSql,verifyContainer } from './s9-preflight-harness.mjs';

export default defineConfig(async()=>{
  const sql=await verifiedSql();
  try{
    const [conexoes]=await sql`SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()`;
    if(conexoes.total!==0)throw new Error('Conexoes concorrentes no banco dedicado.');
  }finally{await sql.end();}
  verifyContainer();
  return {
    resolve:{alias:[{find:'../../src/database/scripts/verify-test-db.js',replacement:fileURLToPath(new URL('./s9-preflight-harness.mjs',import.meta.url))}]},
    test:{include:['backend/tests/database/sprint9-preflight.test.ts'],environment:'node',fileParallelism:false},
  };
});
