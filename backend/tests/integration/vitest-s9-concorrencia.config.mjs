import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { testUrl, verifiedSql, verifyContainer } from '../database/s9-preflight-harness.mjs';

export default defineConfig(async () => {
  const manifest = verifyContainer();
  const sql = await verifiedSql();
  try {
    const [r] = await sql.unsafe('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()');
    if (r.n !== 0) throw new Error('Conexões concorrentes no banco dedicado.');
  } finally { await sql.end(); }
  const replacement = fileURLToPath(new URL('./s9-concorrencia-verifier.mjs', import.meta.url));
  return {
    resolve: { alias: [
      { find: '../../src/database/scripts/verify-test-db.js', replacement },
      { find: './scripts/verify-test-db.js', replacement },
    ] },
    test: { include: ['backend/tests/integration/s9-concorrencia-abastecimento.test.ts'], environment: 'node',
      fileParallelism: false, env: { DATABASE_URL: testUrl, FSPH_TEST_NONCE: manifest.nonce,
        JWT_SECRET: 's9-integration-only-fake-secret-32-bytes' } },
  };
});
