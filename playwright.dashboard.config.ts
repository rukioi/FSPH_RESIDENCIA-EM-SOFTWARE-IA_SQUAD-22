import { defineConfig } from '@playwright/test';

/** Evidência visual isolada: respostas da API são fixtures explícitas do teste. */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'dashboard-gestor.spec.ts',
  outputDir: 'test-results/dashboard',
  use: { baseURL: 'http://127.0.0.1:5175', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev --workspace frontend -- --host 127.0.0.1 --port 5175',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  },
});
