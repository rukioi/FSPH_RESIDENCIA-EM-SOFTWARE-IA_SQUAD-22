import { afterEach, expect, test, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { verifiedSql, testUrl, testProfile } from '../../src/database/scripts/verify-test-db.js';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({ on: vi.fn() })),
}));
vi.mock('vite', () => ({
  createServer: vi.fn(async () => ({ listen: vi.fn(), close: vi.fn() })),
}));
vi.mock('../../src/database/scripts/verify-test-db.js', () => ({
  root: process.cwd(),
  testUrl: 'postgresql://fixture:fixture@127.0.0.1:1/fixture',
  testProfile: 's10-integracao-clean',
  verifiedSql: vi.fn(async () => ({ end: vi.fn() })),
  verifyContainer: vi.fn(() => ({ nonce: 'synthetic-nonce' })),
}));

const originalEnv = process.env;
const signals = ['SIGINT', 'SIGTERM'] as const;
const originalListeners = signals.map(signal => process.listeners(signal));

afterEach(() => {
  process.env = originalEnv;
  for (const [index, signal] of signals.entries()) {
    for (const listener of process.listeners(signal)) {
      if (!originalListeners[index]?.includes(listener)) process.off(signal, listener);
    }
  }
  vi.clearAllMocks();
  vi.resetModules();
});

test.each([
  { input: undefined, expected: 'false' },
  { input: 'false', expected: 'false' },
  { input: 'true', expected: 'true' },
])('passes $expected to the backend when the flag is $input', async ({ input, expected }) => {
  process.env = { FSPH_UNLISTED_TEST_VAR: 'synthetic' };
  if (input !== undefined) process.env.MANUTENCAO_ALERTAS_ATIVOS = input;

  await import('../../../tests/e2e/fixtures/test-environment.js');

  expect(verifiedSql).toHaveBeenCalledOnce();
  expect(verifiedSql).toHaveBeenCalledBefore(vi.mocked(spawn));
  expect(spawn).toHaveBeenCalledOnce();
  const forwarded = vi.mocked(spawn).mock.calls[0]?.[2]?.env;
  expect(forwarded).toMatchObject({
    MANUTENCAO_ALERTAS_ATIVOS: expected,
    DATABASE_URL: testUrl,
    FSPH_TEST_PROFILE: testProfile,
    FSPH_TEST_NONCE: 'synthetic-nonce',
  });
  expect(forwarded).not.toHaveProperty('FSPH_UNLISTED_TEST_VAR');
});
