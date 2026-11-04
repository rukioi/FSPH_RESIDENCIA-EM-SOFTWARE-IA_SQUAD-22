
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('../../src/database/connection.js', () => ({
  sql: vi.fn(),
}));

import { sql } from '../../src/database/connection.js';
import {
  criarSolicitacao,
  despacharOrdem,
} from '../../src/modules/svo/svo.repository.js';

type BancoSimulado = {
  mockReset: () => void;
  mockResolvedValueOnce: (valor: unknown) => BancoSimulado;
  mock: { calls: unknown[][] };
};

function banco(): BancoSimulado {
  return sql as unknown as BancoSimulado;
}

beforeEach(() => {
  vi.clearAllMocks();
  banco().mockReset();
  Object.assign(sql, {
    begin: vi.fn(async (
      operacao: (transacao: typeof sql) => Promise<unknown>,
    ) => operacao(sql)),
  });
});

function textosSql(): string[] {
  return banco().mock.calls.map((chamada) => {
    const trechos = chamada[0] as TemplateStringsArray;
    return trechos.join(' ');
  });
}

test('BE-S5-02 despacha ordem, motorista e veículo elegíveis na mesma transação', async () => {
  banco()
    .mockResolvedValueOnce([{ id: 1 }] as never)
    .mockResolvedValueOnce([{ id: 2, status: 'DISPONIVEL' }] as never)
    .mockResolvedValueOnce([{ id: 3, status: 'DISPONIVEL' }] as never)
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([
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
    tipo: 'despachada',
    ordem: {
      id: 1,
      motorista_id: 2,
      veiculo_id: 3,
      status: 'EM_DESLOCAMENTO',
    },
  });

  const consultas = textosSql();
  expect(consultas).toHaveLength(5);
  expect(consultas.filter((consulta) => consulta.includes('FOR UPDATE'))).toHaveLength(4);
  expect(consultas.some((consulta) => consulta.includes('PENDENTE_ALOCACAO'))).toBe(true);
  expect(consultas.some((consulta) => consulta.includes('EM_DESLOCAMENTO'))).toBe(true);
  expect(consultas.some((consulta) => consulta.includes('UPDATE public.ordem_coleta'))).toBe(true);
});

test('BE-S5-02 não despacha ordem indisponível', async () => {
  banco().mockResolvedValueOnce([] as never);

  const resultado = await despacharOrdem({
    ordemId: 999,
    motoristaId: 2,
    veiculoId: 3,
  });

  expect(resultado).toEqual({ tipo: 'ordem_indisponivel' });
  expect(textosSql().some((consulta) => consulta.includes('UPDATE public.ordem_coleta'))).toBe(false);
});

test('BE-S5-02 não despacha motorista ou veículo inexistente', async () => {
  banco()
    .mockResolvedValueOnce([{ id: 1 }] as never)
    .mockResolvedValueOnce([] as never)
    .mockResolvedValueOnce([{ id: 3 }] as never);

  const resultado = await despacharOrdem({
    ordemId: 1,
    motoristaId: 2,
    veiculoId: 3,
  });

  expect(resultado).toEqual({ tipo: 'referencia_inexistente' });
  expect(textosSql().some((consulta) => consulta.includes('UPDATE public.ordem_coleta'))).toBe(false);
});

test('BE-S5-02 não despacha motorista ou veículo fora de DISPONIVEL', async () => {
  banco()
    .mockResolvedValueOnce([{ id: 1 }] as never)
    .mockResolvedValueOnce([{ id: 2, status: 'FOLGA' }] as never)
    .mockResolvedValueOnce([{ id: 3, status: 'DISPONIVEL' }] as never);

  const resultado = await despacharOrdem({
    ordemId: 1,
    motoristaId: 2,
    veiculoId: 3,
  });

  expect(resultado).toEqual({ tipo: 'recurso_inelegivel' });
  expect(textosSql().some((consulta) => consulta.includes('UPDATE public.ordem_coleta'))).toBe(false);
});

