import { describe, expect, it } from 'vitest';
import { conflitoAbastecimentoViagem } from '../../src/modules/viagens/quilometragem-abastecimento.js';

describe('cronologia entre abastecimento e viagem', () => {
  const viagem = { inicio: '2026-01-02', fim: '2026-01-04', inicial: 100, final: 200 };
  it('reconhece contradições comprováveis', () => {
    expect(conflitoAbastecimentoViagem('2026-01-01', 101, viagem)).toBe(true);
    expect(conflitoAbastecimentoViagem('2026-01-05', 199, viagem)).toBe(true);
    expect(conflitoAbastecimentoViagem('2026-01-02', 201, viagem)).toBe(true);
    expect(conflitoAbastecimentoViagem('2026-01-04', 99, viagem)).toBe(true);
    expect(conflitoAbastecimentoViagem('2026-01-03', 201, viagem)).toBe(true);
  });
  it('não presume ordem no mesmo dia', () => {
    expect(conflitoAbastecimentoViagem('2026-01-02', 50, { ...viagem, fim: viagem.inicio })).toBe(false);
    expect(conflitoAbastecimentoViagem('2026-01-02', 250, { ...viagem, fim: viagem.inicio })).toBe(false);
    expect(conflitoAbastecimentoViagem('2026-01-03', 150, viagem)).toBe(false);
  });
});