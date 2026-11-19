import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { falharAuditoriaAnexo, pngAnexo, prepararAnexos } from '../helpers/anexos-fixture.js';

const server = createApp();
let fixture: Awaited<ReturnType<typeof prepararAnexos>>;
let base: string;
const entrada = { veiculo_id: 92194, motorista_id: 92199, litragem: '10.50', valor_total: '63.00',
  quilometragem: 1000, data_abastecimento: '2026-11-13', posto: 'Fixture cadastro BE-S9-01' };

beforeAll(async () => {
  fixture = await prepararAnexos();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await fixture.limparUploads();
  await fixture.sql`DELETE FROM abastecimento WHERE veiculo_id=92194 AND posto=${entrada.posto}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await fixture?.limpar();
});
function cadastrar(body: unknown = entrada, ator = 'ADM') {
  return fetch(base + '/api/abastecimentos', { method: 'POST',
    headers: { Authorization: `Bearer ${fixture.tokens[ator]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });
}

for (const campo of ['litragem', 'valor_total']) {
  test.each([-1, '-1', 0, '0'])(`${campo} não positivo recebe 400 antes da persistência: %s`, async valor => {
    const response = await cadastrar({ ...entrada, [campo]: valor });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('DADOS_INVALIDOS');
    expect(await fixture.sql`SELECT id FROM abastecimento WHERE posto=${entrada.posto}`).toHaveLength(0);
    expect(await fixture.sql`SELECT id FROM log_atividade WHERE usuario_id=92194`).toHaveLength(0);
  });
}

test.each(['ADM', 'GESTOR_FROTA'])('cadastro SVO persiste valores exatos e audita o ator real %s, sem aceitar autoria do corpo', async ator => {
  const response = await cadastrar({ ...entrada, criado_por_id: 92197, usuario_id: 92197 }, ator);
  expect(response.status).toBe(201);
  const { data } = await response.json();
  const [registro] = await fixture.sql`SELECT veiculo_id,quilometragem,litragem,valor_total FROM abastecimento WHERE id=${data.id}`;
  expect(registro).toEqual({ veiculo_id: '92194', quilometragem: 1000, litragem: '10.50', valor_total: '63.00' });
  const atividades = await fixture.sql`SELECT usuario_id,tipo_evento,descricao,data_hora FROM log_atividade
    WHERE tipo_evento='abastecimento_criado' AND descricao=${`Registrou abastecimento ID ${data.id}`}`;
  expect(atividades).toHaveLength(1);
  expect(atividades[0]).toMatchObject({ usuario_id: ator === 'ADM' ? '92194' : '92195',
    tipo_evento: 'abastecimento_criado', descricao: `Registrou abastecimento ID ${data.id}`, data_hora: expect.any(Date) });
  expect(JSON.stringify(atividades)).not.toContain(entrada.posto);
  for (let consulta = 0; consulta < 2; consulta++) {
    const detalhe = await fetch(base + `/api/abastecimentos/${data.id}`, {
      headers: { Authorization: `Bearer ${fixture.tokens[ator]}` } });
    expect(detalhe.status).toBe(200);
    expect((await detalhe.json()).data).toMatchObject(registro);
  }
});

test.each([undefined, null])('motorista ausente/nulo é persistido como null e auditado: %s', async motorista_id => {
  const response = await cadastrar({ ...entrada, motorista_id });
  expect(response.status).toBe(201);
  const { data } = await response.json();
  expect(data.motorista_id).toBeNull();
  const [row] = await fixture.sql`SELECT motorista_id FROM abastecimento WHERE id=${data.id}`;
  expect(row.motorista_id).toBeNull();
  const atividades = await fixture.sql`SELECT usuario_id FROM log_atividade WHERE tipo_evento='abastecimento_criado'
    AND descricao=${`Registrou abastecimento ID ${data.id}`}`;
  expect(atividades).toEqual([{ usuario_id: '92194' }]);
});
test('falha real da auditoria reverte cadastro e comprovante legado; a próxima requisição funciona', async () => {
  await falharAuditoriaAnexo(fixture.admin, async () => {
    const response = await cadastrar({ ...entrada, comprovante: {
      nome: 'comprovante.png', tipo: 'image/png', dadosBase64: pngAnexo.toString('base64') } });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/SQL|stack|fixture|BE-S9-01/);
    expect(await fixture.sql`SELECT id FROM abastecimento WHERE posto=${entrada.posto}`).toHaveLength(0);
    expect(await fixture.sql`SELECT c.abastecimento_id FROM abastecimento_comprovante c
      JOIN abastecimento a ON a.id=c.abastecimento_id WHERE a.veiculo_id=92194`).toHaveLength(0);
    expect(await fixture.sql`SELECT id FROM log_atividade WHERE usuario_id=92194`).toHaveLength(0);
  });
  expect((await cadastrar()).status).toBe(201);
});
