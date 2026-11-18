import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { prepararAnexos } from '../helpers/anexos-fixture.js';

const app = createApp();
let fixture: Awaited<ReturnType<typeof prepararAnexos>>;
let base: string;

beforeAll(async () => {
  fixture = await prepararAnexos();
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (app.address() as AddressInfo).port + '/api/abastecimentos/indicadores';
});

afterAll(async () => {
  if (app.listening) await new Promise<void>(resolve => app.close(() => resolve()));
  if (fixture) {
    try { await fixture.sql`DELETE FROM public.abastecimento WHERE id IN (92201,92202)`; }
    finally { await fixture.limpar(); }
  }
});

const get = (query = '', perfil: string | null = 'ADM') => fetch(base + query, {
  headers: perfil ? { Authorization: 'Bearer ' + fixture.tokens[perfil] } : {},
});

test('agrega 0, 1 e 3 registros SVO em datas civis, sem inferir distância de km repetidos ou regressivos', async () => {
  const vazio = await get('?veiculoId=92194&inicio=2097-04-01&fim=2097-04-30');
  expect(vazio.status).toBe(200);
  expect((await vazio.json()).data).toMatchObject({ estado:'SEM_ABASTECIMENTOS',
    quantidade:0, totalLitros:'0.00', totalCusto:'0.00', custoPorLitro:null,
    periodoObservado:{ inicio:null, fim:null }, kmObservadosPorVeiculo:[] });

  await fixture.sql`UPDATE public.abastecimento SET data_abastecimento='2097-04-10' WHERE id=92194`;
  const filtro = '?veiculoId=92194&inicio=2097-04-10&fim=2097-04-12';
  expect((await (await get(filtro)).json()).data).toMatchObject({
    estado:'DISPONIVEL', quantidade:1, totalLitros:'10.00', totalCusto:'60.00',
  });

  await fixture.sql`INSERT INTO public.abastecimento
    (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento) VALUES
    (92201,92194,92199,20.00,120.00,1000,'2097-04-11'),
    (92202,92194,92199,5.00,30.00,0,'2097-04-12')`;
  await fixture.sql`UPDATE public.abastecimento SET data_abastecimento='2097-04-11' WHERE id=92195`;

  const response = await get(filtro, 'GESTOR_FROTA');
  expect(response.status).toBe(200);
  const { data } = await response.json();
  const [persistido] = await fixture.sql`SELECT count(*)::int AS quantidade,
    sum(litragem)::text AS "totalLitros", sum(valor_total)::text AS "totalCusto"
    FROM public.abastecimento WHERE veiculo_id=92194 AND data_abastecimento BETWEEN '2097-04-10' AND '2097-04-12'`;
  expect(data).toMatchObject({ ...persistido, quantidade:3, totalLitros:'35.00', totalCusto:'210.00', custoPorLitro:'6.0000',
    periodoObservado:{ inicio:'2097-04-10', fim:'2097-04-12' },
    kmObservadosPorVeiculo:[{ veiculoId:'92194', leiturasComKm:3, leiturasSemKm:0, menorKm:0, maiorKm:1000 }],
    consumoPorDistancia:{ valor:null, estado:'INDISPONIVEL', motivo:'REGRA_DE_NEGOCIO_PENDENTE' },
  });
  expect((await (await get('?inicio=2097-04-10&fim=2097-04-12')).json()).data.quantidade).toBe(4);
  const painel = await fetch(base.replace('/abastecimentos/indicadores', '/dashboard')
    + '?periodo=personalizado&inicio=2097-04-10T12:00:00-03:00&fim=2097-04-12T00:00:00-03:00',
    { headers: { Authorization: 'Bearer ' + fixture.tokens.ADM } });
  expect(painel.status).toBe(200);
  const comparacao = await get('?inicio=2097-04-10&fim=2097-04-11');
  expect((await painel.json()).data.abastecimentos).toEqual((await comparacao.json()).data);
  if (process.env.CI) console.info('SCRUM-188 HTTP/SQL', response.status, persistido, data.consumoPorDistancia);
});

test('rejeita sessão ausente, perfis externos, datas inválidas, parâmetros duplicados e veículo inexistente', async () => {
  expect((await get('', null)).status).toBe(401);
  for (const perfil of ['MOTORISTA','ATENDENTE_SVO','SOLICITANTE_INTERNO']) {
    expect((await get('', perfil)).status).toBe(403);
  }
  expect((await get('?veiculoId=999999999')).status).toBe(404);
  for (const query of ['?inicio=2097-02-29','?inicio=2097-04-10&fim=2097-04-01',
    '?veiculoId=9223372036854775808','?inicio=2097-01-01&inicio=2097-01-02','?extra=x']) {
    expect((await get(query)).status).toBe(400);
  }
});
