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
