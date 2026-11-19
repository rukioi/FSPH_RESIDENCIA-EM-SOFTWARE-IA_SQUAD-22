import { defineConfig } from 'vitest/config';

/** Testes puros dos relatórios; os testes HTTP/SQL continuam no harness padrão obrigatório. */
export default defineConfig({test: {
  include: ['backend/tests/unit/relatorios.test.ts', 'frontend/src/features/relatorios/exportar.test.ts'],
  environment: 'node',
  env: {NODE_ENV:'test',JWT_SECRET:'fixture-relatorios-2026-minimum-32-bytes'},
}});
