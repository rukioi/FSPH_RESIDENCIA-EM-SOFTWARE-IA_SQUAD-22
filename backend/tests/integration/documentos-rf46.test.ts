import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { vencimentosRf46 } from '../../src/modules/documentos/documentos.rf46.js';
import { prepararAnexos } from '../helpers/anexos-fixture.js';

const app = createApp();
let fixture: Awaited<ReturnType<typeof prepararAnexos>>;
let base: string;
beforeAll(async () => {
  fixture = await prepararAnexos();
  await new Promise<void>(resolve => app.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + (app.address() as AddressInfo).port;
});
afterAll(async () => {
  if (app.listening) await new Promise<void>(resolve => app.close(() => resolve()));
  if (fixture) {
    try { await fixture.sql`DELETE FROM public.notificacao WHERE usuario_id IN (92194,92195)`; }
    finally { await fixture.limpar(); }
  }
});

const call = (path: string, perfil: string | null = 'ADM', method = 'GET', body?: unknown) => fetch(base + path, {
  method, headers: {
    ...(perfil ? { Authorization: 'Bearer ' + fixture.tokens[perfil] } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test.each([
  ['2027-03-31', '2027-02-27', '2027-02-28'],
  ['2028-03-31', '2028-02-28', '2028-02-29'],
  ['2027-05-31', '2027-04-29', '2027-04-30'],
  ['2027-04-30', '2027-03-29', '2027-03-30'],
])('mês civil para %s usa o último dia disponível sem antecipar o alerta', async (validade, anterior, inicio) => {
  await fixture.sql.begin(async tx => {
    await tx`UPDATE public.documento_veiculo SET data_vencimento=${validade} WHERE id=92194`;
    const fases = async (data: string) => tx`SELECT fase FROM (${vencimentosRf46(tx,data)}) v
      WHERE id=92194 AND tipo='DOCUMENTO_VEICULO'`;
    expect(await fases(anterior)).toEqual([]);
    expect(await fases(inicio)).toEqual([{ fase:'MES' }]);
    const [dias] = await tx`SELECT to_char(${validade}::text::date-7,'YYYY-MM-DD') AS semana,
      to_char(${validade}::text::date+1,'YYYY-MM-DD') AS vencido`;
    expect(await fases(dias.semana)).toEqual([{ fase:'SEMANA' }]);
    expect(await fases(validade)).toEqual([{ fase:'HOJE' }]);
    expect(await fases(dias.vencido)).toEqual([{ fase:'VENCIDO' }]);
  });
});

test('API e caixa usam fases reais no SVO e deduplicam por destinatário e fase', async () => {
  await fixture.sql.begin(async tx => {
    const hoje = tx`(transaction_timestamp() AT TIME ZONE 'America/Maceio')::date`;
    await tx`UPDATE public.documento_veiculo SET data_vencimento=${hoje} WHERE id=92194`;
    await tx`UPDATE public.documento_veiculo SET data_vencimento=${hoje}+7 WHERE id=92195`;
    await tx`UPDATE public.motorista SET validade_cnh=${hoje}+15 WHERE id=92199`;
  });
  const url = '/api/documentos/alertas';
  expect((await call(url, null)).status).toBe(401);
  expect((await call(url, 'MOTORISTA')).status).toBe(403);
  for (const q of ['?tipo=OUTRO', '?limit=101', '?page=1&page=2', '?extra=1']) {
    expect((await call(url + q)).status).toBe(400);
  }

  const response = await call(url + '?limit=100', 'GESTOR_FROTA');
  expect(response.status).toBe(200);
  const {data,meta} = await response.json();
  expect(meta).toMatchObject({page:1,limit:100});
  expect(data).toEqual(expect.arrayContaining([
    expect.objectContaining({id:'92194',tipo:'DOCUMENTO_VEICULO',fase:'HOJE',diasRestantes:0}),
    expect.objectContaining({id:'92195',tipo:'DOCUMENTO_VEICULO',fase:'SEMANA',diasRestantes:7}),
    expect.objectContaining({id:'92199',tipo:'CNH_MOTORISTA',fase:'MES',diasRestantes:15}),
  ]));
  expect(JSON.stringify(data)).not.toContain('CNH-TESTE-92194');
  const cnh = await (await call(url + '?tipo=CNH_MOTORISTA&limit=1')).json();
  expect(cnh.data).toHaveLength(1);
  expect(cnh.data[0].tipo).toBe('CNH_MOTORISTA');

  const sync = () => call('/api/notificacoes/sincronizar', 'ADM', 'POST');
  const respostas = await Promise.all([sync(), sync()]);
  expect(respostas.map(r=>r.status)).toEqual([200,200]);
  const gravadas = await fixture.sql`SELECT split_part(chave,':',4) AS fase, count(*)::int AS total
    FROM public.notificacao WHERE usuario_id=92194 AND
    (chave LIKE 'documento:92194:%' OR chave LIKE 'documento:92195:%' OR chave LIKE 'cnh:92199:%')
    GROUP BY fase ORDER BY fase`;
  expect(gravadas).toEqual([{fase:'hoje',total:1},{fase:'mes',total:1},{fase:'semana',total:1}]);
  expect((await call('/api/notificacoes/sincronizar', 'GESTOR_FROTA', 'POST')).status).toBe(200);
  const [segundoDestinatario] = await fixture.sql`SELECT count(*)::int AS quantidade
    FROM public.notificacao WHERE usuario_id=92195 AND chave LIKE 'documento:92194:%:hoje'`;
  expect(segundoDestinatario.quantidade).toBe(1);
  expect((await call('/api/notificacoes/sincronizar', 'MOTORISTA', 'POST')).status).toBe(200);
  const alheias = await fixture.sql`SELECT id FROM public.notificacao WHERE usuario_id=92199 AND chave LIKE 'cnh:%'`;
  expect(alheias).toHaveLength(0);
  if(process.env.CI) console.info('SCRUM-193 RF46 HTTP/SQL', response.status, gravadas);
});

test('remoção de motorista com histórico de CNH retorna 409 e mantém versões', async () => {
  const editado = await call('/api/documentos/92199?tipo=CNH_MOTORISTA', 'ADM', 'PATCH', {
    versao:0, dataValidade:'2031-06-30',
  });
  expect(editado.status).toBe(200);
  const removido = await call('/api/motoristas/92199', 'ADM', 'DELETE');
  expect(removido.status).toBe(409);
  expect((await removido.json()).error.code).toBe('HISTORICO_CNH_EXISTENTE');
  const [row] = await fixture.sql`SELECT count(*)::int AS versoes FROM public.documento_historico WHERE motorista_id=92199`;
  expect(row.versoes).toBe(1);
  expect((await call('/api/documentos/92199?tipo=CNH_MOTORISTA')).status).toBe(200);
  if(process.env.CI) console.info('SCRUM-193 remoção protegida', removido.status, row);
});

test('remoção física de cadastro sem histórico e sem vínculos mantém o sucesso e a ausência 404', async () => {
  await fixture.sql`INSERT INTO public.motorista (id,nome,cnh,categoria_cnh,validade_cnh)
    VALUES (92201,'Fixture de remoção RF46','RF46-REMOVER-92201','B','2031-06-30')`;
  try {
    const response = await call('/api/motoristas/92201', 'ADM', 'DELETE');
    expect(response.status).toBe(200);
    expect((await response.json()).data.success).toBe(true);
    expect((await call('/api/motoristas/92201', 'ADM', 'DELETE')).status).toBe(404);
  } finally {
    await fixture.sql`DELETE FROM public.motorista WHERE id=92201`;
  }
});
