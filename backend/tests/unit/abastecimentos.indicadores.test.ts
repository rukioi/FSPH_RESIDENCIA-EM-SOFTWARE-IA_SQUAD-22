import { afterEach, expect, test, vi } from 'vitest';
import * as repository from '../../src/modules/abastecimentos/abastecimentos.repository.js';
import { obterIndicadoresAbastecimentos } from '../../src/modules/abastecimentos/abastecimentos.service.js';

afterEach(() => vi.restoreAllMocks());

test('falha do repositório não vira indicador vazio nem sucesso com zero', async () => {
  // Injeção de falha unitária, separada da prova HTTP/PostgreSQL com dados reais.
  const falha = new Error('indisponibilidade de teste');
  vi.spyOn(repository, 'consultarIndicadoresAbastecimentos').mockRejectedValueOnce(falha);
  await expect(obterIndicadoresAbastecimentos(new URLSearchParams())).rejects.toBe(falha);
});
