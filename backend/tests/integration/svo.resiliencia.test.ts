import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo, Server } from 'node:net';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SignJWT } from 'jose';

vi.mock('../../src/modules/svo/svo.repository.js', () => ({
  listarOrdensPendentes: vi.fn(),
  criarSolicitacao: vi.fn(),
  despacharOrdem: vi.fn(),
}));

import { createApp, isolarFalhaDaRequisicao } from '../../src/app.js';
import {
  ErroCorpoRequisicao,
  lerCorpoJson,
} from '../../src/modules/svo/svo.controller.js';
import {
  criarSolicitacao,
  despacharOrdem,
} from '../../src/modules/svo/svo.repository.js';

const segredo = 'segredo-ficticio-exclusivo-para-testes';
const segredoAnterior = process.env.JWT_SECRET;
const rejeicoes: unknown[] = [];

function registrarRejeicao(erro: unknown) {
  rejeicoes.push(erro);
}

let server: Server;
let baseUrl: string;
let porta: number;

beforeAll(async () => {
  process.env.JWT_SECRET = segredo;
  process.on('unhandledRejection', registrarRejeicao);
  server = createApp();

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  porta = address.port;
  baseUrl = `http://127.0.0.1:${porta}`;
});

afterAll(async () => {
  process.off('unhandledRejection', registrarRejeicao);

  if (segredoAnterior === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = segredoAnterior;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

async function criarToken(perfil: string) {
  return new SignJWT({ perfil })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('1')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(segredo));
}

function requisicao(
  partes: unknown[],
  opcoes: { destroyed?: boolean; falha?: Error } = {},
): IncomingMessage {
  return {
    destroyed: opcoes.destroyed ?? false,
    on() {
      return this;
    },
    async *[Symbol.asyncIterator]() {
      for (const parte of partes) {
        yield parte;
      }

      if (opcoes.falha) {
        throw opcoes.falha;
      }
    },
  } as unknown as IncomingMessage;
}

function respostaFalsa() {
  return {
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    status: 0,
    body: '',
    writeHead(status: number) {
      this.status = status;
    },
    end(body?: string) {
      this.body = body ?? '';
      this.writableEnded = true;
    },
  };
}

test('corpo acima de 64 KB é recusado antes de acumular o excedente', async () => {
  const excedente = Buffer.alloc(64 * 1024 + 1, 0x61);

  await expect(lerCorpoJson(requisicao([excedente]))).rejects.toMatchObject({
    codigo: 'CORPO_MUITO_GRANDE',
  });
});

test('bytes UTF-8 divididos entre partes formam o JSON original', async () => {
  const corpo = Buffer.from('{"localFalecimento":"açaí"}', 'utf8');
  const indice = corpo.indexOf(0xc3);
  const dados = await lerCorpoJson(requisicao([
    corpo.subarray(0, indice + 1),
    corpo.subarray(indice + 1),
  ]));

  expect(dados).toEqual({ localFalecimento: 'açaí' });
});

test('stream interrompido vira erro de conexão e não rejeição solta', async () => {
  const falha = Object.assign(new Error('reset'), { code: 'ECONNRESET' });

  await expect(lerCorpoJson(requisicao(
    [Buffer.from('{"a":')],
    { destroyed: true, falha },
  ))).rejects.toBeInstanceOf(ErroCorpoRequisicao);

  await expect(lerCorpoJson(requisicao(
    [Buffer.from('{"a":')],
    { destroyed: true, falha },
  ))).rejects.toMatchObject({ codigo: 'CONEXAO_INTERROMPIDA' });
});

test('erro assíncrono de leitura fora de aborto fica classificado', async () => {
  await expect(lerCorpoJson(requisicao(
    [],
    { falha: new Error('leitura') },
  ))).rejects.toMatchObject({ codigo: 'ERRO_LEITURA' });
});

test('rejeição assíncrona da rota vira 500 e não escapa', async () => {
  const response = respostaFalsa();

  isolarFalhaDaRequisicao(
    response as unknown as ServerResponse,
    Promise.reject(new Error('falha assíncrona')),
  );

  await new Promise((resolve) => setImmediate(resolve));

  expect(response.status).toBe(500);
  expect(response.body).toContain('ERRO_INTERNO');
  expect(rejeicoes).toEqual([]);
});

test('POST sem token continua 401', async () => {
  const response = await fetch(`${baseUrl}/api/svo/solicitacoes`, { method: 'POST' });
  expect(response.status).toBe(401);
});

test('perfil diferente de ATENDENTE_SVO recebe 403', async () => {
  const token = await criarToken('GESTOR_FROTA');
  const response = await fetch(`${baseUrl}/api/svo/solicitacoes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: '{}',
  });

  expect(response.status).toBe(403);
});

test('payload excessivo autenticado responde 413 e o processo segue', async () => {
  const token = await criarToken('ATENDENTE_SVO');
  const corpo = `{"localFalecimento":"${'a'.repeat(70_000)}","enderecoRemocao":"Rua","solicitanteNome":"Ana"}`;
  const response = await fetch(`${baseUrl}/api/svo/solicitacoes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: corpo,
  });

  expect(response.status).toBe(413);
  expect(vi.mocked(criarSolicitacao)).not.toHaveBeenCalled();

  const seguinte = await fetch(`${baseUrl}/api/svo/solicitacoes`, { method: 'POST' });
  expect(seguinte.status).toBe(401);
  expect(rejeicoes).toEqual([]);
});

test('JSON inválido autenticado responde 400', async () => {
  const token = await criarToken('ATENDENTE_SVO');
  const response = await fetch(`${baseUrl}/api/svo/solicitacoes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{',
  });

  expect(response.status).toBe(400);
});

test('falha assíncrona ao criar solicitação responde 500 e a rota seguinte vive', async () => {
  vi.mocked(criarSolicitacao).mockRejectedValueOnce(new Error('falha assíncrona'));
  const token = await criarToken('ATENDENTE_SVO');
  const response = await fetch(`${baseUrl}/api/svo/solicitacoes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      localFalecimento: 'Hospital',
      enderecoRemocao: 'Rua 1',
      solicitanteNome: 'Ana',
    }),
  });

  expect(response.status).toBe(500);

  const seguinte = await fetch(`${baseUrl}/api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO`);
  expect(seguinte.status).toBe(401);
  expect(rejeicoes).toEqual([]);
});

