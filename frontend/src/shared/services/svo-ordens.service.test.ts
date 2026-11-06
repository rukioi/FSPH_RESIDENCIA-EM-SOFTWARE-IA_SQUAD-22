import { afterEach, expect, test, vi } from 'vitest';
import { alterarColeta, historicoSvo, minhaOrdem, proximaEtapa, type MinhaOrdem } from './svo-ordens.service';

const ordem: MinhaOrdem = {
  id: '9007199254740993',
  codigo: '#OC-9007199254740993',
  solicitacaoCodigo: '#SVO-1',
  status: 'EM_DESLOCAMENTO',
  quantidadeCorpos: 1,
  veiculoId: '8',
  enderecoRemocao: 'Local de teste',
  dataInicio: null,
  dataFim: null,
  kmInicial: null,
  kmFinal: null,
};

function responder(payload: unknown, status = 200) {
  vi.stubGlobal('sessionStorage', { getItem: () => 'fixture-unitaria' });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(new Response(payload === undefined ? null : JSON.stringify(payload), { status })),
  );
}
afterEach(() => vi.unstubAllGlobals());

test('usa a etapa persistida e distingue despacho, início e transporte', () => {
  expect(proximaEtapa(ordem)).toBe('iniciar');
  const iniciada = { ...ordem, dataInicio: '2026-11-01T10:00:00', kmInicial: 0 };
  expect(proximaEtapa(iniciada)).toBe('etapa');
  expect(proximaEtapa({ ...iniciada, status: 'EM_TRANSPORTE' })).toBe('concluir');
  for (const status of ['CANCELADA', 'CONCLUIDA', 'PENDENTE_ALOCACAO'] as const) {
    expect(proximaEtapa({ ...iniciada, status })).toBeNull();
  }
});

test('rejeita detalhe de outro ID e histórico de outra página', async () => {
  responder({ ...ordem, id: '42' });
  await expect(minhaOrdem(ordem.id)).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA' });
  responder({ data: [], meta: { page: 1, total: 1, limit: 20 } });
  await expect(historicoSvo('ordem', ordem.id, 2)).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA' });
});

test.each([
  [200, { ...ordem, status: 'CANCELADA' }],
  [200, { ...ordem, id: '99' }],
  [204, undefined],
])('não confirma transição com resultado incompatível (%i)', async (status, retorno) => {
  responder(retorno, status);
  await expect(alterarColeta(ordem.id, { tipo: 'iniciar', km: 0 })).rejects.toBeInstanceOf(Error);
});
