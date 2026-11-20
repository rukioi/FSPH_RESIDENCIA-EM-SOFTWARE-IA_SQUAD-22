import { defineConfig } from 'vitest/config';
import { testUrl, verifiedSql, verifyContainer, testProfile } from '../../src/database/scripts/verify-test-db.ts';

export default defineConfig(async () => {
  if (testProfile === 't1') throw new Error('Selecione um perfil isolado Sprint 9 para este teste.');
  const manifest = verifyContainer();
  const sql = await verifiedSql();
  try {
    const [r] = await sql.unsafe('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()');
    if (r.n !== 0) throw new Error('Conexões concorrentes no banco dedicado.');
  } finally { await sql.end(); }
  return {
    test: { include: ['backend/tests/integration/s9-concorrencia-abastecimento.test.ts'], environment: 'node',
      fileParallelism: false, env: { NODE_ENV: 'test', FSPH_TEST_PROFILE: testProfile, DATABASE_URL: testUrl, FSPH_TEST_NONCE: manifest.nonce,
        JWT_SECRET: 's9-integration-only-fake-secret-32-bytes' } },
  };
});
