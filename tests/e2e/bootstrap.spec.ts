import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1280]) {
  test(`a aplicação inicia sem rolagem horizontal em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Gestão de Frota e Transporte' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const screenshot = await page.screenshot({ path: testInfo.outputPath(`preview-${width}.png`), fullPage: true });
    await testInfo.attach(`preview-${width}`, { body: screenshot, contentType: 'image/png' });
  });
}

test('o proxy de desenvolvimento alcança o backend', async ({ request }) => {
  const response = await request.get('/api/usuarios');
  expect(response.status()).toBe(404);
  expect(await response.text()).toBe('Não encontrado.');
});

test('o proxy encaminha KPIs e preserva a exigência de autenticação', async ({ request }) => {
  const response = await request.get('/api/dashboard/kpis?periodo=7dias');
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: { code: 'NAO_AUTENTICADO' } });
});
