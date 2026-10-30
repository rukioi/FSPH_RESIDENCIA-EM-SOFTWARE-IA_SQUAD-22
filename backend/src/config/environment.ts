import dotenv from 'dotenv';
import type { ConnectionOptions } from 'node:tls';

/** Carrega somente o ambiente da raiz, antes dos imports da aplicação; testes usam ambiente explícito. */
export function carregarAmbiente(): void {
  if (process.env.NODE_ENV !== 'test') {
    dotenv.config({ path: new URL('../../../.env', import.meta.url), quiet: true });
  }
}

/** Valida TLS sem incluir URL ou credenciais nos erros. Só loopback explícito permite desativá-lo. */
export function configurarBanco(env: NodeJS.ProcessEnv = process.env): {
  url: string; ssl: false | ConnectionOptions;
} {
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL ?? '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch { throw new Error('Configuração do banco inválida.'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  const mode = env.DB_TLS ?? 'verify';
  if (!['verify', 'disable'].includes(mode) || (mode === 'disable' && !local)) {
    throw new Error('Configuração TLS do banco inválida.');
  }
  for (const key of [...url.searchParams.keys()]) {
    if (/^ssl/i.test(key)) {
      if (key !== 'sslmode' || !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get(key)!)) {
        throw new Error('Parâmetro TLS do banco não permitido.');
      }
      url.searchParams.delete(key);
    }
  }
  return { url: url.toString(), ssl: mode === 'disable' ? false : { rejectUnauthorized: true } };
}

/** Inteiro positivo com limite superior, sem refletir valor recebido em mensagens. */
export function inteiroAmbiente(nome: string, padrao: number, maximo: number): number {
  const value = process.env[nome];
  if (value === undefined) return padrao;
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > maximo) {
    throw new Error('Configuração numérica inválida.');
  }
  return number;
}
