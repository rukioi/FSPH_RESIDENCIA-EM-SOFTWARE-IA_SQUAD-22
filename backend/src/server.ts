import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
import { createApp } from './app.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const caminhoEnv = path.resolve(__dirname, '../../.env');
if (existsSync(caminhoEnv)) {
  dotenv.config({ path: caminhoEnv });
} else {
  dotenv.config();
}

const server = createApp();

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error('Não foi possível iniciar o servidor:', error.message);
  process.exitCode = 1;
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Backend disponível em http://127.0.0.1:3000');
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      console.log('Servidor encerrado com sucesso.');
      process.exit(0);
    });
  });
}