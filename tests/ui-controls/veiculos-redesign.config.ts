import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'veiculos-redesign.spec.ts',
  outputDir: '../../test-results/veiculos-redesign',
  use: { baseURL: 'http://127.0.0.1:5187', browserName: 'chromium' },
  webServer: { command: 'tsx tests/ui-controls/server.ts', cwd: '../..',
    url: 'http://127.0.0.1:5187/tests/ui-controls/application.html', reuseExistingServer: false, timeout: 60_000 },
});
