import { expect, test } from 'vitest';
import { consultaIndicadoresManutencao, indicadoresManutencao } from '../../src/modules/manutencoes/manutencoes.schemas.js';

test.each([
  {},
  {inicio:'2024-02-29'},
  {fim:'2032-01-01'},
  {inicio:'2026-12-01',fim:'2026-12-01',veiculoId:'9223372036854775807',tipo:'CORRETIVA'},
])('aceita filtros civis e BIGINT válidos (%j)', filtro => {
  expect(consultaIndicadoresManutencao.parse(filtro)).toEqual(filtro);
});

test.each([
  {inicio:'2025-02-29'}, {fim:'0000-01-01'}, {fim:'2026-11-01T00:00:00Z'}, {tipo:''},
  {inicio:'2026-11-02',fim:'2026-11-01'}, {veiculoId:42}, {veiculoId:'-9223372036854775809'},
  {q:'a'}, {limit:'20'},
])('rejeita filtros inválidos ou alheios ao recorte (%j)', filtro => {
  expect(consultaIndicadoresManutencao.safeParse(filtro).success).toBe(false);
});

test('schema do custo distingue desconhecido, zero textual e valor numérico inválido',()=>{
  const custo=indicadoresManutencao.shape.data.shape.periodo.shape.custo;
  expect(custo.parse({totalConhecido:null,comCustoInformado:0,comCustoDesconhecido:1}).totalConhecido).toBeNull();
  expect(custo.parse({totalConhecido:'0.00',comCustoInformado:1,comCustoDesconhecido:0}).totalConhecido).toBe('0.00');
  expect(custo.safeParse({totalConhecido:0,comCustoInformado:1,comCustoDesconhecido:0}).success).toBe(false);
});
