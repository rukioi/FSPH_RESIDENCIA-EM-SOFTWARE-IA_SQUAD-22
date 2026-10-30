import './session-fixture.js';

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
  listarDocumentos,
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
    .setSubject(({ ADM: '-27001', ADMINISTRADOR: '-27001', GESTOR_FROTA: '-27002', SOLICITANTE: '-27003', MOTORISTA: '-27004', ATENDENTE_SVO: '-27005' } as Record<string, string>)[perfil] ?? '-29999')
    .setIssuedAt()
    .setExpirationTime('1h')
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
  // A consulta de veículos acontece antes da consulta de motoristas.
  consultaSimulada
    .mockResolvedValueOnce([
      {
        id: 2,
        veiculo_id: 10,
        tipo_documento: 'CRLV',
        data_vencimento: '2028-11-10',
        status_regular: true,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 1,
        nome: 'Motorista Teste',
        cnh: '12345678900',
        validade_cnh: '2028-05-18',
      },
    ]);

  const { res, writeHead, end } = respostaSimulada();

  await listarDocumentos(res);

  expect(writeHead).toHaveBeenCalledWith(
    200,
    expect.any(Object),
  );

  const resposta = JSON.parse(String(end.mock.calls[0][0]));

  expect(resposta.data).toHaveLength(2);

  expect(resposta.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        tipo: 'DOCUMENTO_VEICULO',
        descricao: 'CRLV',
        status: 'REGULAR',
      }),
      expect.objectContaining({
        tipo: 'CNH_MOTORISTA',
        descricao: 'CNH de Motorista Teste',
        status: 'REGULAR',
      }),
    ]),
  );

  expect(consultaSimulada).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 classifica os quatro status dos documentos', async () => {
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);

  function dataRelativa(dias: number): string {
    const data = new Date(hoje);
    data.setDate(data.getDate() + dias);

    return [
      data.getFullYear(),
      String(data.getMonth() + 1).padStart(2, '0'),
      String(data.getDate()).padStart(2, '0'),
    ].join('-');
  }

  consultaSimulada
    .mockResolvedValueOnce([
      {
        id: 101,
        veiculo_id: 10,
        tipo_documento: 'Documento vencido',
        data_vencimento: dataRelativa(-5),
      },
      {
        id: 102,
        veiculo_id: 10,
        tipo_documento: 'Documento próximo',
        data_vencimento: dataRelativa(15),
      },
      {
        id: 103,
        veiculo_id: 10,
        tipo_documento: 'Documento regular',
        data_vencimento: dataRelativa(60),
      },
      {
        id: 104,
        veiculo_id: 10,
        tipo_documento: 'Documento sem validade',
        data_vencimento: null,
      },
    ])
    .mockResolvedValueOnce([]);

  const { res, writeHead, end } = respostaSimulada();

  await listarDocumentos(res);

  expect(writeHead).toHaveBeenCalledWith(
    200,
    expect.any(Object),
  );

  const resposta = JSON.parse(String(end.mock.calls[0][0]));

  expect(resposta.data).toHaveLength(4);

  expect(resposta.data).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        tipo: 'DOCUMENTO_VEICULO',
        descricao: 'Documento vencido',
        status: 'VENCIDA',
      }),
      expect.objectContaining({
        tipo: 'DOCUMENTO_VEICULO',
        descricao: 'Documento próximo',
        status: 'PROXIMA_DO_VENCIMENTO',
      }),
      expect.objectContaining({
        tipo: 'DOCUMENTO_VEICULO',
        descricao: 'Documento regular',
        status: 'REGULAR',
      }),
      expect.objectContaining({
        tipo: 'DOCUMENTO_VEICULO',
        descricao: 'Documento sem validade',
        status: 'SEM_VALIDADE',
      }),
    ]),
  );

  expect(consultaSimulada).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 recebe PDF por multipart e prepara cadastro no banco', async () => {
  const pdf = Buffer.from('%PDF-1.4\narquivo de teste');

  const formulario = new FormData();
  formulario.append('veiculo_id', '10');
  formulario.append('tipo_documento', 'CRLV');
  formulario.append('data_vencimento', '2028-12-31');
  formulario.append(
    'arquivo',
    new Blob([pdf], { type: 'application/pdf' }),
    'documento.pdf',
  );

  const requisicaoHttp = new Request('http://localhost/api/documentos', {
    method: 'POST',
    body: formulario,
  });

  const conteudo = Buffer.from(await requisicaoHttp.arrayBuffer());

  const req = Readable.from([conteudo]) as IncomingMessage;
  req.headers = {
    'content-type': requisicaoHttp.headers.get('content-type') ?? '',
  };

  consultaSimulada.mockResolvedValueOnce([
    {
      id: 25,
      veiculo_id: 10,
      tipo_documento: 'CRLV',
      arquivo_nome: 'documento.pdf',
    },
  ]);

  const { res, writeHead, end } = respostaSimulada();

  await criarDocumento(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('documento.pdf'),
  );

  expect(consultaSimulada).toHaveBeenCalledTimes(1);

  const parametros = consultaSimulada.mock.calls[0]?.slice(1) ?? [];

  expect(parametros).toContain('documento.pdf');
  expect(parametros).toContain('application/pdf');
  expect(parametros).toContain(`\\x${pdf.toString('hex')}`);
});
test('BE-S6-02 rejeita JSON maior que 1 MB', async () => {
  const req = Readable.from([
    JSON.stringify({
      veiculo_id: 10,
      tipo_documento: 'A'.repeat(1024 * 1024),
      data_vencimento: '2028-12-31',
    }),
  ]) as IncomingMessage;

  const { res, writeHead, end } = respostaSimulada();

  await criarDocumento(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    413,
    expect.any(Object),
  );

  expect(JSON.parse(String(end.mock.calls[0][0]))).toEqual({
    error: {
      code: 'CORPO_MUITO_GRANDE',
      message: 'O JSON deve ter no máximo 1 MB.',
    },
  });

  expect(consultaSimulada).not.toHaveBeenCalled();
});