
import { beforeEach, expect, test, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { SignJWT } from 'jose';
import { createApp } from '../../src/app.js';

vi.mock('../../src/config/db.js', () => ({
  sql: vi.fn(),
}));

vi.mock('../../src/database/connection.js', () => ({
  sql: vi.fn(),
}));

import { sql } from '../../src/config/db.js';
import {
  criarVeiculo,
  atualizarVeiculo,
} from '../../src/modules/veiculos/veiculos.controller.js';

beforeEach(() => {
  vi.resetAllMocks();
});

test('BE-S6-02 rejeita veículo sem placa sem consultar o banco', async () => {
  const corpo = JSON.stringify({
    modelo: 'Gol',
    marca: 'Volkswagen',
    ano: 2020,
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('DADOS_INVALIDOS'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 rejeita placa duplicada', async () => {
  const bancoMock = sql as unknown as ReturnType<typeof vi.fn>;

  bancoMock.mockResolvedValueOnce([{ id: 10 }]);

  const corpo = JSON.stringify({
    placa: 'ABC1D23',
    modelo: 'Gol',
    marca: 'Volkswagen',
    ano: 2020,
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    409,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('PLACA_DUPLICADA'),
  );

  expect(sql).toHaveBeenCalledTimes(1);
});

test('BE-S6-02 cadastra veículo válido com status 201', async () => {
  const bancoMock = sql as unknown as ReturnType<typeof vi.fn>;

  bancoMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 20,
        placa: 'ABC1D23',
        modelo: 'Gol',
        marca: 'Volkswagen',
        ano: 2020,
        tipo: 'PASSEIO',
        status: 'DISPONIVEL',
      },
    ]);

  const corpo = JSON.stringify({
    placa: 'ABC1D23',
    modelo: 'Gol',
    marca: 'Volkswagen',
    ano: 2020,
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"id":20'),
  );

  expect(sql).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 rejeita tipo de veículo inválido sem consultar o banco', async () => {
  const corpo = JSON.stringify({
    placa: 'ABC1D23',
    modelo: 'Gol',
    marca: 'Volkswagen',
    ano: 2020,
    tipo: 'CAMINHAO',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('TIPO_INVALIDO'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 rejeita status de veículo inválido sem consultar o banco', async () => {
  const corpo = JSON.stringify({
    placa: 'ABC1D23',
    modelo: 'Gol',
    marca: 'Volkswagen',
    ano: 2020,
    status: 'FOLGA',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('STATUS_INVALIDO'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 rejeita status inválido ao atualizar veículo', async () => {
  const corpo = JSON.stringify({
    status: 'FOLGA',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await atualizarVeiculo(req, res, '10');

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('STATUS_INVALIDO'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 POST /api/veiculos exige autenticação', async () => {
  const bancoMock = sql as unknown as ReturnType<typeof vi.fn>;
  const server = createApp();

  try {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const endereco = server.address() as AddressInfo;

    const resposta = await fetch(
      `http://127.0.0.1:${endereco.port}/api/veiculos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placa: 'ABC1D23',
          modelo: 'Gol',
          marca: 'Volkswagen',
          ano: 2020,
        }),
      },
    );

    expect(resposta.status).toBe(401);

    expect(await resposta.json()).toEqual({
      error: {
        code: 'NAO_AUTENTICADO',
        message: 'Autenticação necessária.',
      },
    });

    expect(bancoMock).not.toHaveBeenCalled();
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
});

test('BE-S6-02 impede Atendente SVO de cadastrar veículos', async () => {
  const segredoAnterior = process.env.JWT_SECRET;
  const segredoTeste = 'segredo-ficticio-exclusivo-para-testes';

  process.env.JWT_SECRET = segredoTeste;

  const bancoMock = sql as unknown as ReturnType<typeof vi.fn>;
  const server = createApp();

  try {
    const token = await new SignJWT({
      perfil: 'ATENDENTE_SVO',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('atendente-teste')
      .sign(new TextEncoder().encode(segredoTeste));

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const endereco = server.address() as AddressInfo;

    const resposta = await fetch(
      `http://127.0.0.1:${endereco.port}/api/veiculos`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          placa: 'ABC1D23',
          modelo: 'Gol',
          marca: 'Volkswagen',
          ano: 2020,
        }),
      },
    );

    expect(resposta.status).toBe(403);

    expect(await resposta.json()).toEqual({
      error: {
        code: 'ACESSO_NEGADO',
        message: 'Acesso não permitido.',
      },
    });

    expect(bancoMock).not.toHaveBeenCalled();
  } finally {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((erro) => {
          if (erro) reject(erro);
          else resolve();
        });
      });
    }

    if (segredoAnterior === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = segredoAnterior;
    }
  }
});
