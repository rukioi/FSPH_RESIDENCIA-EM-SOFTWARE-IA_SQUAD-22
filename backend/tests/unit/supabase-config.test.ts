import { X509Certificate } from 'node:crypto';
import { rootCertificates, createSecureContext, createServer, connect } from 'node:tls';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { configurarBanco } from '../../src/config/environment.js';

test.each([
  'aws-1-sa-east-1.pooler.supabase.com',
  'db.projeto-ficticio.supabase.co',
])('Supabase configura confiança TLS automaticamente para %s', hostname => {
  const { ssl } = configurarBanco({ DATABASE_URL: `postgres://fixture:fixture@${hostname}:6543/postgres` });
  expect(ssl).toMatchObject({ rejectUnauthorized: true });
  if (!ssl) throw new Error('TLS obrigatório.');
  expect(Array.isArray(ssl.ca)).toBe(true);
  const certificates = ssl.ca as string[];
  expect(certificates).toEqual(expect.arrayContaining([...rootCertificates]));
  const supabase = new X509Certificate(certificates[certificates.length - 1]);
  expect(supabase.subject).toContain('CN=Supabase Root 2021 CA');
  expect(supabase.ca).toBe(true);
  expect(supabase.verify(supabase.publicKey)).toBe(true);
  expect(() => createSecureContext(ssl)).not.toThrow();
});

test.each([
  'remote.invalid', 'supabase.com.atacante.invalid',
  'fake-pooler.supabase.com', 'db.projeto.supabase.co.atacante.invalid',
])('outros hosts preservam a política TLS padrão: %s', hostname => {
  expect(configurarBanco({ DATABASE_URL: `postgres://fixture@${hostname}/postgres` }).ssl)
    .toEqual({ rejectUnauthorized: true });
});

test('Supabase não permite desativar TLS nem substituir a confiança pela URL', () => {
  const DATABASE_URL = 'postgres://fixture@aws-1-sa-east-1.pooler.supabase.com/postgres';
  expect(() => configurarBanco({ DATABASE_URL, DB_TLS: 'disable' })).toThrow(/TLS/);
  expect(() => configurarBanco({ DATABASE_URL: DATABASE_URL + '?sslrootcert=outro.crt' })).toThrow(/TLS/);
  expect(configurarBanco({ DATABASE_URL: DATABASE_URL + '?sslmode=require' }).url).not.toContain('sslmode');
});

test('confiança automática do Supabase continua rejeitando certificado artificial', async () => {
  const server = createServer({
    key: readFileSync(new URL('./fixtures/artificial-tls-key.pem', import.meta.url)),
    cert: readFileSync(new URL('./fixtures/artificial-tls-cert.pem', import.meta.url)),
  });
  server.on('tlsClientError', () => {});
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { ssl } = configurarBanco({ DATABASE_URL: 'postgres://fixture@aws-1-sa-east-1.pooler.supabase.com/postgres' });
  if (!ssl) throw new Error('TLS obrigatório.');
  const client = connect({
    ...ssl, host: '127.0.0.1', port: (server.address() as AddressInfo).port,
    servername: 'aws-1-sa-east-1.pooler.supabase.com',
  });
  try {
    await expect(new Promise<void>((resolve, reject) => {
      client.once('secureConnect', resolve);
      client.once('error', reject);
    })).rejects.toMatchObject({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  } finally {
    client.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
