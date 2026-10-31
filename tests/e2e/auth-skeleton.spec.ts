import { expect, test } from '@playwright/test';

const usuario = { id: '42', nome: 'Fixture Skeleton', email: 'skeleton@example.invalid', perfil: 'ADM' };
const rotas = [
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/configuracoes', 'Configurações'],
  ['/admin/auditoria', 'Auditoria'],
  ['/gestor/dashboard', 'Dashboard'],
  ['/gestor/veiculos', 'Veículos'],
  ['/gestor/motoristas', 'Motoristas'],
  ['/svo', 'Dashboard SVO'],
] as const;

for (const width of [390, 768, 1280]) {
  test(`skeleton aguarda a sessão sem montar conteúdo privado em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-skeleton-token'));
    const consultas: string[] = [];
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      consultas.push(new URL(route.request().url()).pathname);
      if (!route.request().url().endsWith('/api/auth/sessao')) {
        await route.fulfill({ json: [] });
        return;
      }
      // Mantém a consulta pendente até a navegação seguinte cancelar a requisição.
    });
    for (const [rota] of rotas) {
      await page.goto(rota);
      const skeleton = page.getByRole('status', { name: 'Carregando página' });
      await expect(skeleton, `Skeleton da rota ${rota}`).toBeVisible();
      await expect(skeleton).toHaveAttribute('aria-busy', 'true');
      await expect(page.getByText('Verificando autenticação...')).toHaveCount(0);
      await expect(page.getByRole('heading')).toHaveCount(0);
      await expect(page.getByRole('button')).toHaveCount(0);
      await expect(page.getByText(usuario.nome)).toHaveCount(0);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(consultas.every(path => path === '/api/auth/sessao')).toBe(true);
      if (rota === '/admin/auditoria') {
        await info.attach(`skeleton-${width}`, {
          body: await page.screenshot({ path: info.outputPath(`skeleton-${width}.png`), fullPage: true }),
          contentType: 'image/png',
        });
      }
      // Aborta a navegação pendente antes da próxima rota; nenhuma página privada é liberada.
    }
  });
}

test('skeleton dá lugar à página somente após confirmar a sessão e reaparece ao navegar', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-skeleton-token'));
  let liberar: (() => void) | undefined;
  await page.route('**/api/auth/sessao', async route => {
    await new Promise<void>(resolve => { liberar = resolve; });
    await route.fulfill({ json: { data: usuario } });
  });
  await page.goto('/admin/auditoria');
  await expect(page.getByRole('status', { name: 'Carregando página' })).toBeVisible();
  await expect.poll(() => Boolean(liberar)).toBe(true);
  liberar?.();
  await expect(page.getByRole('heading', { name: 'Auditoria', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Carregando página' })).toHaveCount(0);
  liberar = undefined;
  await page.getByRole('link', { name: 'Configurações' }).click();
  await expect(page.getByRole('status', { name: 'Carregando página' })).toBeVisible();
  await expect(page.getByRole('heading')).toHaveCount(0);
  await expect.poll(() => Boolean(liberar)).toBe(true);
  liberar?.();
  await expect(page.getByRole('heading', { name: 'Configurações', exact: true })).toBeVisible();
});

for (const falha of ['401', 'rede']) {
  test(`sessão com falha ${falha} remove skeleton e volta ao login`, async ({ page }) => {
    await page.addInitScript(() => {
      if (location.pathname !== '/login') sessionStorage.setItem('token', 'fixture-skeleton-token');
    });
    let liberar: (() => void) | undefined;
    await page.route('**/api/auth/sessao', async route => {
      await new Promise<void>(resolve => { liberar = resolve; });
      if (falha === 'rede') await route.abort();
      else await route.fulfill({ status: 401, json: { error: { code: 'NAO_AUTENTICADO', message: 'Autenticação necessária.' } } });
    });
    await page.goto('/admin/auditoria');
    await expect(page.getByRole('status', { name: 'Carregando página' })).toBeVisible();
    await expect.poll(() => Boolean(liberar)).toBe(true);
    liberar?.();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Carregando página' })).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
  });
}

test('sessão sem permissão redireciona sem revelar a página solicitada', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-skeleton-token'));
  await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: { ...usuario, perfil: 'GESTOR_FROTA' } } }));
  await page.goto('/admin/auditoria');
  await expect(page).toHaveURL(/\/gestor\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Auditoria', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Carregando página' })).toHaveCount(0);
});

test('movimento reduzido mantém o skeleton estático', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-skeleton-token'));
  await page.route('**/api/auth/sessao', () => {});
  await page.goto('/admin/auditoria');
  await expect(page.getByRole('status', { name: 'Carregando página' })).toBeVisible();
  const animations = await page.locator('.auth-skeleton__bloco').evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).animationName));
  expect(animations.length).toBeGreaterThan(0);
  expect(animations.every(name => name === 'none')).toBe(true);
});
