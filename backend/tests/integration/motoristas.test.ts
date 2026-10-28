import { beforeEach, expect, test, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { AddressInfo } from 'node:net';
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
  criarMotorista,
  atualizarMotorista,
} from '../../src/modules/motoristas/motoristas.controller.js';

beforeEach(() => {
  vi.resetAllMocks();
});

test('BE-S6-02 rejeita categoria de CNH inválida sem consultar o banco', async () => {
  const corpo = JSON.stringify({
    nome: 'Motorista Teste',
    cnh: '12345678900',
    categoria_cnh: 'Z',
    validade_cnh: '2028-12-31',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.objectContaining({
      'Content-Type': 'application/json; charset=utf-8',
    }),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('CATEGORIA_CNH_INVALIDA'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 rejeita status inválido sem consultar o banco', async () => {
  const corpo = JSON.stringify({
    nome: 'Motorista Teste',
    cnh: '12345678900',
    categoria_cnh: 'D',
    validade_cnh: '2028-12-31',
    status: 'INATIVO',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('STATUS_INVALIDO'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 rejeita CNH duplicada', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado.mockResolvedValueOnce([{ id: 10 }]);

  const corpo = JSON.stringify({
    nome: 'Motorista Teste',
    cnh: '12345678900',
    categoria_cnh: 'D',
    validade_cnh: '2028-12-31',
    status: 'DISPONIVEL',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    409,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('CNH_DUPLICADA'),
  );

  expect(sql).toHaveBeenCalledTimes(1);
});

test('BE-S6-02 cadastra motorista válido com status 201', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 15,
        nome: 'Motorista Teste',
        cnh: '98765432100',
        categoria_cnh: 'D',
        validade_cnh: '2028-12-31',
        status: 'DISPONIVEL',
      },
    ]);

  const corpo = JSON.stringify({
    nome: 'Motorista Teste',
    cnh: '98765432100',
    categoria_cnh: 'D',
    validade_cnh: '2028-12-31',
    status: 'DISPONIVEL',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"id":15'),
  );

  expect(sql).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 rejeita categoria inválida ao atualizar motorista', async () => {
  const corpo = JSON.stringify({
    categoria_cnh: 'Z',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await atualizarMotorista(req, res, '15');

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('CATEGORIA_CNH_INVALIDA'),
  );

  expect(sql).not.toHaveBeenCalled();
});
test('BE-S6-02 rejeita status inválido ao atualizar motorista', async () => {
  const corpo = JSON.stringify({
    status: 'INATIVO',
  });

  const req = Readable.from([corpo]) as IncomingMessage;

  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  await atualizarMotorista(req, res, '15');

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('STATUS_INVALIDO'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 POST /api/motoristas exige autenticação', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;
  const server = createApp();

  try {
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const endereco = server.address() as AddressInfo;

    const resposta = await fetch(
      `http://127.0.0.1:${endereco.port}/api/motoristas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nome: 'Motorista Teste',
          cnh: '12345678900',
          categoria_cnh: 'D',
          validade_cnh: '2028-12-31',
          status: 'DISPONIVEL',
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

    expect(bancoSimulado).not.toHaveBeenCalled();
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

test('BE-S6-02 impede Atendente SVO de cadastrar motoristas', async () => {
  const segredoAnterior = process.env.JWT_SECRET;
  const segredoTeste = 'segredo-ficticio-exclusivo-para-testes';
  process.env.JWT_SECRET = segredoTeste;

  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;
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
      `http://127.0.0.1:${endereco.port}/api/motoristas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: 'Motorista Teste',
          cnh: '12345678900',
          categoria_cnh: 'D',
          validade_cnh: '2028-12-31',
          status: 'DISPONIVEL',
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

    expect(bancoSimulado).not.toHaveBeenCalled();
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
