import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { abastecimentosSchemas } from '../../src/modules/abastecimentos/abastecimentos.schemas.js';
import { prepararAnexos } from '../helpers/anexos-fixture.js';

const server = createApp();
let fixture: Awaited<ReturnType<typeof prepararAnexos>>;
let base: string;
beforeAll(async () => {
  fixture = await prepararAnexos();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await fixture?.limpar();
});
const get = (path: string, ator: string | null = 'ADM') => fetch(base + path,
  { headers: ator ? { Authorization: `Bearer ${fixture.tokens[ator]}` } : {} });

test('detalhe e histórico recuperam o registro persistido em duas consultas independentes', async () => {
  for (let reload = 0; reload < 2; reload++) {
    const response = await get('/api/abastecimentos/92194');
    expect(response.status).toBe(200);
    const { data } = abastecimentosSchemas.RespostaDetalheAbastecimento.parse(await response.json());
    expect(data).toMatchObject({ id: '92194', veiculo_id: '92194', quilometragem: 1000, litragem: '10.00', valor_total: '60.00' });
    expect(data).not.toHaveProperty('dados');
    expect(data).not.toHaveProperty('criado_por_id');
    const list = await get('/api/veiculos/92194/abastecimentos?inicio=2026-11-12&fim=2026-11-12&limit=1');
    expect(list.status).toBe(200);
    expect(abastecimentosSchemas.HistoricoAbastecimentos.parse(await list.json()))
      .toEqual({ data: [data], meta: { page: 1, limit: 1, total: 1 } });
  }
});

test('filtro e paginação preservam zero real, limites inclusivos e o formato legado sem query', async () => {
  const legacy = await (await get('/api/abastecimentos')).json();
  expect(legacy).not.toHaveProperty('meta');
  expect(legacy.data.filter((r: { id: string }) => ['92194', '92195'].includes(r.id)).map((r: { id: string }) => r.id))
    .toEqual(['92195', '92194']);
  for (const query of ['veiculoId=92194&inicio=2026-11-13', 'veiculoId=92194&fim=2026-11-11']) {
    expect(await (await get('/api/abastecimentos?' + query)).json())
      .toEqual({ data: [], meta: { page: 1, limit: 20, total: 0 } });
  }
  expect(await (await get('/api/abastecimentos?veiculoId=92194&pagina=2&limit=1')).json())
    .toEqual({ data: [], meta: { page: 2, limit: 1, total: 1 } });
});

test.each(['inicio=2026-02-30', 'inicio=2026-12-01&fim=2026-01-01', 'pagina=0', 'limit=101',
  'veiculoId=1%20OR%201=1', 'inicio=2026-01-01&inicio=2026-01-02', 'pagina=9007199254740991&limit=100'])(
  'consulta inválida retorna 400: %s', async query => {
  expect((await get('/api/abastecimentos?' + query)).status).toBe(400);
});

test('401/403 protegem detalhe e histórico; 404 distingue recurso inexistente', async () => {
  for (const path of ['/api/abastecimentos/92194', '/api/veiculos/92194/abastecimentos']) {
    expect((await get(path, null)).status).toBe(401);
    expect((await get(path, 'MOTORISTA')).status).toBe(403);
    expect((await get(path, 'ATENDENTE_SVO')).status).toBe(403);
    expect((await get(path, 'GESTOR_FROTA')).status).toBe(200);
  }
  for (const path of ['/api/abastecimentos/999999999', '/api/veiculos/999999999/abastecimentos',
    '/api/abastecimentos?veiculoId=999999999']) expect((await get(path)).status).toBe(404);
  expect((await get('/api/veiculos/92194/abastecimentos?veiculoId=92195')).status).toBe(400);
});
