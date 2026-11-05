import {expect,test} from 'vitest';
import {dataHoraInstitucionalSchema,instanteEmMicrosPostgres,intervaloTemporalValido} from '../../src/modules/solicitacoes/solicitacoes.datas.js';

test.each(['0000-01-01T00:00:00Z','0000-11-04T08:00:00-03:00','2026-11-10T08:00:00+16:00',
  '2026-11-10T08:00:00-23:59','0001-01-01T00:00:00+15:59','9999-12-31T23:59:59-15:59','9999-12-31T23:59:59.9999999-03:00',
  '2026-02-29T08:00:00-03:00','2026-13-01T08:00:00Z','2026-11-10T08:00:00','infinity','now'])('recusa data incompatível %s',value=>{
  expect(dataHoraInstitucionalSchema.safeParse(value).success).toBe(false);
});
test.each(['2026-11-10T08:00:00-03:00','2026-11-10T11:00:00Z','2026-11-10T08:00:00.123456-03:00',
  '2026-11-10T08:00:00+15:59','2026-11-10T08:00:00-15:59','0001-01-02T12:00:00Z','9999-12-30T12:00:00Z',
  '2024-02-29T08:00:00-03:00'])('preserva data válida e offset %s',value=>{
  expect(dataHoraInstitucionalSchema.parse(value)).toBe(value);
});


test.each(['invalido','0000-01-01T08:00:00Z','2026-02-29T08:00:00Z','2026-01-01T08:00:00','2026-01-01T08:00:00+16:00'])('comparador rejeita entrada inválida sem lançar exceção: %s',value=>{
  expect(instanteEmMicrosPostgres(value)).toBeNull();
  expect(intervaloTemporalValido(value,'2098-01-01T08:00:00Z',31)).toBe(false);
});

test('comparação preserva um microssegundo antes e depois de 1970',()=>{
  expect(instanteEmMicrosPostgres('1969-12-31T23:59:59.999999Z')).toBe(-1n);
  expect(instanteEmMicrosPostgres('1970-01-01T00:00:00.000001Z')).toBe(1n);
});
