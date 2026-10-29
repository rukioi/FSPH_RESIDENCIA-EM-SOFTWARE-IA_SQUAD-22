
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { SignJWT } from 'jose';
import { afterEach, expect, test, vi } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  sql: vi.fn(),
}));

vi.mock('../../src/database/connection.js', () => ({
  sql: vi.fn(),
}));

import { sql } from '../../src/config/db.js';
import { createApp } from '../../src/app.js';
import {
  criarDocumento,
  buscarPendenciasDocumentos,
} from '../../src/modules/documentos/documentos.controller.js';

const consultaSimulada = sql as unknown as ReturnType<typeof vi.fn>;
const segredoTeste = 'segredo-ficticio-exclusivo-para-testes';
const segredoOriginal = process.env.JWT_SECRET;

afterEach(() => {
  consultaSimulada.mockReset();

  if (segredoOriginal === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = segredoOriginal;
  }
});

function respostaSimulada() {
  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  return { res, writeHead, end };
}

async function criarTokenTeste(perfil: string): Promise<string> {
  process.env.JWT_SECRET = segredoTeste;

  return new SignJWT({ perfil })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('usuario-teste')
    .sign(new TextEncoder().encode(segredoTeste));
}

async function executarRequisicaoHttp(
  perfil?: string,
): Promise<{ status: number; corpo: unknown }> {
  const server = createApp();

  try {
    const token = perfil
      ? await criarTokenTeste(perfil)
      : undefined;

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const endereco = server.address() as AddressInfo;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const resposta = await fetch(
      `http://127.0.0.1:${endereco.port}/api/documentos`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tipo_documento: 'CRLV',
        }),
      },
    );

    return {
      status: resposta.status,
      corpo: await resposta.json(),
    };
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((erro) => {
          if (erro) reject(erro);
          else resolve();
        });
      });
    }
  }
}

test('BE-S6-02 rejeita documento sem campos obrigatórios', async () => {
  const req = Readable.from([
    JSON.stringify({
      tipo_documento: 'CRLV',
    }),
  ]) as IncomingMessage;

  const { res, writeHead, end } = respostaSimulada();

  await criarDocumento(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('DADOS_INVALIDOS'),
  );

  expect(consultaSimulada).not.toHaveBeenCalled();
});

test('BE-S6-02 cadastra documento válido com status 201', async () => {
  consultaSimulada.mockResolvedValueOnce([
    {
      id: 1,
      veiculo_id: 10,
      tipo_documento: 'CRLV',
      data_vencimento: '2027-10-28',
      status_regular: true,
    },
  ]);

  const req = Readable.from([
    JSON.stringify({
      veiculo_id: 10,
      tipo_documento: 'CRLV',
      data_vencimento: '2027-10-28',
    }),
  ]) as IncomingMessage;

  const { res, writeHead, end } = respostaSimulada();

  await criarDocumento(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(JSON.parse(String(end.mock.calls[0][0]))).toEqual({
    data: {
      id: 1,
      veiculo_id: 10,
      tipo_documento: 'CRLV',
      data_vencimento: '2027-10-28',
      status_regular: true,
    },
  });

  expect(consultaSimulada).toHaveBeenCalledTimes(1);
});

test('BE-S6-02 retorna pendências de CNH e documentos de veículos', async () => {
  consultaSimulada
    .mockResolvedValueOnce([
      {
        id: 1,
        nome: 'Motorista Teste',
        cnh: '12345678900',
        validade_cnh: '2026-10-20',
        dias_restantes: -8,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 2,
        veiculo_id: 10,
        tipo_documento: 'CRLV',
        data_vencimento: '2026-11-10',
        dias_restantes: 13,
      },
    ]);

  const { res, writeHead, end } = respostaSimulada();

  await buscarPendenciasDocumentos(res);

  expect(writeHead).toHaveBeenCalledWith(
    200,
    expect.any(Object),
  );

  const resposta = JSON.parse(String(end.mock.calls[0][0]));

  expect(resposta.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        tipo: 'CNH_MOTORISTA',
        status: 'VENCIDA',
        dias_restantes: -8,
      }),
      expect.objectContaining({
        tipo: 'DOCUMENTO_VEICULO',
        status: 'PROXIMA_DO_VENCIMENTO',
        dias_restantes: 13,
      }),
    ]),
  );

  expect(consultaSimulada).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 POST /api/documentos exige autenticação', async () => {
  const resposta = await executarRequisicaoHttp();

  expect(resposta.status).toBe(401);

  expect(resposta.corpo).toEqual({
    error: {
      code: 'NAO_AUTENTICADO',
      message: 'Autenticação necessária.',
    },
  });

  expect(consultaSimulada).not.toHaveBeenCalled();
});

test('BE-S6-02 impede Atendente SVO de cadastrar documentos', async () => {
  const resposta = await executarRequisicaoHttp('ATENDENTE_SVO');

  expect(resposta.status).toBe(403);

  expect(resposta.corpo).toEqual({
    error: {
      code: 'ACESSO_NEGADO',
      message: 'Acesso não permitido.',
    },
  });

  expect(consultaSimulada).not.toHaveBeenCalled();
});

test('BE-S6-02 permite Administrador acessar cadastro de documentos', async () => {
  const resposta = await executarRequisicaoHttp('ADMINISTRADOR');

  // O administrador passa pela autorização.
  // Como o documento está incompleto, recebe 400.
  expect(resposta.status).toBe(400);

  expect(resposta.corpo).toEqual({
    error: {
      code: 'DADOS_INVALIDOS',
      message: 'Informe veiculo_id, tipo_documento e data_vencimento válidos.',
    },
  });

  expect(consultaSimulada).not.toHaveBeenCalled();
});

test('BE-S6-02 permite Gestor de Frota acessar cadastro de documentos', async () => {
  const resposta = await executarRequisicaoHttp('GESTOR_FROTA');

  // O gestor passa pela autorização.
  // Como o documento está incompleto, recebe 400.
  expect(resposta.status).toBe(400);

  expect(resposta.corpo).toEqual({
    error: {
      code: 'DADOS_INVALIDOS',
      message: 'Informe veiculo_id, tipo_documento e data_vencimento válidos.',
    },
  });

  expect(consultaSimulada).not.toHaveBeenCalled();
});
test('BE-S6-02 lista todos os documentos, incluindo os regulares', async () => {
  consultaSimulada
    .mockResolvedValueOnce([
      {
        id: 1,
        nome: 'Motorista Teste',
        cnh: '12345678900',
        validade_cnh: '2028-05-18',
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 2,
        veiculo_id: 10,
        tipo_documento: 'CRLV',
        data_vencimento: '2028-11-10',
        status_regular: true,
      },
    ]);

  const { res, writeHead, end } = respostaSimulada();

  const { listarDocumentos } = await import(
    '../../src/modules/documentos/documentos.controller.js'
  );

  await listarDocumentos(res);

  expect(writeHead).toHaveBeenCalledWith(200, expect.any(Object));

  const resposta = JSON.parse(String(end.mock.calls[0][0]));

  expect(resposta.data).toHaveLength(2);
  expect(consultaSimulada).toHaveBeenCalledTimes(2);
});