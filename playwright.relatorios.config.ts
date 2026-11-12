import { defineConfig } from '@playwright/test';

/** Exercita a aplicação e downloads com API fictícia; não substitui integração SQL no harness. */
export default defineConfig({
  testDir:'./tests/ui-controls',testMatch:'relatorios.spec.ts',
  outputDir:'./test-results/relatorios',workers:1,
  use:{baseURL:'http://127.0.0.1:5187',browserName:'chromium'},
  webServer:{command:'tsx tests/ui-controls/server.ts',url:'http://127.0.0.1:5187/tests/ui-controls/application.html',reuseExistingServer:false,timeout:60000},
});
