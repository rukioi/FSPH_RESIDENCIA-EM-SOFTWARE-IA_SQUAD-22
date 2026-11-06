import { defineConfig } from 'vitest/config';

/** Regressões puras do cache e transporte; a suíte padrão mantém o harness de banco. */
export default defineConfig({
  test: { include: [
    'frontend/src/shared/services/dashboard-cache.test.ts',
    'frontend/src/shared/services/dashboard.retry.test.ts',
    'frontend/src/shared/api/client.test.ts',
  ] },
});
