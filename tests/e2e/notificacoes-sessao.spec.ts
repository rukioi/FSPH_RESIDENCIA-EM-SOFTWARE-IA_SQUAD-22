import { expect, test } from '@playwright/test';

const usuario = { id: '42', nome: 'Gestora', email: 'gestora@example.invalid', perfil: 'GESTOR_FROTA' };

test('aguarda sessao e rota antes de consultar notificacoes, inclusive ao navegar e sair', async ({ page }) => {
  await page.addInitScript(() => { if (location.pathname !== '/login') sessionStorage.setItem('token', 'fixture-confirmacao'); });
  let liberar: (() => void) | undefined;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  let sessoes = 0, sincronizacoes = 0, consultas = 0;
  await page.route('**/api/auth/sessao', async route => { sessoes++; await espera; await route.fulfill({ json: { data: usuario } }); });
  await page.route('**/api/notificacoes/sincronizar', route => { sincronizacoes++; return route.fulfill({ json: { data: { atualizadas: 0 } } }); });
  await page.route(url => url.pathname === '/api/notificacoes', route => { consultas++; return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } }); });
  await page.route('**/api/dashboard/**', route => route.fulfill({ status: 503, json: { error: { message: 'Fixture indisponivel' } } }));
  await page.route('**/api/solicitacoes-viagem/agenda?*', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0 } } }));
  await page.goto('/gestor/dashboard');
  await expect.poll(() => sessoes).toBeGreaterThan(0);
  await expect(page.getByRole('status', { name: 'Carregando página' })).toBeVisible();
  expect(sincronizacoes).toBe(0); expect(consultas).toBe(0);
  liberar?.();
  await expect.poll(() => consultas).toBeGreaterThan(0);
  expect(sincronizacoes).toBe(1);
  expect(consultas).toBe(1);
  const anterior = consultas;
  await page.goto('/gestor/calendario');
  await expect.poll(() => consultas).toBeGreaterThan(anterior);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
});

test('sessao invalida nao inicia notificacoes e redireciona', async ({ page }) => {
  await page.addInitScript(() => { if (location.pathname !== '/login') sessionStorage.setItem('token', 'fixture-invalida'); });
  let chamadas = 0;
  await page.route('**/api/auth/sessao', route => route.fulfill({ status: 401, json: { error: { code: 'NAO_AUTENTICADO', message: 'Sessao invalida' } } }));
  await page.route(url => url.pathname.startsWith('/api/notificacoes'), route => { chamadas++; return route.fulfill({ status: 500 }); });
  await page.goto('/gestor/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  expect(chamadas).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
});

test('401 de notificacoes depois da sessao confirmada encerra a sessao', async ({ page }) => {
  await page.addInitScript(() => { if (location.pathname !== '/login') sessionStorage.setItem('token', 'fixture-expirada'); });
  let chamadas = 0;
  await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: usuario } }));
  await page.route('**/api/notificacoes/sincronizar', route => { chamadas++; return route.fulfill({ status: 401, json: { error: { code: 'NAO_AUTENTICADO', message: 'Sessao expirada' } } }); });
  await page.route('**/api/dashboard/**', route => route.fulfill({ status: 503, json: { error: { message: 'Fixture indisponivel' } } }));
  await page.goto('/gestor/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  expect(chamadas).toBeGreaterThan(0);
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
});

test('logout cancela sincronizacao pendente e nao carrega caixa da sessao anterior', async ({ page }) => {
  await page.addInitScript(() => { if (location.pathname !== '/login') sessionStorage.setItem('token', 'fixture-cancelamento'); });
  let liberar: (() => void) | undefined;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  let sincronizacoes = 0, consultas = 0;
  await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: usuario } }));
  await page.route('**/api/notificacoes/sincronizar', async route => {
    sincronizacoes++;
    await espera;
    try { await route.fulfill({ json: { data: { atualizadas: 0 } } }); } catch { /* requisicao cancelada ao sair */ }
  });
  await page.route(url => url.pathname === '/api/notificacoes', route => { consultas++; return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } }); });
  await page.route('**/api/dashboard/**', route => route.fulfill({ status: 503, json: { error: { message: 'Fixture indisponivel' } } }));
  await page.goto('/gestor/dashboard');
  await expect.poll(() => sincronizacoes).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  liberar?.();
  await page.waitForTimeout(250);
  expect(consultas).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
});
