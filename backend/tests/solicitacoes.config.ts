import { defineConfig } from 'vitest/config';

// Não importa vitest.config.ts: a configuração global abre o harness PostgreSQL.
export default defineConfig({
  test: {
    include: ['backend/tests/unit/solicitacoes*.test.ts', 'backend/tests/contract/generation.test.ts', 'backend/tests/integration/svo.repository.test.ts'],
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'fixture-solicitacoes-minimum-32-bytes',
      DATABASE_URL: 'postgresql://fixture:fixture@example.invalid/blocked',
    },
  },
});
