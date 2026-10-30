import { afterAll, expect, test, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { carregarAmbiente, configurarBanco } from '../../src/config/environment.js';
import { registrarFalha } from '../../src/shared/logging/logger.js';
import { criarLimiteLogin } from '../../src/shared/http/rate-limit.js';
import { lerCorpoJson } from '../../src/shared/http/body.js';
import { receberUpload } from '../../src/modules/documentos/documentos.upload.js';
import { sql, fecharBanco } from '../../src/database/connection.js';
import { sql as legado } from '../../src/config/db.js';

const asRequest = (corpo: Buffer | string) => Readable.from([corpo]) as IncomingMessage;
afterAll(async () => { const first = fecharBanco(); expect(fecharBanco()).toBe(first); await first; });

test('adaptador usa o mesmo pool e fechamento é idempotente', async () => {
  expect(legado).toBe(sql);
  const [row] = await sql`select current_database() as name`;
  expect(row.name).toBe('fsph_t1_baseline');
  // O encerramento real ocorre em afterAll, sem afetar as demais provas.
});

test('dotenv aceita URL de arquivo fictício sem acessar configuração do desenvolvedor', () => {
  const actual = dotenv.config;
  const previous = process.env.NODE_ENV;
  const fixturePrevious = process.env.FSPH_T2_CONFIG_FIXTURE;
  // Redireciona antes da leitura: a função real só recebe a fixture explícita.
  const config = vi.spyOn(dotenv, 'config').mockImplementation(options => actual({
    ...options, path: new URL('./fixtures/config.fixture', import.meta.url),
  }));
  try {
    delete process.env.FSPH_T2_CONFIG_FIXTURE;
    process.env.NODE_ENV = 'development';
    carregarAmbiente();
    expect(config).toHaveBeenCalledOnce();
    expect(process.env.FSPH_T2_CONFIG_FIXTURE).toBe('explicit-artificial-configuration');
  } finally {
    config.mockRestore();
    process.env.NODE_ENV = previous;
    if (fixturePrevious === undefined) delete process.env.FSPH_T2_CONFIG_FIXTURE;
    else process.env.FSPH_T2_CONFIG_FIXTURE = fixturePrevious;
  }
});

test('TLS remoto exige verificação e recusa opções inseguras sem vazar URL', () => {
  expect(configurarBanco({ DATABASE_URL: 'postgres://fiction:sentinela@remote.invalid/db' }).ssl).toEqual({ rejectUnauthorized: true });
  for (const env of [
    { DATABASE_URL: 'postgres://fiction:sentinela@remote.invalid/db', DB_TLS: 'disable' },
    { DATABASE_URL: 'postgres://fiction:sentinela@remote.invalid/db?sslmode=disable' },
    { DATABASE_URL: 'sentinela' },
  ]) {
    expect(() => configurarBanco(env)).toThrow(/banco/);
    try { configurarBanco(env); } catch (error) { expect(String(error)).not.toContain('sentinela'); }
  }
  expect(configurarBanco({ DATABASE_URL: 'postgres://fiction@127.0.0.1/db', DB_TLS: 'disable' }).ssl).toBe(false);
});

test('cliente postgres rejeita certificado artificial sem confiança', async () => {
  // Certificado e chave gerados exclusivamente para esta fixture fictícia.
  const context = tls.createSecureContext({
    key: readFileSync(new URL('./fixtures/artificial-tls-key.pem', import.meta.url)),
    cert: readFileSync(new URL('./fixtures/artificial-tls-cert.pem', import.meta.url)),
  });
  const sockets = new Set<net.Socket>();
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.once('data', () => {
      socket.write('S'); // Resposta PostgreSQL ao pedido SSLRequest.
      const secure = new tls.TLSSocket(socket, { isServer: true, secureContext: context });
      secure.on('error', () => secure.destroy());
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as net.AddressInfo).port;
  const config = configurarBanco({ DATABASE_URL: `postgres://fiction:fiction@127.0.0.1:${port}/fiction` });
  const client = postgres(config.url, { ssl: config.ssl, connect_timeout: 2 });
  try {
    await expect(client`select 1`).rejects.toMatchObject({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  } finally {
    await client.end({ timeout: 0 });
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('logs descartam sentinelas de message/detail/cause/código e propriedades privadas', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const sentinel = 'SENTINELA_PRIVADA_28';
    registrarFalha(Object.assign(new Error(sentinel, { cause: new Error(sentinel) }), {
      code: sentinel, detail: sentinel, senha: sentinel, senha_hash: sentinel, cpf: sentinel,
      body: sentinel, token: sentinel, DATABASE_URL: sentinel, observacoes_medicas: sentinel,
    }));
    registrarFalha({ code: '23505', message: sentinel, detail: sentinel });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(sentinel);
    expect(spy.mock.calls).toEqual([
      ['{"event":"request_failed"}'], ['{"event":"request_failed","code":"23505"}'],
    ]);
  } finally { spy.mockRestore(); }
});

test('JSON conta bytes, recompõe UTF-8 e rejeita stream interrompido', async () => {
  await expect(lerCorpoJson(asRequest('"' + 'á'.repeat(33000) + '"'))).rejects.toMatchObject({ codigo: 'CORPO_MUITO_GRANDE' });
  const utf8 = Buffer.from('{"nome":"açaí"}');
  const req = Readable.from([...utf8].map(byte => Buffer.from([byte]))) as IncomingMessage;
  expect(await lerCorpoJson(req)).toEqual({ nome: 'açaí' });
  const aborted = asRequest('{');
  Object.defineProperty(aborted, 'aborted', { value: true });
  await expect(lerCorpoJson(aborted)).rejects.toMatchObject({ codigo: 'CONEXAO_INTERROMPIDA' });
});

test('upload conserva 5 MiB e rejeita excesso de arquivo, campos e campo truncado', async () => {
  async function upload(form: FormData) {
    const request = new Request('http://fixture.invalid', { method: 'POST', body: form });
    const stream = asRequest(Buffer.from(await request.arrayBuffer()));
    stream.headers = { 'content-type': request.headers.get('content-type')! };
    return receberUpload(stream);
  }
  for (const size of [5 * 1024 * 1024, 5 * 1024 * 1024 + 1]) {
    const form = new FormData();
    form.set('arquivo', new Blob([new Uint8Array(size)], { type: 'application/pdf' }), 'fixture.pdf');
    if (size === 5 * 1024 * 1024) expect((await upload(form)).arquivo.conteudo.length).toBe(size);
    else await expect(upload(form)).rejects.toMatchObject({ codigo: 'CORPO_MUITO_GRANDE' });
  }
  const boundary = new FormData();
  boundary.set('arquivo', new Blob(['fixture'], { type: 'application/pdf' }), 'fixture.pdf');
  for (let i = 0; i < 10; i++) boundary.set('campo' + i, 'a'.repeat(4096));
  expect(Object.keys((await upload(boundary)).campos)).toHaveLength(10);
  await expect(receberUpload(asRequest(Buffer.alloc(5 * 1024 * 1024 + 64 * 1024 + 1))))
    .rejects.toMatchObject({ codigo: 'CORPO_MUITO_GRANDE' });
  for (const quantity of [1, 11]) {
    const form = new FormData();
    form.set('arquivo', new Blob(['fixture'], { type: 'application/pdf' }), 'fixture.pdf');
    for (let i = 0; i < quantity; i++) form.set('campo' + i, quantity === 1 ? 'a'.repeat(4097) : 'x');
    await expect(upload(form)).rejects.toMatchObject({ codigo: 'CORPO_MUITO_GRANDE' });
  }
});

test('limite de login tem capacidade fixa, expira e não adota forwarded headers', () => {
  let now = 0;
  const limit = criarLimiteLogin({ tentativas: 1, janelaMs: 1000, maxOrigens: 1 }, () => now);
  const response = { setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() } as unknown as ServerResponse;
  const request = (ip: string) => ({ socket: { remoteAddress: ip }, headers: {}, resume() {} }) as IncomingMessage;
  expect(limit(request('192.0.2.1'), response)).toBe(true);
  expect(limit(request('192.0.2.1'), response)).toBe(false);
  expect(limit(request('192.0.2.2'), response)).toBe(false);
  now = 1000;
  expect(limit(request('192.0.2.2'), response)).toBe(true);
});
