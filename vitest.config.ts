import { defineConfig } from 'vitest/config';

import { testUrl, verifiedSql, verifyContainer } from './backend/src/database/scripts/verify-test-db.js';

export default defineConfig(async () => {
  const sql = await verifiedSql();
  await sql.end();
  return {
    test: {
      include: ['backend/**/*.test.ts', 'frontend/**/*.test.ts', 'frontend/**/*.test.tsx'],
      environment: 'node',
      fileParallelism: false,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: testUrl,
        FSPH_TEST_NONCE: verifyContainer().nonce,
        JWT_SECRET: 'fixture-t1-jwt-2026-32-bytes-minimum',
      },
    },
  };
});
