import { selecionarOpcao } from './fixtures/controls';
import { expect, test } from '@playwright/test';
import { verifiedSql } from '../../backend/src/database/scripts/verify-test-db.js';

let token: string;
let sql: Awaited<ReturnType<typeof verifiedSql>>;
const vehicleIds = [938001, 938002];
const driverId = 938001;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=', 'base64');

test.beforeAll(async ({ request }) => {
  await expect.poll(async () => (await request.get('/api/auth/sessao')).status(), { timeout: 20_000 }).toBe(401);
  const login = await request.post('/api/auth/login', { data: { email: 't1-adm@example.invalid', senha: 'T1-fixture-2026!' } });
  expect(login.status()).toBe(200);
  token = (await login.json()).token;
  sql = await verifiedSql();
  await sql`insert into veiculo (id, placa, marca, modelo, ano, tipo) values
    (938001, 'E2EA001', 'Fixture', 'Abastecimento A', 2026, 'PASSEIO'),
    (938002, 'E2EA002', 'Fixture', 'Abastecimento B', 2026, 'PASSEIO')`;
  await sql`insert into motorista (id, nome, cnh, categoria_cnh, validade_cnh)
    values (938001, 'Fixture E2E Abastecimento', '93800000001', 'B', '2099-01-01')`;
  await sql`insert into abastecimento (veiculo_id, motorista_id, litragem, valor_total, quilometragem, data_abastecimento, posto) values
    (938001, 938001, 10, 50, 1000, '2026-01-15', 'Fixture posto A'),
    (938002, 938001, 20, 120, 2000, '2026-02-15', 'Fixture posto B')`;
});

test.afterAll(async () => {
  if (!sql) return;
  try {
    await sql`delete from abastecimento_comprovante where abastecimento_id in (select id from abastecimento where veiculo_id in ${sql(vehicleIds)})`;
    await sql`delete from abastecimento where veiculo_id in ${sql(vehicleIds)}`;
    await sql`delete from motorista where id = ${driverId}`;
    await sql`delete from veiculo where id in ${sql(vehicleIds)}`;
  } finally { await sql.end(); }
});

