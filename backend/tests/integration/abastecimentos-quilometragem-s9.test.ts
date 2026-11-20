import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { prepararAnexos } from '../helpers/anexos-fixture.js';

const server = createApp();
let fixture: Awaited<ReturnType<typeof prepararAnexos>>;
let base: string;
beforeAll(async () => {
  fixture = await prepararAnexos();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await fixture.sql`DELETE FROM abastecimento WHERE veiculo_id=92194 AND posto='Fixture km obrigatório S9'`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await fixture?.limpar();
});
const entrada = { veiculo_id: 92194, motorista_id: 92199, litragem: 10, valor_total: 60,
  data_abastecimento: '2026-11-13', posto: 'Fixture km obrigatório S9' };
function cadastrar(km: unknown, dia = entrada.data_abastecimento) {
  return fetch(base + '/api/abastecimentos', { method: 'POST',
    headers: { Authorization: `Bearer ${fixture.tokens.ADM}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...entrada, quilometragem: km, data_abastecimento: dia }) });
}

test.each([-1, -2147483648, 1.5])('km inválido retorna 400 e não persiste: %s', async km => {
  const response = await cadastrar(km);
  expect(response.status).toBe(400);
  expect((await response.json()).error.code).toBe('DADOS_INVALIDOS');
  expect(await fixture.sql`SELECT id FROM abastecimento WHERE posto=${entrada.posto}`).toHaveLength(0);
});

test.each([undefined, null])('km ausente/nulo é persistido como null: %s', async km => {
  const response = await cadastrar(km);
  expect(response.status).toBe(201);
  const { data } = await response.json();
  expect(data.quilometragem).toBeNull();
  const [row] = await fixture.sql`SELECT quilometragem FROM abastecimento WHERE id=${data.id}`;
  expect(row.quilometragem).toBeNull();
});
test('leitura inferior à anterior retorna 409 sem registrar abastecimento', async () => {
  const response = await cadastrar(999);
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ODOMETRO_INCONSISTENTE');
  expect(await fixture.sql`SELECT id FROM abastecimento WHERE posto=${entrada.posto}`).toHaveLength(0);
});

test.each([1000, 1001])('leitura igual ou maior é confirmada e persistida: %s', async km => {
  const response = await cadastrar(km);
  expect(response.status).toBe(201);
  const { data } = await response.json();
  expect(data.quilometragem).toBe(km);
  const [row] = await fixture.sql`SELECT quilometragem FROM abastecimento WHERE id=${data.id}`;
  expect(row.quilometragem).toBe(km);
});

test('a comparação usa a data do abastecimento; não trata leitura futura como anterior', async () => {
  expect((await cadastrar(990, '2026-11-11')).status).toBe(201);
  expect((await cadastrar(989, '2026-11-11')).status).toBe(409);
  expect((await cadastrar(990, '2026-11-11')).status).toBe(201);
});

test('confere novamente a leitura depois de adquirir o bloqueio concorrente do veículo', async () => {
  let liberar!: () => void;
  let pronto!: () => void;
  const liberado = new Promise<void>(resolve => { liberar = resolve; });
  const bloqueado = new Promise<void>(resolve => { pronto = resolve; });
  const holding = fixture.sql.begin(async tx => {
    await tx`SELECT id FROM veiculo WHERE id=92194 FOR UPDATE`;
    pronto();
    await liberado;
  });
  const aguardar = async (n: number) => {
    const limite = Date.now() + 5000;
    while (Date.now() < limite) {
      const [row] = await fixture.admin`SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE%'`;
      if (row.n >= n) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Requisições não aguardaram o bloqueio esperado.');
  };
  let primeira: Promise<Response> | undefined;
  let segunda: Promise<Response> | undefined;
  try {
    await bloqueado;
    primeira = cadastrar(1100);
    await aguardar(1);
    segunda = cadastrar(1050);
    await aguardar(2);
    liberar();
    await holding;
    expect((await primeira).status).toBe(201);
    expect((await segunda).status).toBe(409);
    expect(await fixture.sql`SELECT quilometragem FROM abastecimento WHERE posto=${entrada.posto}`)
      .toEqual([{ quilometragem: 1100 }]);
  } finally {
    liberar();
    await holding;
    await Promise.all([primeira, segunda]);
  }
}, 15000);
