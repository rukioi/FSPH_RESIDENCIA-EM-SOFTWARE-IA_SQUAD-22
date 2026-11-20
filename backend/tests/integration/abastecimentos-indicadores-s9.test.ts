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
    try { await fixture.sql`DELETE FROM public.abastecimento WHERE veiculo_id IN (92194,92195) AND (id IN (92201,92202) OR id BETWEEN 92211 AND 92220)`; }
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
    consumoPorDistancia:{ estado:'DADOS_INSUFICIENTES', valor:null, trechosValidos:0, porVeiculo:[] },
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
    consumoPorDistancia:{ valor:null, estado:'DADOS_INSUFICIENTES', motivo:'SEM_TRECHO_VALIDO' },
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

test('cheio a cheio inclui parciais, pondera os trechos e nunca cruza os veículos', async () => {
  await fixture.sql`INSERT INTO public.abastecimento
    (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,tanque_completo) VALUES
    (92211,92194,92199,99,594,1000,'2096-01-01',true),
    (92212,92194,92199,10,60,1100,'2096-01-02',false),
    (92213,92194,92199,20,120,1300,'2096-01-03',true),
    (92214,92194,92199,15,90,1350,'2096-01-04',false),
    (92215,92194,92199,5,30,1400,'2096-01-05',true),
    (92216,92194,92199,10,60,1390,'2096-01-06',false),
    (92217,92194,92199,10,60,1500,'2096-01-07',true),
    (92218,92194,92199,20,120,1500,'2096-01-08',true),
    (92219,92195,92200,35,210,2000,'2096-01-02',true),
    (92220,92195,92200,40,240,2200,'2096-01-04',true)`;

  const primeiraJanela = await get('?inicio=2096-01-01&fim=2096-01-03&veiculoId=92194');
  expect(primeiraJanela.status).toBe(200);
  expect((await primeiraJanela.json()).data.consumoPorDistancia).toMatchObject({
    unidade:'km/L', estado:'DISPONIVEL', valor:'10.0000', trechosValidos:1,
  });
  for (const periodo of ['inicio=2096-01-02&fim=2096-01-03','inicio=2096-01-05&fim=2096-01-08']) {
    expect((await (await get('?' + periodo + '&veiculoId=92194')).json()).data.consumoPorDistancia)
      .toMatchObject({estado:'DADOS_INSUFICIENTES',valor:null,motivo:'SEM_TRECHO_VALIDO',trechosValidos:0});
  }

  const resposta = await get('?inicio=2096-01-01&fim=2096-01-08');
  expect(resposta.status).toBe(200);
  const {consumoPorDistancia: consumo} = (await resposta.json()).data;
  const [trechos] = await fixture.sql`SELECT
    ((max(quilometragem) FILTER (WHERE id=92215))-(max(quilometragem) FILTER (WHERE id=92211)))::int AS "kmA",
    (sum(litragem) FILTER (WHERE id BETWEEN 92212 AND 92215))::text AS "litrosA",
    ((max(quilometragem) FILTER (WHERE id=92220))-(max(quilometragem) FILTER (WHERE id=92219)))::int AS "kmB",
    (sum(litragem) FILTER (WHERE id=92220))::text AS "litrosB"
    FROM public.abastecimento WHERE id BETWEEN 92211 AND 92220`;
  expect(trechos).toEqual({kmA:400,litrosA:'50.00',kmB:200,litrosB:'40.00'});
  expect(consumo).toEqual({ estado:'DISPONIVEL', valor:'6.6667', motivo:null, trechosValidos:3, unidade:'km/L',
    porVeiculo:[
      {veiculoId:'92194',estado:'DISPONIVEL',valor:'8.0000',motivo:null,trechosValidos:2},
      {veiculoId:'92195',estado:'DISPONIVEL',valor:'5.0000',motivo:null,trechosValidos:1},
    ],
  });
  const painel = await fetch(base.replace('/abastecimentos/indicadores', '/dashboard')
    + '?periodo=personalizado&inicio=2096-01-01T00:00:00-03:00&fim=2096-01-09T00:00:00-03:00',
    { headers: { Authorization: 'Bearer ' + fixture.tokens.ADM } });
  expect(painel.status).toBe(200);
  expect((await painel.json()).data.abastecimentos.consumoPorDistancia).toEqual(consumo);
  if (process.env.CI) console.info('SCRUM-188 cheio a cheio HTTP/SQL', resposta.status, trechos, {
    kmPorLitro: consumo.valor, trechosValidos: consumo.trechosValidos, painel: painel.status,
  });
});

test('quilometragem ausente preserva insuficiência sem criar média fictícia', async () => {
  try {
    await fixture.sql`INSERT INTO public.abastecimento
      (id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,tanque_completo) VALUES
      (92221,92194,null,10,60,1000,'2095-01-01',true),
      (92222,92194,null,10,60,null,'2095-01-02',false),
      (92223,92194,null,10,60,1200,'2095-01-03',true)`;
    const response=await get('?inicio=2095-01-01&fim=2095-01-03&veiculoId=92194');
    expect(response.status).toBe(200);
    const data=(await response.json()).data;
    expect(data.kmObservadosPorVeiculo).toMatchObject([{leiturasComKm:2,leiturasSemKm:1}]);
    expect(data.consumoPorDistancia).toMatchObject({estado:'DADOS_INSUFICIENTES',valor:null,trechosValidos:0});
  } finally {
    await fixture.sql`DELETE FROM public.abastecimento WHERE id IN (92221,92222,92223)`;
  }
});
