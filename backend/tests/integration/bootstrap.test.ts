import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { testUrl } from '../../src/database/scripts/verify-test-db.js';
import { carregarAmbiente } from '../../src/config/environment.js';

vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const children = new Set<ChildProcess>();
beforeAll(() => {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'backend'], { cwd: root, stdio: 'pipe' });
}, 20000);
afterAll(() => { for (const child of children) child.kill(); });

test('configuração usa raiz e não lê dotenv em testes', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'test';
    carregarAmbiente();
    expect(dotenv.config).not.toHaveBeenCalled();
    process.env.NODE_ENV = 'development';
    carregarAmbiente();
    expect(dotenv.config).toHaveBeenCalledWith({ path: new URL('../../../.env', import.meta.url), quiet: true });
  } finally { process.env.NODE_ENV = previous; }
});

for (const entry of ['backend/src/server.ts', 'backend/dist/server.js']) {
  test(`bootstrap ${entry} usa fixture isolada e encerra HTTP/pool por SIGTERM`, async () => {
    const child = spawn(process.execPath, [
      ...(entry.endsWith('.ts') ? ['--import', 'tsx'] : []),
      '--input-type=module', '-e',
      `import dotenv from 'dotenv';
       dotenv.config = () => {
         process.env.DATABASE_URL = ${JSON.stringify(testUrl)};
         process.env.NODE_ENV = 'test';
         return { parsed: {} };
       };
       process.on('message', () => process.emit('SIGTERM'));
       await import(${JSON.stringify('./' + entry)});`,
    ], {
      cwd: root,
      env: {
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
        // Sem DATABASE_URL inicial: o pool só pode existir após carregar a configuração.
        NODE_ENV: 'development',
        FSPH_TEST_NONCE: process.env.FSPH_TEST_NONCE, JWT_SECRET: 'fixture-t2-bootstrap-32-bytes-minimum',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    children.add(child);
    // dotenv interceptado injeta somente a fixture; nenhum arquivo secreto é lido.
    // IPC permite exercitar SIGTERM no Windows, onde child.kill termina o processo diretamente.
    child.unref();
    const closed = new Promise<number | null>(resolve => child.on('exit', resolve));
    let output = '';
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Bootstrap não iniciou no prazo.')), 10000);
        child.once('exit', () => { clearTimeout(timeout); reject(new Error('Bootstrap encerrou antes de iniciar.')); });
        child.stderr!.on('data', data => {
          output += String(data);
          if (output.includes('server_started')) { clearTimeout(timeout); resolve(); }
        });
        child.once('error', reject);
      });
      const login = await fetch('http://127.0.0.1:3000/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't1-adm@example.invalid', senha: 'T1-fixture-2026!' }),
      });
      // Consulta real da fixture, comparação bcrypt e emissão do JWT.
      expect(login.status).toBe(200);
      await login.arrayBuffer();
      child.send('shutdown');
      // O IPC não deve manter o event loop do servidor aberto após o encerramento.
      child.disconnect();
      expect(await Promise.race([closed, new Promise(resolve => setTimeout(() => resolve('timeout'), 10000))])).toBe(0);
      expect(output).toContain('server_stopped');
      children.delete(child);
    } finally {
      if (children.has(child)) { child.kill(); children.delete(child); }
    }
  }, 25000);
}
