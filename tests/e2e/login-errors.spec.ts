import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1280]) {
  test(`login apresenta erro português para 404 textual em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/login', route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'The page could not be found' }));
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('E-mail', { exact: true }).fill('fixture@example.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('fixture-password');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('O serviço solicitado não foi encontrado. Tente novamente mais tarde.');
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => sessionStorage.getItem('token'))).toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`login-404-${width}.png`), fullPage: true });
  });
}

for (const width of [390, 768, 1280]) {
  test(`acesso de motorista mantém o formulário acessível em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Entrar como motorista' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Acesso do motorista' })).toBeVisible();
    await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await page.screenshot({ path: info.outputPath(`login-motorista-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Voltar ao acesso geral' }).click();
    await expect(page.getByRole('heading', { name: 'Acesse sua conta' })).toBeVisible();
  });
}

test('login de motorista redireciona para as notificações', async ({ page }) => {
  const usuario = { id: '42', nome: 'Motorista Teste', email: 'motorista@example.invalid', perfil: 'MOTORISTA' };
  await page.route('**/api/auth/login', route => route.fulfill({ json: { token: 'fixture-token', usuario } }));
  await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: usuario } }));
  await page.route('**/api/notificacoes/sincronizar', route => route.fulfill({ json: { data: { atualizadas: 0 } } }));
  await page.route(url => url.pathname === '/api/notificacoes', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } }));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Entrar como motorista' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(usuario.email);
  await page.getByLabel('Senha', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Entrar no portal' }).click();
  await expect(page).toHaveURL(/\/notificacoes$/);
});