test('conexão interrompida não derruba o servidor', async () => {
  const token = await criarToken('ATENDENTE_SVO');

  await new Promise<void>((resolve) => {
    const requisicaoHttp = http.request({
      hostname: '127.0.0.1',
      port: porta,
      method: 'POST',
      path: '/api/svo/solicitacoes',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': '1000',
      },
    });

    requisicaoHttp.on('error', () => resolve());
    requisicaoHttp.on('response', () => resolve());
    requisicaoHttp.write('{"localFalecimento":');
    requisicaoHttp.destroy();
  });

  await new Promise((resolve) => setTimeout(resolve, 50));

  const seguinte = await fetch(`${baseUrl}/api/svo/solicitacoes`, { method: 'POST' });
  expect(seguinte.status).toBe(401);
  expect(rejeicoes).toEqual([]);
});

test('despacho mapeia ordem indisponível, referência e conflito', async () => {
  const token = await criarToken('ATENDENTE_SVO');
  const casos = [
    { tipo: 'ordem_indisponivel', status: 404 },
    { tipo: 'referencia_inexistente', status: 404 },
    { tipo: 'recurso_inelegivel', status: 409 },
    { tipo: 'conflito_alocacao', status: 409 },
    {
      tipo: 'despachada',
      status: 200,
      ordem: {
        id: 1,
        motorista_id: 2,
        veiculo_id: 3,
        status: 'EM_DESLOCAMENTO',
      },
    },
  ] as const;

  for (const caso of casos) {
    vi.mocked(despacharOrdem).mockResolvedValueOnce(
      caso.tipo === 'despachada'
        ? { tipo: 'despachada', ordem: caso.ordem }
        : { tipo: caso.tipo },
    );

    const response = await fetch(`${baseUrl}/api/svo/ordens-coleta/1/despachar`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ motoristaId: 2, veiculoId: 3 }),
    });

    expect(response.status).toBe(caso.status);
  }

  expect(rejeicoes).toEqual([]);
});
