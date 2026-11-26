import { createServer } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import handler from '../../../api/index.js';
import { processarAlertasManutencao } from '../../src/modules/manutencoes/manutencoes.alertas.js';

vi.mock('../../src/modules/manutencoes/manutencoes.alertas.js', () => ({
  processarAlertasManutencao: vi.fn(async () => ({ emitidas: 2, falhas: 0, adiadas: 0, restantes: false })),
}));

const server = createServer(handler);
const segredo = 'fixture-cron-manual-test';
const path = '/api/cron/manutencao-alertas';
let origin: string;

beforeAll(async () => {
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Servidor de teste sem porta.');
  origin = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
});
beforeEach(() => {
  vi.stubEnv('CRON_SECRET', segredo);
  vi.stubEnv('MANUTENCAO_ALERTAS_ATIVOS', 'true');
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

function chamar(authorization?: string, method = 'GET') {
  return fetch(origin + path, { method, headers: authorization ? { authorization } : {} });
}

test.each([undefined, 'conta-comum', 'Bearer errado'])('recusa autorização %s', async authorization => {
  expect((await chamar(authorization)).status).toBe(401);
  expect(processarAlertasManutencao).not.toHaveBeenCalled();
});

test('recusa configuração sem segredo e método diferente de GET', async () => {
  vi.stubEnv('CRON_SECRET', undefined);
  const method = await chamar('Bearer ' + segredo, 'POST');
  expect(method.status).toBe(405);
  expect(method.headers.get('allow')).toBe('GET');
  expect((await chamar('Bearer ' + segredo)).status).toBe(401);
  expect(processarAlertasManutencao).not.toHaveBeenCalled();
});

test.each([undefined, 'false'])('flag %s desativa o cron sem consultar o banco', async flag => {
  vi.stubEnv('MANUTENCAO_ALERTAS_ATIVOS', flag);
  const response = await chamar('Bearer ' + segredo);
  expect(response.status).toBe(204);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(processarAlertasManutencao).not.toHaveBeenCalled();
});

test('chamada autorizada invoca somente o emissor de manutenção', async () => {
  const response = await chamar('Bearer ' + segredo);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ emitidas: 2, falhas: 0, adiadas: 0, restantes: false });
  expect(processarAlertasManutencao).toHaveBeenCalledOnce();
});

test('falha do emissor retorna erro genérico', async () => {
  vi.mocked(processarAlertasManutencao).mockRejectedValueOnce(new Error('detalhe interno'));
  const response = await chamar('Bearer ' + segredo);
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain('detalhe interno');
});

test.each([
  { emitidas: 4, falhas: 1, adiadas: 0, restantes: false },
  { emitidas: 4, falhas: 0, adiadas: 1, restantes: false },
  { emitidas: 4, falhas: 0, adiadas: 0, restantes: true },
])('cron sinaliza execução parcial sem detalhes internos: %j', async resultado => {
  vi.mocked(processarAlertasManutencao).mockResolvedValueOnce(resultado);
  const response = await chamar('Bearer ' + segredo);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual(resultado);
});
