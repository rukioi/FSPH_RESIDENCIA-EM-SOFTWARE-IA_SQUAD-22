
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

function criarRequisicao(body: Record<string, unknown>): IncomingMessage {
  return Readable.from([JSON.stringify(body)]) as IncomingMessage;
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

function dadosMotorista() {
  return {
    nome: 'Motorista Teste',
    cnh: '12345678900',
    categoria_cnh: 'D',
    validade_cnh: '2028-12-31',
    status: 'DISPONIVEL',
  };
}

test('BE-S6-02 rejeita categoria de CNH inválida sem consultar o banco', async () => {
  const req = criarRequisicao({
    ...dadosMotorista(),
    categoria_cnh: 'Z',
  });

  const { res, writeHead, end } = criarResposta();

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
  const req = criarRequisicao({
    ...dadosMotorista(),
    status: 'INATIVO',
  });

  const { res, writeHead, end } = criarResposta();

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
  bancoSimulado.mockResolvedValueOnce([{ id: 10 }] as never);

  const req = criarRequisicao(dadosMotorista());
  const { res, writeHead, end } = criarResposta();

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
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([
      {
        id: 15,
        ...dadosMotorista(),
      },
    ] as never);

  const req = criarRequisicao(dadosMotorista());
  const { res, writeHead, end } = criarResposta();

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
  const req = criarRequisicao({
    categoria_cnh: 'Z',
  });

  const { res, writeHead, end } = criarResposta();

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
  const req = criarRequisicao({
    status: 'INATIVO',
  });

  const { res, writeHead, end } = criarResposta();

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
        body: JSON.stringify(dadosMotorista()),
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
        body: JSON.stringify(dadosMotorista()),
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

test('BE-S6-02 rejeita CPF inválido sem consultar o banco', async () => {
  const req = criarRequisicao({
    ...dadosMotorista(),
    cpf: '111.111.111-11',
  });

  const { res, writeHead, end } = criarResposta();

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('CPF_INVALIDO'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 rejeita telefone inválido sem consultar o banco', async () => {
  const req = criarRequisicao({
    ...dadosMotorista(),
    telefone: '123',
  });

  const { res, writeHead, end } = criarResposta();

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    400,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('TELEFONE_INVALIDO'),
  );

  expect(sql).not.toHaveBeenCalled();
});

test('BE-S6-02 rejeita CPF duplicado ao cadastrar', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([{ id: 20 }] as never);

  const req = criarRequisicao({
    ...dadosMotorista(),
    cpf: '529.982.247-25',
  });

  const { res, writeHead, end } = criarResposta();

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    409,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('CPF_DUPLICADO'),
  );

  expect(sql).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 cadastra motorista com CPF e telefone', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([
      {
        id: 21,
        ...dadosMotorista(),
        cpf: '52998224725',
        telefone: '79999998888',
      },
    ] as never);

  const req = criarRequisicao({
    ...dadosMotorista(),
    cpf: '529.982.247-25',
    telefone: '(79) 99999-8888',
  });

  const { res, writeHead, end } = criarResposta();

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"cpf":"52998224725"'),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"telefone":"79999998888"'),
  );

  expect(sql).toHaveBeenCalledTimes(3);
});

test('BE-S6-02 atualiza CPF e telefone do motorista', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([
      {
        id: 15,
        ...dadosMotorista(),
        cpf: '52998224725',
        telefone: '79999998888',
      },
    ] as never);

  const req = criarRequisicao({
    cpf: '529.982.247-25',
    telefone: '(79) 99999-8888',
  });

  const { res, writeHead, end } = criarResposta();

  await atualizarMotorista(req, res, '15');

  expect(writeHead).toHaveBeenCalledWith(
    200,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"cpf":"52998224725"'),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('"telefone":"79999998888"'),
  );

  expect(sql).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 trata CPF duplicado informado pelo banco', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([] as never)
    .mockRejectedValueOnce({
      code: '23505',
      constraint: 'motorista_cpf_key',
    });

  const req = criarRequisicao({
    ...dadosMotorista(),
    cpf: '529.982.247-25',
  });

  const { res, writeHead, end } = criarResposta();

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    409,
    expect.any(Object),
  );

  expect(end).toHaveBeenCalledWith(
    expect.stringContaining('CPF_DUPLICADO'),
  );
});
test('BE-S6-02 aceita CNH categoria A ao cadastrar motorista', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([
      {
        id: 16,
        ...dadosMotorista(),
        categoria_cnh: 'A',
      },
    ] as never);

  const req = criarRequisicao({
    ...dadosMotorista(),
    categoria_cnh: 'A',
  });

  const { res, writeHead } = criarResposta();

  await criarMotorista(req, res);

  expect(writeHead).toHaveBeenCalledWith(
    201,
    expect.any(Object),
  );

  expect(sql).toHaveBeenCalledTimes(2);
});

test('BE-S6-02 oculta CPF e telefone do Atendente SVO', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado.mockResolvedValueOnce([
    {
      id: 1,
      nome: 'Motorista Teste',
      cnh: '12345678900',
      status: 'DISPONIVEL',
      cpf: '12345678909',
      telefone: '79999999999',
    },
  ]);

  const { res, writeHead, end } = criarResposta();

  const { listarMotoristas } = await import(
    '../../src/modules/motoristas/motoristas.controller.js'
  );

  await listarMotoristas(
    {} as IncomingMessage,
    res,
    'ATENDENTE_SVO',
  );

  expect(writeHead).toHaveBeenCalledWith(200, expect.any(Object));

  const resposta = JSON.parse(String(end.mock.calls[0][0]));

  expect(resposta.data[0]).toMatchObject({
    id: 1,
    nome: 'Motorista Teste',
    status: 'DISPONIVEL',
  });

  expect(resposta.data[0]).not.toHaveProperty('cpf');
  expect(resposta.data[0]).not.toHaveProperty('telefone');

  expect(bancoSimulado).toHaveBeenCalledTimes(1);
});
