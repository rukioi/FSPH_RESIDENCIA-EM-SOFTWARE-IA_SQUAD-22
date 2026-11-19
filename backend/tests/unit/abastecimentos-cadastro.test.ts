import { beforeEach, expect, test, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';

// Testa validação/mapeamento HTTP; não é evidência de persistência PostgreSQL.
const mocks = vi.hoisted(() => ({ begin: vi.fn(), leitura: vi.fn(), auditar: vi.fn() }));
vi.mock('../../src/config/db.js', () => ({ sql: { begin: mocks.begin } }));
vi.mock('../../src/modules/abastecimentos/abastecimentos.repository.js', () => ({ validarLeituraAnterior: mocks.leitura }));
vi.mock('../../src/modules/auditoria/auditoria.service.js', () => ({ registrarAtividades: mocks.auditar }));
import { criarAbastecimento } from '../../src/modules/abastecimentos/abastecimentos.controller.js';

const entrada = { veiculo_id: 1, motorista_id: 2, litragem: '10.50', valor_total: '63.00',
  quilometragem: 1000, data_abastecimento: '2026-11-18' };
beforeEach(() => { vi.resetAllMocks(); });
async function cadastrar(body: unknown) {
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage;
  req.headers = { 'content-type': 'application/json' };
  const writeHead = vi.fn(), end = vi.fn();
  await criarAbastecimento(req, { writeHead, end } as unknown as ServerResponse, '42');
  return { status: writeHead.mock.calls[0][0], body: JSON.parse(end.mock.calls[0][0]) };
}

test.each([undefined, null])('motorista ausente/nulo é aceito e auditado: %s', async motorista_id => {
  const tx = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...entrada, motorista_id: null, id: '7' }]);
  mocks.begin.mockImplementationOnce(callback => callback(tx));
  expect(await cadastrar({ ...entrada, motorista_id })).toMatchObject({ status: 201, body: { data: { motorista_id: null } } });
  expect(mocks.auditar).toHaveBeenCalledExactlyOnceWith(tx, '42', [{ operacao: 'abastecimento_criado', recursoId: '7' }]);
});

test.each([-1, -2147483648, 1.5])('km inválido recebe 400 antes de consultar banco: %s', async quilometragem => {
  expect(await cadastrar({ ...entrada, quilometragem })).toMatchObject({ status: 400,
    body: { error: { code: 'DADOS_INVALIDOS' } } });
  expect(mocks.begin).not.toHaveBeenCalled();
  expect(mocks.auditar).not.toHaveBeenCalled();
});

test.each([undefined, null])('km ausente/nulo é aceito sem comparação de leitura: %s', async quilometragem => {
  const tx = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...entrada, quilometragem: null, id: '7' }]);
  mocks.begin.mockImplementationOnce(callback => callback(tx));
  expect(await cadastrar({ ...entrada, quilometragem })).toMatchObject({ status: 201, body: { data: { quilometragem: null } } });
  expect(mocks.leitura).not.toHaveBeenCalled();
  expect(mocks.auditar).toHaveBeenCalledExactlyOnceWith(tx, '42', [{ operacao: 'abastecimento_criado', recursoId: '7' }]);
});
test('violação de FK do motorista recebe 404, sem transformar referência ausente em 500', async () => {
  mocks.begin.mockRejectedValueOnce(Object.assign(new Error('sentinela SQL privada'), { code: '23503' }));
  const response = await cadastrar({ ...entrada, motorista_id: 999999 });
  expect(response).toMatchObject({ status: 404, body: { error: { code: 'REFERENCIA_INEXISTENTE' } } });
  expect(JSON.stringify(response)).not.toContain('sentinela');
  expect(mocks.auditar).not.toHaveBeenCalled();
});

test.each([0, 1000])('cadastro válido mantém km %s, motorista e valores decimais, e audita uma vez', async quilometragem => {
  const body = { ...entrada, quilometragem };
  const tx = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...body, id: '7' }]);
  mocks.begin.mockImplementationOnce(callback => callback(tx));
  expect(await cadastrar(body)).toMatchObject({ status: 201, body: { data: { id: '7', motorista_id: 2, valor_total: '63.00', quilometragem } } });
  expect(mocks.auditar).toHaveBeenCalledExactlyOnceWith(tx, '42', [{ operacao: 'abastecimento_criado', recursoId: '7' }]);
});

test.each([0.001, 0.004, '0.004999999999999999999'])('valor que seria zero em NUMERIC(10,2) recebe 400 antes de SQL: %s', async valor => {
  for (const campo of ['litragem', 'valor_total']) {
    expect(await cadastrar({ ...entrada, [campo]: valor })).toMatchObject({ status: 400 });
  }
  expect(mocks.begin).not.toHaveBeenCalled();
});
