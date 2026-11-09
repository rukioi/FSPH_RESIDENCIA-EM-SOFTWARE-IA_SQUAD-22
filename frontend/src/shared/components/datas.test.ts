import { expect, test } from 'vitest';
import { dataIso, exibirData, mascararData } from './datas';

test.each([
  ['29/02/2000', '2000-02-29'], ['29/02/2024', '2024-02-29'],
  ['01/01/0001', '0001-01-01'], ['31/12/9999', '9999-12-31'],
])('preserva a data civil válida %s', (valor, esperado) => {
  expect(dataIso(valor)).toBe(esperado);
  expect(exibirData(esperado)).toBe(valor);
});

test.each(['29/02/1900', '29/02/2023', '31/04/2026', '00/01/2026',
  '01/13/2026', '01/01/0000', '1/1/2026', '', 'texto'])('rejeita calendário ou formato inválido %s', valor => {
  expect(dataIso(valor)).toBe('');
});

test.each([
  ['1', '1'], ['120', '12/0'], ['12032026', '12/03/2026'],
  ['2026-03-12', '12/03/2026'], ['12/03/2026123', '12/03/2026'], ['', ''],
])('mascara digitação e colagem de %s', (valor, esperado) => {
  expect(mascararData(valor)).toBe(esperado);
});