test('BE-S5-02 não despacha recurso já em deslocamento', async () => {
  banco()
    .mockResolvedValueOnce([{ id: 1 }] as never)
    .mockResolvedValueOnce([{ id: 2, status: 'DISPONIVEL' }] as never)
    .mockResolvedValueOnce([{ id: 3, status: 'DISPONIVEL' }] as never)
    .mockResolvedValueOnce([{ id: 8 }] as never);

  const resultado = await despacharOrdem({
    ordemId: 1,
    motoristaId: 2,
    veiculoId: 3,
  });

  expect(resultado).toEqual({ tipo: 'conflito_alocacao' });
  expect(textosSql().some((consulta) => consulta.includes('UPDATE public.ordem_coleta'))).toBe(false);
});

test('BE-S5-02 mapeia referência rejeitada pelo banco sem erro genérico', async () => {
  const erro = new Error('fk') as Error & { code: string };
  erro.code = '23503';
  Object.assign(sql, {
    begin: vi.fn(async () => {
      throw erro;
    }),
  });

  await expect(despacharOrdem({
    ordemId: 1,
    motoristaId: 2,
    veiculoId: 3,
  })).resolves.toEqual({ tipo: 'referencia_inexistente' });
});

test('BE-S5-02 mapeia conflito de unicidade sem erro genérico', async () => {
  const erro = new Error('unique') as Error & { code: string };
  erro.code = '23505';
  Object.assign(sql, {
    begin: vi.fn(async () => {
      throw erro;
    }),
  });

  await expect(despacharOrdem({
    ordemId: 1,
    motoristaId: 2,
    veiculoId: 3,
  })).resolves.toEqual({ tipo: 'conflito_alocacao' });
});

test('BE-S5-02 propaga falha inesperada do despacho', async () => {
  Object.assign(sql, {
    begin: vi.fn(async () => {
      throw new Error('falha inesperada');
    }),
  });

  await expect(despacharOrdem({
    ordemId: 1,
    motoristaId: 2,
    veiculoId: 3,
  })).rejects.toThrow('falha inesperada');
});

test('SCRUM-130 cria ocorrência pendente sem gerar ordem, com atividade única', async () => {
  const consultas = vi.fn()
    .mockResolvedValueOnce([{ id: '10' }])
    .mockResolvedValueOnce([{
      id: '10', codigo: '#SVO-10', status_triagem: 'AGUARDANDO_TRIAGEM',
      criado_em: new Date('2026-11-04T12:00:00.000Z'),
    }])
    .mockResolvedValueOnce([]);
  const iniciarTransacao = vi.fn(async (op: (tx: typeof sql) => Promise<unknown>) =>
    op(consultas as unknown as typeof sql));
  Object.assign(sql, { begin: iniciarTransacao });

  const resultado = await criarSolicitacao({
    atendenteId: '1', localFalecimento: 'Hospital Teste',
    enderecoRemocao: 'Rua Teste, 123', solicitanteNome: 'Pessoa Teste',
    pontoReferencia: 'Próximo ao hospital',
  });
  expect(resultado).toEqual({
    solicitacao: {
      id: '10', codigo: '#SVO-10', statusTriagem: 'AGUARDANDO_TRIAGEM',
      criadoEm: '2026-11-04T12:00:00.000Z',
    },
    atividades: ['Solicitação #SVO-10 registrada por telefone'],
  });
  expect(consultas).toHaveBeenCalledTimes(3);
  const statements = consultas.mock.calls.map(call => (call[0] as TemplateStringsArray).join(' ')).join('\n');
  expect(statements).toContain('INSERT INTO public.solicitacao_obito');
  expect(statements).toContain('AGUARDANDO_TRIAGEM');
  expect(statements).not.toContain('INSERT INTO public.ordem_coleta');
  expect(iniciarTransacao).toHaveBeenCalledOnce();
});
