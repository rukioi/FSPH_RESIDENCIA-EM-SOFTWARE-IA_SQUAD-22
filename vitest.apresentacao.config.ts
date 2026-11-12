import { defineConfig } from 'vitest/config';

/** Somente testes puros de apresentação/serviços e mocks explícitos, sem conexão SQL. */
export default defineConfig({ test: {
  include: ['frontend/**/*.test.ts', 'frontend/**/*.test.tsx', 'backend/tests/unit/relatorios.test.ts', 'backend/tests/unit/veiculos-foto.test.ts'],
  environment: 'node', fileParallelism: false,
  env: { NODE_ENV: 'test', JWT_SECRET: 'fixture-ui-2026-minimum-32-bytes-only' },
} });
