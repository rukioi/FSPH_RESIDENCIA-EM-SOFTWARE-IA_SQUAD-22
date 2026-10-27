import { beforeEach, expect, test, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

vi.mock('../../src/config/db.js', () => ({
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