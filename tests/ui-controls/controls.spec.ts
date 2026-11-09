import { expect, test } from '@playwright/test';

const url = '/tests/ui-controls/fixture.html';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2024-02-15T12:00:00'));
  await page.goto(url);
});

test('data civil valida digitação, limites e envio ISO', async ({ page }) => {
  const date = page.getByLabel('Data', { exact: true });
  await date.fill('29022024');
  await expect(date).toHaveValue('29/02/2024');
  await expect(page.locator('input[name="data"]')).toHaveValue('2024-02-29');
  await date.fill('29022023');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  expect(await date.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await date.fill('01012024');
  expect(await date.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await date.fill('29022024');
  await page.getByRole('combobox', { name: 'Escolha', exact: true }).click();
  await page.getByRole('option', { name: 'Alfa' }).click();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByLabel('Resultado')).toContainText('"data":"2024-02-29"');
  await expect(page.getByLabel('Resultado')).toContainText('"escolha":"a"');
});

test('calendário respeita limites e teclado', async ({ page }) => {
  const date = page.getByLabel('Data', { exact: true });
  await page.getByRole('button', { name: 'Abrir calendário' }).first().click();
  const calendar = page.getByRole('dialog', { name: 'Escolher data' });
  await expect(calendar).toBeVisible();
  await expect(calendar.locator('[data-data="2024-01-31"]')).toBeDisabled();
  await calendar.locator('[data-data="2024-02-28"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(calendar.locator('[data-data="2024-02-29"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(date).toHaveValue('29/02/2024');
  await expect(page.locator('input[name="data"]')).toHaveValue('2024-02-29');
  await page.getByRole('button', { name: 'Abrir calendário' }).first().click();
  await page.keyboard.press('Escape');
  await expect(calendar).toHaveCount(0);
  await expect(date).toBeFocused();
});

test('select mantém validação nativa, teclado, typeahead, reset e fieldset', async ({ page }) => {
  const choice = page.getByRole('combobox', { name: 'Escolha', exact: true });
  const controlled = page.getByRole('combobox', { name: 'Controlado' });
  await page.getByLabel('Data', { exact: true }).fill('29022024');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(choice).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(choice).toContainText('Delta');
  await expect(page.locator('select[name="escolha"]')).toHaveValue('d');
  await controlled.focus();
  await page.keyboard.type('Al');
  await page.keyboard.press('Enter');
  await expect(controlled).toContainText('Alfa');
  const implicit = page.getByRole('combobox', { name: 'Escolha implícita' });
  await implicit.click();
  await page.getByRole('option', { name: 'Brisa' }).click();
  await expect(implicit).toContainText('Brisa');
  const controlledDate = page.getByLabel('Data controlada');
  await controlledDate.fill('16022024');
  await expect(page.locator('input[name="data-controlada"]')).toHaveValue('2024-02-16');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByLabel('Resultado')).toContainText('"controlado":"a"');
  await expect(page.getByLabel('Resultado')).toContainText('"data-controlada":"2024-02-16"');
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await expect(choice).toContainText('Selecione');
  await expect(controlled).toContainText('Brisa');
  await expect(controlledDate).toHaveValue('15/02/2024');
  await expect(page.getByLabel('Data', { exact: true })).toHaveValue('');
  const disabled = page.getByRole('combobox', { name: 'Campo bloqueável' });
  await page.getByRole('button', { name: 'Alternar bloqueio' }).click();
  await expect(disabled).toBeDisabled();
  await page.getByRole('button', { name: 'Alternar bloqueio' }).click();
  await expect(disabled).toBeEnabled();
  await choice.click();
  await page.keyboard.press('Escape');
  await expect(choice).toHaveAttribute('aria-expanded', 'false');
  await choice.click();
  await page.keyboard.press('Tab');
  await expect(choice).toHaveAttribute('aria-expanded', 'false');
});

for (const width of [390, 768, 1280]) {
  test(`controles em modal e viewport ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Abrir modal' }).click();
    const modal = page.getByRole('dialog', { name: '' });
    await modal.getByRole('button', { name: 'Abrir calendário' }).click();
    const calendar = page.getByRole('dialog', { name: 'Escolher data' });
    await expect(calendar).toBeVisible();
    const box = await calendar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
    await page.screenshot({ path: info.outputPath(`calendario-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
    await modal.getByRole('combobox', { name: 'Escolha no modal' }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.screenshot({ path: info.outputPath(`select-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(modal).toBeVisible();
  });
}
