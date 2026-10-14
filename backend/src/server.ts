import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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