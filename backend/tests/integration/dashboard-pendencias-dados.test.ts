import { expect, test, vi } from 'vitest';

vi.mock('../../src/database/connection.js', () => ({
  sql: vi.fn(),
}));

import { sql } from '../../src/database/connection.js';
import { buscarPendencias } from '../../src/modules/dashboard/dashboard.pendencias.js';

test('BE-05 identifica CNHs e documentos pendentes', async () => {
  const consulta = sql as unknown as ReturnType<typeof vi.fn>;

  consulta
    .mockResolvedValueOnce([
      {
        id: 1,
        nome: 'Motorista Teste',
        vencimento: '2026-10-10',
        situacao: 'VENCIDO',
      },
      {
        id: 2,
        nome: 'Motorista Exemplo',
        vencimento: '2026-10-20',
        situacao: 'PROXIMO_VENCIMENTO',
      },
    ])
    .mockResolvedValueOnce([
      {
        id: 3,
        tipo_documento: 'LICENCIAMENTO',
        placa: 'ABC1234',
        modelo: 'Onix',
        vencimento: '2026-10-12',
        situacao: 'VENCIDO',
      },
    ]);

  const resultado = await buscarPendencias();

  expect(resultado.motoristas).toHaveLength(2);
  expect(resultado.documentos).toHaveLength(1);
  expect(resultado.motoristas[0].situacao).toBe('VENCIDO');
  expect(resultado.motoristas[1].situacao).toBe('PROXIMO_VENCIMENTO');
  expect(resultado.documentos[0].situacao).toBe('VENCIDO');
});
