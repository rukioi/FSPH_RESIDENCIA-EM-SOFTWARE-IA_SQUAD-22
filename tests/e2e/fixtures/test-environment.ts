import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { root, testUrl, verifiedSql, verifyContainer } from '../../../backend/src/database/scripts/verify-test-db.js';

const sql = await verifiedSql();
await sql.end();
const env: NodeJS.ProcessEnv = {};
for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA']) {
  if (process.env[key]) env[key] = process.env[key];
}
Object.assign(env, {
  NODE_ENV: 'test', DATABASE_URL: testUrl,
  FSPH_TEST_NONCE: verifyContainer().nonce,
  JWT_SECRET: 'fixture-t1-jwt-2026-32-bytes-minimum',
});
process.env = env;
const { createServer } = await import('vite');
const frontend = await createServer({
  root: resolve(root, 'frontend'),
  configFile: resolve(root, 'frontend/vite.config.ts'),
  envDir: false,
  mode: 'test',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
await frontend.listen();
const backend = spawn(process.execPath, [resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'src/server.ts'],
  { cwd: resolve(root, 'backend'), env, stdio: 'inherit' });
const children = [backend];
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  for (const child of children) child.kill(signal);
  void frontend.close();
});
for (const child of children) child.on('exit', code => {
  for (const other of children) if (other !== child) other.kill();
  void frontend.close();
  process.exitCode = code ?? 1;
});
