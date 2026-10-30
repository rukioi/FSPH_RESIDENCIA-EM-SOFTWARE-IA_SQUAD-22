import postgres from 'postgres';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const diretorioAtual = dirname(fileURLToPath(import.meta.url));
const caminhoEnv = resolve(diretorioAtual, '../../.env');

if (process.env.NODE_ENV === 'test') {
  const { verifyTestEnvironment } = await import('../database/scripts/verify-test-db.js');
  await verifyTestEnvironment();
} else {
  dotenv.config({ path: caminhoEnv });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(`DATABASE_URL não está definida. Arquivo esperado: ${caminhoEnv}`);
}

export const sql = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'test' ? false : { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 20,
  connect_timeout: 15,
});

export default sql;
