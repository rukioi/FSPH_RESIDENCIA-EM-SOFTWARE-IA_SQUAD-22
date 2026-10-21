
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../../src/database/connection.js', () => ({
  sql: vi.fn(),
}));

import { sql } from '../../src/database/connection.js';
import {
  criarSolicitacao,
  despacharOrdem,
} from '../../src/modules/svo/svo.repository.js';

beforeEach(() => {
  vi.clearAllMocks();
});

test('BE-S5-02 despacha ordem de coleta', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado.mockResolvedValueOnce([
    {
      id: 1,
      motorista_id: 2,
      veiculo_id: 3,
      status: 'EM_DESLOCAMENTO',
    },
  ] as never);

  const resultado = await despacharOrdem({
    ordemId: 1,
    motoristaId: 2,
    veiculoId: 3,
  });

  expect(resultado).toEqual({
    id: 1,
    motorista_id: 2,
    veiculo_id: 3,
    status: 'EM_DESLOCAMENTO',
  });

  expect(bancoSimulado).toHaveBeenCalledOnce();
});

test('BE-S5-02 não despacha ordem indisponível', async () => {
  const bancoSimulado = sql as unknown as ReturnType<typeof vi.fn>;

  bancoSimulado.mockResolvedValueOnce([] as never);

  const resultado = await despacharOrdem({
    ordemId: 999,
    motoristaId: 2,
    veiculoId: 3,
  });

  expect(resultado).toBeNull();
});

test('BE-S5-02 cria solicitação, ordem e atividades', async () => {
  const consultas = vi
    .fn()
    .mockResolvedValueOnce([{ id: '10' }])
    .mockResolvedValueOnce([
      { id: '10', codigo: '#SVO-10' },
    ])
    .mockResolvedValueOnce([
      { id: '20', status: 'PENDENTE_ALOCACAO' },
    ])
    .mockResolvedValueOnce([]);

  const bancoSimulado = vi.mocked(sql);

  const executarTransacao = async (
    operacao: (transacao: typeof sql) => Promise<unknown>,
  ) => {
    return await operacao(consultas as unknown as typeof sql);
  };

  const iniciarTransacao = vi.fn(executarTransacao);

Object.assign(bancoSimulado, {
  begin: iniciarTransacao,
});

  const resultado = await criarSolicitacao({
    atendenteId: '1',
    localFalecimento: 'Hospital Teste',
    enderecoRemocao: 'Rua Teste, 123',
    solicitanteNome: 'Pessoa Teste',
  });

  expect(resultado).toEqual({
    solicitacao: {
      id: 10,
      codigo: '#SVO-10',
    },
    ordemColeta: {
      id: 20,
      codigo: '#OC-20',
      status: 'PENDENTE_ALOCACAO',
    },
    atividades: [
      'Solicitação #SVO-10 confirmada na ligação',
      'Ordem de coleta #OC-20 gerada para #SVO-10',
    ],
  });

  expect(consultas).toHaveBeenCalledTimes(4);
  expect(iniciarTransacao).toHaveBeenCalledOnce();
});
