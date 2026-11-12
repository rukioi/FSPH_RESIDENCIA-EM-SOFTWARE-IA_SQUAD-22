import {describe,expect,test} from 'vitest';
import {corrigirQuilometragemSchema,correcaoViagemSchema,itemCorrecaoViagemSchema} from '../../src/modules/viagens/viagens.correcao.schemas.js';
describe('validação técnica da correção de quilometragem',()=>{
  test.each([{kmInicial:100},{kmFinal:150},{kmInicial:100,kmFinal:100}])('aceita os campos previstos: %o',campos=>{
    expect(corrigirQuilometragemSchema.parse({...campos,justificativa:' Leitura corrigida '})).toMatchObject({...campos,justificativa:'Leitura corrigida'});
  });
  test.each([
    {justificativa:'Motivo'}, {kmFinal:100,justificativa:'   '}, {kmFinal:100,justificativa:'A\u0000B'},
    {kmFinal:100,justificativa:'x'.repeat(2001)}, {kmInicial:-1,justificativa:'Motivo'},
    {kmFinal:1.5,justificativa:'Motivo'}, {kmFinal:2147483648,justificativa:'Motivo'},
    {kmInicial:101,kmFinal:100,justificativa:'Motivo'}, {kmFinal:100,justificativa:'Motivo',autorId:'1'},
  ])('rejeita entrada inválida %#',entrada=>expect(corrigirQuilometragemSchema.safeParse(entrada).success).toBe(false));
});

test('preserva leituras anteriores legadas negativas ou nulas no histórico',()=>{
  const base={id:'1',versao:1,kmInicialAnterior:-1,kmFinalAnterior:-2,kmInicial:0,kmFinal:1,justificativa:'Correção',autorId:'2',criadoEm:'2026-01-01T00:00:00Z'};
  expect(correcaoViagemSchema.parse({...base,odometroAtualizado:false}).kmInicialAnterior).toBe(-1);
  expect(itemCorrecaoViagemSchema.parse({...base,kmFinalAnterior:null}).kmFinalAnterior).toBeNull();
});
