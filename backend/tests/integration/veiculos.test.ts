import './session-fixture.js';

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

const bancoMock = sql as unknown as ReturnType<typeof vi.fn>;

function dadosVeiculo() {
  return {
    placa: 'ABC1D23',
    modelo: 'Gol',
    marca: 'Volkswagen',
    ano: 2020,
  };
}

function criarRequisicao(dados: Record<string, unknown>): IncomingMessage {
  return Readable.from([JSON.stringify(dados)]) as IncomingMessage;
}

function criarResposta() {
  const writeHead = vi.fn();
  const end = vi.fn();

  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;

  return { res, writeHead, end };
}

test('BE-S6-02 rejeita veículo sem placa sem consultar o banco', async () => {
  const req = criarRequisicao({
    modelo: 'Gol',
    marca: 'Volkswagen',
    ano: 2020,
  });

  const { res, writeHead, end } = criarResposta();

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
  bancoMock.mockResolvedValueOnce([{ id: 10 }]);

  const req = criarRequisicao(dadosVeiculo());
  const { res, writeHead, end } = criarResposta();

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
  bancoMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 20,
        ...dadosVeiculo(),
        tipo: 'PASSEIO',
        status: 'DISPONIVEL',
      },
    ]);

  const req = criarRequisicao(dadosVeiculo());
  const { res, writeHead, end } = criarResposta();

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
  const req = criarRequisicao({
    ...dadosVeiculo(),
    tipo: 'CAMINHAO',
  });

  const { res, writeHead, end } = criarResposta();

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
  const req = criarRequisicao({
    ...dadosVeiculo(),
    status: 'FOLGA',
  });

  const { res, writeHead, end } = criarResposta();

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
  const req = criarRequisicao({
    status: 'FOLGA',
  });

  const { res, writeHead, end } = criarResposta();

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
        body: JSON.stringify(dadosVeiculo()),
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

  const server = createApp();

  try {
    const token = await new SignJWT({
      perfil: 'ATENDENTE_SVO',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('-27005')
    .setIssuedAt()
    .setExpirationTime('1h')
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
        body: JSON.stringify(dadosVeiculo()),
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

// Novos testes: capacidade de passageiros

test('BE-S6-02 rejeita capacidade de passageiros zero', async () => {
  const req = criarRequisicao({
    ...dadosVeiculo(),
    capacidade_passageiros: 0,
  });

  const { res, writeHead, end } = criarResposta();

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

test('BE-S6-02 rejeita capacidade de passageiros decimal', async () => {
  const req = criarRequisicao({
    ...dadosVeiculo(),
    capacidade_passageiros: 2.5,
  });

  const { res, writeHead, end } = criarResposta();

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

test('BE-S6-02 cadastra veículo com capacidade de passageiros informada', async () => {
  bancoMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 21,
        ...dadosVeiculo(),
        capacidade_passageiros: 7,
      },
    ]);

  const req = criarRequisicao({
    ...dadosVeiculo(),
    capacidade_passageiros: 7,
  });

  const { res, writeHead, end } = criarResposta();

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"capacidade_passageiros":7'),
  );

  expect(sql).toHaveBeenCalledTimes(2);

  const parametrosInsert = bancoMock.mock.calls[1].slice(1);
  expect(parametrosInsert).toContain(7);
});

test('BE-S6-02 usa capacidade padrão de 5 ao cadastrar veículo', async () => {
  bancoMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 22,
        ...dadosVeiculo(),
        capacidade_passageiros: 5,
      },
    ]);

  const req = criarRequisicao(dadosVeiculo());
  const { res, writeHead, end } = criarResposta();

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"capacidade_passageiros":5'),
  );

  expect(sql).toHaveBeenCalledTimes(2);

  const parametrosInsert = bancoMock.mock.calls[1].slice(1);
  expect(parametrosInsert).toContain(5);
});

test('BE-S6-02 atualiza capacidade de passageiros do veículo', async () => {
  bancoMock.mockResolvedValueOnce([
    {
      id: 10,
      ...dadosVeiculo(),
      capacidade_passageiros: 8,
    },
  ]);

  const req = criarRequisicao({
    capacidade_passageiros: 8,
  });

  const { res, writeHead, end } = criarResposta();

  await atualizarVeiculo(req, res, '10');

  expect(writeHead).toHaveBeenCalledWith(
    200,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"capacidade_passageiros":8'),
  );

  expect(sql).toHaveBeenCalledTimes(1);

  const parametrosUpdate = bancoMock.mock.calls[0].slice(1);
  expect(parametrosUpdate).toContain(8);
});
test('BE-S6-02 rejeita veículo locado sem fornecedor', async () => {
  const req = criarRequisicao({
    ...dadosVeiculo(),
    vinculo: 'LOCADO',
  });

  const { res, writeHead, end } = criarResposta();

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('FORNECEDOR_OBRIGATORIO'),
  );

  expect(sql).not.toHaveBeenCalled();
});
test('BE-S6-02 cadastra veículo locado com fornecedor', async () => {
  bancoMock
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: 30,
        ...dadosVeiculo(),
        vinculo: 'LOCADO',
        fornecedor_locacao: 'Nordeste Rent',
      },
    ]);

  const req = criarRequisicao({
    ...dadosVeiculo(),
    vinculo: 'LOCADO',
    fornecedor_locacao: 'Nordeste Rent',
  });

  const { res, writeHead } = criarResposta();

  await criarVeiculo(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  const parametrosInsert = bancoMock.mock.calls[1].slice(1);

  expect(parametrosInsert).toContain('LOCADO');
  expect(parametrosInsert).toContain('Nordeste Rent');
});
test('BE-S6-02 atualiza vínculo e fornecedor do veículo', async () => {
  bancoMock.mockResolvedValueOnce([
    {
      id: 10,
      ...dadosVeiculo(),
      vinculo: 'LOCADO',
      fornecedor_locacao: 'Nordeste Rent',
    },
  ]);

  const req = criarRequisicao({
    vinculo: 'LOCADO',
    fornecedor_locacao: 'Nordeste Rent',
  });

  const { res, writeHead } = criarResposta();

  await atualizarVeiculo(req, res, '10');

  expect(writeHead).toHaveBeenCalledWith(
    200,
    expect.any(Object),
  );

  const parametrosUpdate = bancoMock.mock.calls[0].slice(1);

  expect(parametrosUpdate).toContain('LOCADO');
  expect(parametrosUpdate).toContain('Nordeste Rent');
});