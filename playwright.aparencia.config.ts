import { defineConfig } from '@playwright/test';

/** Valida UI com respostas HTTP fictícias, sem iniciar backend ou acessar banco. */
export default defineConfig({
  testDir: './tests/ui-controls', testMatch: ['aparencia.spec.ts', 'relatorios.spec.ts', 'application.spec.ts', 'controls.spec.ts'],
  outputDir: './test-results/aparencia', workers: 1,
  use: { baseURL: 'http://127.0.0.1:5187', browserName: 'chromium' },
  webServer: { command: 'tsx tests/ui-controls/server.ts', url: 'http://127.0.0.1:5187/tests/ui-controls/application.html', reuseExistingServer: false, timeout: 60000 },
});
