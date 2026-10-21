import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const caminhoEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');

if (existsSync(caminhoEnv)) {
  loadEnvFile(caminhoEnv);
}

const { createApp } = await import('./app.js');

const server = createApp();

server.on('error', (error) => {
  console.error('Não foi possível iniciar o servidor:', error.message);
  process.exitCode = 1;
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Backend disponível em http://127.0.0.1:3000');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close());
}
