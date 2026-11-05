import {afterAll,beforeAll,expect,test} from 'vitest';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {instanteEmMicrosPostgres,intervaloTemporalValido} from '../../src/modules/solicitacoes/solicitacoes.datas.js';
import {consultaDashboardSchema} from '../../src/modules/dashboard/dashboard.indicadores.schemas.js';

let sql:Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async()=>{sql=await verifiedSql();});
afterAll(async()=>{await sql?.end();});

const valores=[
  '2098-06-01T08:00:00.000001-03:00','2098-06-01T13:00:00.123456+02:00',
  '2098-06-01T08:00:00.0000004-03:00','2098-06-01T08:00:00.0000005-03:00',
  '2098-06-01T08:00:00.0000006-03:00','2098-06-01T08:00:00.0000015-03:00',
  '2098-06-01T08:00:00.0000025-03:00','2098-06-01T08:00:00.1234565-03:00',
  '2098-06-01T08:00:00.12345650000000001-03:00',
  '2098-06-01T08:00:00.9999994-03:00','2098-06-01T08:00:00.9999995-03:00',
  '2098-06-01T08:00:00.99999949999999999-03:00',
  '1969-12-31T23:59:59.999999Z','1970-01-01T00:00:00.000001Z',
  '0001-01-02T12:00:00.000001Z','9999-12-30T12:00:00.9999995Z',
  '2098-06-01T08:00:00.123456+15:59','2098-06-01T08:00:00.123456-15:59',
];

test.each(valores)('comparação em microssegundos coincide exatamente com PostgreSQL: %s',async value=>{
  const [row]=await sql`SELECT (extract(epoch FROM ${value}::text::timestamptz)*1000000)::bigint::text AS micros`;
  expect(instanteEmMicrosPostgres(value)).toBe(BigInt(row.micros));
});

const intervalos=[
  ['2098-06-01T08:00:00.000001-03:00','2098-06-01T08:00:00.000002-03:00'],
  ['2098-06-01T08:00:00.000002-03:00','2098-06-01T08:00:00.000001-03:00'],
  ['2098-06-01T08:00:00-03:00','2098-06-01T13:00:00+02:00'],
  ['2098-06-01T08:00:00.0000004-03:00','2098-06-01T08:00:00.0000006-03:00'],
  ['2098-06-01T08:00:00.0000004-03:00','2098-06-01T08:00:00.00000049-03:00'],
  ['2098-06-01T08:00:00.0000015-03:00','2098-06-01T08:00:00.0000024-03:00'],
  ['2098-06-01T23:59:59.9999994-03:00','2098-06-02T00:00:00.000000-03:00'],
  ['2098-01-01T00:00:00.000001-03:00','2098-02-01T00:00:00.000001-03:00'],
  ['2098-01-01T00:00:00.000001-03:00','2098-02-01T00:00:00.000002-03:00'],
  ['2098-01-01T00:00:00.0000004-03:00','2098-02-01T00:00:00.0000006-03:00'],
];

test.each(intervalos)('limites do dashboard coincidem com PostgreSQL: %s / %s',async(inicio,fim)=>{
  const [row]=await sql`SELECT ${fim}::text::timestamptz>${inicio}::text::timestamptz
    AND ${fim}::text::timestamptz-${inicio}::text::timestamptz<=interval '31 days' AS valido`;
  expect(intervaloTemporalValido(inicio,fim,31)).toBe(row.valido);
  expect(consultaDashboardSchema.safeParse({periodo:'personalizado',inicio,fim}).success).toBe(row.valido);
});
