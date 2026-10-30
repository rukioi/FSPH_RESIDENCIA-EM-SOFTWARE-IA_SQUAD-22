import postgres from 'postgres';
import { configurarBanco } from '../config/environment.js';

if (process.env.NODE_ENV === 'test') {
  const { verifyTestEnvironment } = await import('./scripts/verify-test-db.js');
  await verifyTestEnvironment();
}
const config = configurarBanco(process.env.NODE_ENV === 'test'
  ? { ...process.env, DB_TLS: 'disable' } : process.env);

/** Pool único da aplicação; os clientes do harness são exclusivos da verificação isolada. */
export const sql = postgres(config.url, {
  ssl: config.ssl, max: 10, idle_timeout: 20, connect_timeout: 15,
  onnotice: () => {},
});
let fechamento: Promise<void> | undefined;
/** Aguarda consultas em andamento e fecha o pool uma única vez. */
export function fecharBanco(): Promise<void> {
  return fechamento ??= sql.end({ timeout: 5 });
}
