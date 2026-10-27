import { beforeEach, expect, test, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

vi.mock('../../src/config/db.js', () => ({
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