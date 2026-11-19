import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { Readable } from 'node:stream';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';

// Parser, perfis e transporte reais; não é prova de FK, persistência ou rollback PostgreSQL.
const bancoProibido = vi.hoisted(() => vi.fn(() => { throw new Error('Banco proibido nesta suíte unitária.'); }));
vi.mock('../../src/database/connection.js', () => ({ sql: bancoProibido }));
import { lerAnexo, enviarArquivo } from '../../src/modules/anexos/anexos.service.js';
import { conferirPerfilRegistro } from '../../src/modules/anexos/registros.acesso.js';
import { createApp } from '../../src/app.js';

const vinculo = { tipoRegistro: 'ABASTECIMENTO', registroId: '42' } as const;
const arquivos = [
  { tipo: 'application/pdf', nome: 'comprovante.pdf', conteudo: Buffer.from('%PDF-1.7 fixture') },
  { tipo: 'image/jpeg', nome: 'comprovante.jpg', conteudo: Buffer.from('ffd8ff01', 'hex') },
  { tipo: 'image/png', nome: 'comprovante.png', conteudo: Buffer.from('89504e470d0a1a0a01', 'hex') },
];
async function requisicao(arquivo = arquivos[0], campoExtra?: string) {
  const form = new FormData();
  form.append('arquivo', new Blob([new Uint8Array(arquivo.conteudo)], { type: arquivo.tipo }), arquivo.nome);
  if (campoExtra) form.append(campoExtra, '999');
  // O próprio runtime cria boundary/corpo; nenhum fetch ou upload remoto é executado.
  const request = new Request('http://fixture.invalid', { method: 'POST', body: form });
  const req = Readable.from([Buffer.from(await request.arrayBuffer())]) as IncomingMessage;
  req.headers = { 'content-type': request.headers.get('content-type')! };
  return req;
}
afterEach(() => expect(bancoProibido).not.toHaveBeenCalled());

test.each(arquivos)('parser aceita $tipo e conserva bytes e vínculo do caminho', async arquivo => {
  expect(await lerAnexo(await requisicao(arquivo), vinculo)).toEqual({ vinculo, arquivo });
});

test('campo de vínculo no formulário não substitui o caminho e recebe 400', async () => {
  await expect(lerAnexo(await requisicao(arquivos[0], 'registroId'), vinculo)).rejects.toMatchObject({ status: 400 });
});

test.each(['../comprovante.pdf', '..\\comprovante.pdf'])('nome com caminho é rejeitado: %s', async nome => {
  await expect(lerAnexo(await requisicao({ ...arquivos[0], nome }), vinculo)).rejects.toMatchObject({ status: 400 });
});

test.each([
  { ...arquivos[0], tipo: 'text/plain' },
  { ...arquivos[0], conteudo: Buffer.from('conteudo falsificado') },
])('MIME ou assinatura inválidos recebem 415', async arquivo => {
  await expect(lerAnexo(await requisicao(arquivo), vinculo)).rejects.toMatchObject({ status: 415 });
});

test('multipart sem boundary recebe 400', async () => {
  const req = await requisicao(); req.headers['content-type'] = 'multipart/form-data';
  await expect(lerAnexo(req, vinculo)).rejects.toMatchObject({ status: 400 });
});

test('JSON em vez de multipart recebe 415', async () => {
  const req = Readable.from(['{}']) as IncomingMessage; req.headers = { 'content-type': 'application/json' };
  await expect(lerAnexo(req, vinculo)).rejects.toMatchObject({ status: 415 });
});

test('ID inválido do caminho recebe 404 sem consulta', async () => {
  await expect(lerAnexo(await requisicao(), { ...vinculo, registroId: '0' })).rejects.toMatchObject({ status: 404 });
});

test('limite exato de 5 MiB conserva todos os bytes', async () => {
  const conteudo = Buffer.alloc(5242880, 1); arquivos[0].conteudo.copy(conteudo);
  const result = await lerAnexo(await requisicao({ ...arquivos[0], conteudo }), vinculo);
  expect(result.arquivo.conteudo.length).toBe(5242880);
  expect(result.arquivo.conteudo.equals(conteudo)).toBe(true);
});

test('um byte acima de 5 MiB é rejeitado como corpo grande, mapeado para HTTP 413', async () => {
  const conteudo = Buffer.alloc(5242881, 1); arquivos[0].conteudo.copy(conteudo);
  await expect(lerAnexo(await requisicao({ ...arquivos[0], conteudo }), vinculo))
    .rejects.toMatchObject({ codigo: 'CORPO_MUITO_GRANDE' });
});

test.each(['MOTORISTA', 'ATENDENTE_SVO', 'SOLICITANTE_INTERNO'] as const)('perfil %s não acessa comprovante de abastecimento', perfil => {
  expect(() => conferirPerfilRegistro({ id: '1', perfil }, 'ABASTECIMENTO')).toThrow(expect.objectContaining({ status: 403 }));
});
test.each(['ADM', 'GESTOR_FROTA'] as const)('perfil %s é elegível sem dispensar autorização do recurso no banco', perfil => {
  expect(() => conferirPerfilRegistro({ id: '1', perfil }, 'ABASTECIMENTO')).not.toThrow();
});

const app = createApp();
const stream = createServer((req, res) => {
  const arquivo = arquivos[Number(req.url?.slice(1))];
  void enviarArquivo(res, { tipo: arquivo.tipo, dados: arquivo.conteudo });
});
let origem: string, origemStream: string;
beforeAll(async () => {
  for (const server of [app, stream]) await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origem = 'http://127.0.0.1:' + (app.address() as AddressInfo).port;
  origemStream = 'http://127.0.0.1:' + (stream.address() as AddressInfo).port;
});
afterAll(async () => {
  for (const server of [app, stream]) await new Promise<void>(resolve => server.close(() => resolve()));
});

test.each(['GET', 'POST'])('%s de comprovante sem token recebe 401 real antes de SQL', async method => {
  const response = await fetch(origem + '/api/abastecimentos/42/comprovante', { method });
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ error: { code: 'NAO_AUTENTICADO' } });
});

test.each(arquivos.map((arquivo, indice) => ({ ...arquivo, indice })))('stream $tipo conserva bytes e headers privados', async arquivo => {
  const response = await fetch(origemStream + '/' + arquivo.indice);
  expect(response.headers.get('content-type')).toBe(arquivo.tipo);
  expect(response.headers.get('content-length')).toBe(String(arquivo.conteudo.length));
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(arquivo.conteudo);
});
