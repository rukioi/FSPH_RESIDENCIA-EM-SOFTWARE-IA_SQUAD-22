import { describe, expect, it } from 'vitest';
import { lerRotaHistoricoAbastecimentosVeiculo, rotaHistoricoAbastecimentosVeiculo } from './rotas';

describe('histórico de abastecimentos por veículo', () => {
  it('aceita identificadores BIGINT negativos existentes e preserva o vínculo', () => {
    const caminho = rotaHistoricoAbastecimentosVeiculo('-27001');
    expect(caminho).toBe('/gestor/veiculos/-27001/abastecimentos');
    expect(lerRotaHistoricoAbastecimentosVeiculo(caminho)).toBe('-27001');
  });
  it('rejeita identificadores inválidos', () => {
    for (const id of ['0', '-0', '01', 'abc', '../1']) {
      expect(() => rotaHistoricoAbastecimentosVeiculo(id)).toThrow();
      expect(lerRotaHistoricoAbastecimentosVeiculo(`/gestor/veiculos/${id}/abastecimentos`)).toBeNull();
    }
  });
});
