import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { criarJwt } from '../../src/security/jwt.js';
import { respostaRelatorioSchema } from '../../src/modules/relatorios/relatorios.schemas.js';
import { prepararRelatoriosS10 } from './relatorios-s10.fixture.js';

const server = createApp();
let fixture: Awaited<ReturnType<typeof prepararRelatoriosS10>>;
let base: string;
let gestor: string;
let svo: string;
beforeAll(async () => {
  fixture = await prepararRelatoriosS10();
  gestor = await criarJwt({ id: '-27002', perfil: 'GESTOR_FROTA' });
  svo = await criarJwt({ id: '-27005', perfil: 'ATENDENTE_SVO' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  try { if (fixture) await fixture.limpar(); } finally { await fecharBanco(); }
});
async function consultar(tipo: string, extra = '', token = gestor) {
  return fetch(`${base}/api/${tipo === 'svo' ? 'svo/' : ''}relatorios?tipo=${tipo}&inicio=2097-05-01&fim=2097-05-03&veiculoId=7250001${extra}`, { headers: { Authorization: `Bearer ${token}` } });
}
test.each([
  ['viagens', 60], ['motoristas', 60], ['solicitacoes', 60], ['veiculos', 60], ['ocorrencias', 1], ['abastecimentos', 1], ['svo', 1],
])('%s retorna somente as linhas persistidas do recorte (%i)', async (tipo, total) => {
  const response = await consultar(String(tipo), '', tipo === 'svo' ? svo : gestor);
  expect(response.status).toBe(200);
  const { data } = respostaRelatorioSchema.parse(await response.json());
  expect(data.linhas).toHaveLength(Number(total));
  expect(data.resumo.registros).toBe(Number(total));
  expect(data.linhas.every(row => row.placa === 'REL5A10')).toBe(true);
  if (tipo === 'abastecimentos') expect(data.linhas[0]).toMatchObject({ litros: '10.25', valor: '60.99', odometro: 110 });
  if (tipo === 'svo') {
    expect(data.resumo.kmConcluidos).toBe(10);
    expect(data.linhas[0]).not.toHaveProperty('nome_falecido');
  }
});
test('SQL, zero, null e resumo não confundem odômetro com distância', async () => {
  const { data } = respostaRelatorioSchema.parse(await (await consultar('viagens')).json());
  const [db] = await fixture.sql`SELECT sum(km_final-km_inicial)::int AS km FROM public.viagem WHERE veiculo_id=7250001 AND status='CONCLUIDA'`;
  expect(data.resumo.kmConcluidos).toBe(db.km);
  expect(data.resumo.kmConcluidos).toBe(580);
  expect(data.linhas.find(row => row.codigo === 'S10-REL-1')!.kmPercorridos).toBeNull();
  expect(data.linhas.find(row => row.codigo === 'S10-REL-2')!.kmPercorridos).toBe(0);
  const pendente = respostaRelatorioSchema.parse(await (await consultar('viagens', '&status=AGENDADA')).json());
  expect(pendente.data.resumo).toEqual({ registros: 1, kmConcluidos: null, semQuilometragem: 0 });
  const vazio = respostaRelatorioSchema.parse(await (await consultar('viagens', '&motoristaId=999999999')).json());
  expect(vazio.data.resumo.registros).toBe(0);
  expect(vazio.data.resumo.kmConcluidos).toBeNull();
});
test.each([
  ['2096-01-01', '2096-12-31', 200], ['2096-01-01', '2097-01-01', 400],
  ['2097-05-03', '2097-05-01', 400], ['2097-02-30', '2097-03-01', 400],
])('período %s a %s responde %i', async (inicio, fim, status) => {
  const response = await fetch(`${base}/api/relatorios?tipo=viagens&inicio=${inicio}&fim=${fim}`, { headers: { Authorization: `Bearer ${gestor}` } });
  expect(response.status).toBe(status);
});
test('status incompatível e acesso cruzado são recusados na API', async () => {
  expect((await consultar('abastecimentos', '&status=CONCLUIDA')).status).toBe(400);
  expect((await consultar('svo', '', gestor)).status).toBe(403);
  expect((await consultar('viagens', '', svo)).status).toBe(403);
});
test('5001 registros reais retornam 422 em vez de truncamento', async () => {
  await fixture.sql`INSERT INTO public.solicitacao_viagem(id,codigo,origem,destino,data_hora_saida)
    SELECT 7260000+n,'S10-LIM-'||n,'Fixture limite','Fixture limite',timestamp '2097-06-01 08:00' FROM generate_series(1,5001) n`;
  try {
    const response = await fetch(`${base}/api/relatorios?tipo=solicitacoes&inicio=2097-06-01&fim=2097-06-01`, { headers: { Authorization: `Bearer ${gestor}` } });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: { code: 'RELATORIO_MUITO_GRANDE' } });
  } finally { await fixture.sql`DELETE FROM public.solicitacao_viagem WHERE id BETWEEN 7260001 AND 7265001`; }
});
