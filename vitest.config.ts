import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['backend/**/*.test.ts', 'frontend/**/*.test.ts', 'frontend/**/*.test.tsx'],
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://teste:teste@127.0.0.1:5432/frota_teste',
    },
  },
});