for (const width of [390, 768, 1280]) {
  test(`abastecimentos consulta, filtra e registra em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.evaluate(value => sessionStorage.setItem('token', value), token);
    await page.goto('/gestor/abastecimentos');
    await expect(page.getByRole('heading', { name: 'Abastecimentos', exact: true })).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows.filter({ hasText: 'E2EA001' })).toBeVisible();
    await expect(rows.filter({ hasText: 'E2EA002' })).toBeVisible();
    await page.getByLabel('Período final').fill('2026-02-28');
    await selecionarOpcao(page.getByLabel('Filtrar por veículo'), String(vehicleIds[0]));
    await expect(rows.filter({ hasText: 'E2EA001' })).toBeVisible();
    await expect(rows.filter({ hasText: 'E2EA002' })).toHaveCount(0);
    await expect(page.locator('article').filter({ hasText: 'Registros' })).toContainText('1');
    await expect(page.locator('article').filter({ hasText: 'Litros abastecidos' })).toContainText('10 L');
    await expect(page.locator('article').filter({ hasText: 'Valor total' })).toContainText('50,00');
    await page.getByLabel('Período inicial').fill('2026-02-01');
    await expect(rows.filter({ hasText: 'E2EA001' })).toHaveCount(0);
    await page.getByLabel('Período inicial').fill('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`abastecimentos-${width}.png`), fullPage: true });

    const open = page.getByRole('button', { name: 'Registrar abastecimento' });
    await open.focus();
    await expect(open).toBeFocused();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await selecionarOpcao(dialog.getByLabel('Veículo', { exact: true }), String(vehicleIds[0]));
    await selecionarOpcao(dialog.getByLabel('Motorista', { exact: true }), String(driverId));
    await dialog.getByLabel('Data', { exact: true }).fill('2026-03-15');
    await dialog.getByLabel('Quilometragem', { exact: true }).fill(String(width));
    await dialog.getByLabel('Litros', { exact: true }).fill('15');
    await dialog.getByLabel('Valor total', { exact: true }).fill('90');
    await dialog.getByLabel('Tanque completo').check();
    await dialog.getByLabel('Comprovante').setInputFiles({ name: `comprovante-${width}.png`, mimeType: 'image/png', buffer: png });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`abastecimento-cadastro-${width}.png`), fullPage: true });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/abastecimentos', async route => {
      if (route.request().method() === 'POST') await gate;
      await route.continue();
    });
    try {
      await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: /registrando|salvando/i })).toBeDisabled();
      const rows = await sql`select id from abastecimento where veiculo_id = ${vehicleIds[0]} and quilometragem = ${width}`;
      expect(rows).toHaveLength(0);
    } finally { release(); }
    await expect(dialog).toBeHidden();
    const persisted = await sql`select id, motorista_id, quilometragem, litragem, valor_total, tanque_completo from abastecimento where veiculo_id = ${vehicleIds[0]} and quilometragem = ${width}`;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ motorista_id: String(driverId), quilometragem: width, litragem: '15.00', valor_total: '90.00', tanque_completo: true });
    const [receipt] = await sql`select nome, tipo, dados from abastecimento_comprovante where abastecimento_id = ${persisted[0].id}`;
    expect(receipt.nome).toBe(`comprovante-${width}.png`);
    expect(receipt.tipo).toBe('image/png');
    expect(Buffer.from(receipt.dados)).toEqual(png);
    await page.getByLabel('Período final').fill('');
    const newRow = rows.filter({ hasText: 'E2EA001' }).filter({ hasText: `${new Intl.NumberFormat('pt-BR').format(width)} km` });
    const download = page.waitForEvent('download');
    await newRow.getByRole('button', { name: 'Baixar comprovante' }).click();
    expect((await download).suggestedFilename()).toBe(`comprovante-${width}.png`);
  });
}

test('consulta inválida oferece nova tentativa', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(value => sessionStorage.setItem('token', value), token);
  let attempts = 0;
  await page.route('**/api/abastecimentos', route => {
    if (route.request().method() !== 'GET') return route.continue();
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[{"id":"1"}]}' })
      : route.continue();
  });
  await page.goto('/gestor/abastecimentos');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'E2EA001' })).toBeVisible();
});

test('cadastro exige motorista e quilometragem e preserva formulário em erro do servidor', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(value => sessionStorage.setItem('token', value), token);
  await page.goto('/gestor/abastecimentos');
  await expect(page.locator('tbody tr').filter({ hasText: 'E2EA001' })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar abastecimento' }).click();
  const dialog = page.getByRole('dialog');
  await selecionarOpcao(dialog.getByLabel('Veículo', { exact: true }), String(vehicleIds[0]));
  await dialog.getByLabel('Data', { exact: true }).fill('2026-03-15');
  await dialog.getByLabel('Litros', { exact: true }).fill('15');
  await dialog.getByLabel('Valor total', { exact: true }).fill('90');
  await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(dialog.getByLabel('Motorista', { exact: true })).toBeFocused();
  await selecionarOpcao(dialog.getByLabel('Motorista', { exact: true }), String(driverId));
  await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(dialog.getByLabel('Quilometragem', { exact: true })).toBeFocused();
  await dialog.getByLabel('Quilometragem', { exact: true }).fill('3000');
  await page.route('**/api/abastecimentos', route => route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ERRO_INTERNO', message: 'Falha ao registrar abastecimento.' } }) })
    : route.continue());
  await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Falha ao registrar abastecimento');
  await expect(dialog.getByLabel('Quilometragem', { exact: true })).toHaveValue('3000');
  await expect(dialog.getByRole('button', { name: 'Registrar', exact: true })).toBeEnabled();
});
