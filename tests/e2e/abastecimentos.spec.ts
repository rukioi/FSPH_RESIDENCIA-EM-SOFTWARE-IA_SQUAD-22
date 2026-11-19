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

test.afterEach(async () => {
  if (!sql) return;
  await sql`DELETE FROM log_atividade WHERE tipo_evento='abastecimento_criado'
    AND descricao IN (SELECT 'Registrou abastecimento ID ' || id FROM abastecimento
      WHERE veiculo_id = ${vehicleIds[0]} AND quilometragem IN (1390,1768,2280))`;
  await sql`delete from abastecimento_comprovante where abastecimento_id in (select id from abastecimento where veiculo_id = ${vehicleIds[0]} and quilometragem in (1390, 1768, 2280))`;
  await sql`delete from abastecimento where veiculo_id = ${vehicleIds[0]} and quilometragem in (1390, 1768, 2280)`;
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
  test(`comprovante compartilhado PDF real permanece disponível após reload em ${width}px`, async ({ page, request }) => {
    const [registro] = await sql`SELECT id FROM abastecimento WHERE veiculo_id=938001 AND quilometragem=1000`;
    const bytes = Buffer.from('%PDF-1.7\nFixture comprovante compartilhado\n%%EOF');
    const response = await request.post(`/api/abastecimentos/${registro.id}/comprovante`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { arquivo: { name: 'comprovante-s9.pdf', mimeType: 'application/pdf', buffer: bytes } },
    });
    expect(response.status()).toBe(201);
    const { data } = await response.json();
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');
      await page.evaluate(value => sessionStorage.setItem('token', value), token);
      await page.goto('/gestor/abastecimentos');
      for (let reload = 0; reload < 2; reload++) {
        const botao = page.locator('tbody tr').filter({ hasText: 'E2EA001' }).getByRole('button', { name: 'Baixar comprovante' });
        await expect(botao).toBeVisible();
        await botao.focus();
        const baixando = page.waitForEvent('download');
        await page.keyboard.press('Enter');
        const download = await baixando;
        expect(download.suggestedFilename()).toBe('comprovante-s9.pdf');
        const stream = await download.createReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        expect(Buffer.concat(chunks)).toEqual(bytes);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.reload();
      }
      const [persistido] = await sql`SELECT abastecimento_id,dados FROM anexo WHERE id=${data.id}`;
      expect(persistido).toEqual({ abastecimento_id: registro.id, dados: bytes });
    } finally {
      const admin = await verifiedSql(true);
      try {
        await admin`DELETE FROM anexo WHERE id=${data.id}`;
        await admin`DELETE FROM log_atividade WHERE usuario_id=${data.autorId} AND descricao=${`Anexou arquivo ID ${data.id}`}`;
      } finally { await admin.end(); }
    }
  });
}

for (const width of [390, 768, 1280]) {
  test(`abastecimentos consulta, filtra e registra em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.evaluate(value => sessionStorage.setItem('token', value), token);
    await page.goto('/gestor/abastecimentos');
    await expect(page.getByRole('heading', { name: 'Abastecimentos', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver indicadores' })).toHaveCount(0);
    const action = page.locator('tbody tr').filter({ hasText: 'E2EA001' }).getByRole('button', { name: 'Ver detalhes' });
    await action.click();
    const details = page.getByRole('dialog', { name: 'Detalhes do abastecimento' });
    await expect(details).toContainText('Fixture posto A');
    await expect(details).toContainText('Fixture E2E Abastecimento');
    await expect(page).toHaveURL(/\/gestor\/abastecimentos$/);
    await page.screenshot({ path: info.outputPath(`abastecimento-detalhes-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(action).toBeFocused();
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
    await dialog.getByLabel('Quilometragem', { exact: true }).fill(String(1000 + width));
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
      const rows = await sql`select id from abastecimento where veiculo_id = ${vehicleIds[0]} and quilometragem = ${1000 + width}`;
      expect(rows).toHaveLength(0);
    } finally { release(); }
    await expect(dialog).toBeHidden();
    const persisted = await sql`select id, motorista_id, quilometragem, litragem, valor_total, tanque_completo from abastecimento where veiculo_id = ${vehicleIds[0]} and quilometragem = ${1000 + width}`;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ motorista_id: String(driverId), quilometragem: 1000 + width, litragem: '15.00', valor_total: '90.00', tanque_completo: true });
    const [receipt] = await sql`select nome, tipo, dados from abastecimento_comprovante where abastecimento_id = ${persisted[0].id}`;
    expect(receipt.nome).toBe(`comprovante-${width}.png`);
    expect(receipt.tipo).toBe('image/png');
    expect(Buffer.from(receipt.dados)).toEqual(png);
    await page.getByLabel('Período final').fill('');
    const newRow = rows.filter({ hasText: 'E2EA001' }).filter({ hasText: `${new Intl.NumberFormat('pt-BR').format(1000 + width)}km` });
    const download = page.waitForEvent('download');
    await newRow.getByRole('button', { name: 'Baixar comprovante' }).click();
    expect((await download).suggestedFilename()).toBe(`comprovante-${width}.png`);
  });
}

test('km menor recebe 409 real no formulário; igualdade confirma e persiste após reload', async ({ page }) => {
  const posto = 'Fixture E2E Caso B km';
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/login');
  await page.evaluate(value => sessionStorage.setItem('token', value), token);
  await page.goto('/gestor/abastecimentos');
  await page.getByRole('button', { name: 'Registrar abastecimento' }).click();
  const dialog = page.getByRole('dialog');
  await selecionarOpcao(dialog.getByLabel('Veículo', { exact: true }), String(vehicleIds[0]));
  await selecionarOpcao(dialog.getByLabel('Motorista', { exact: true }), String(driverId));
  await dialog.getByLabel('Data', { exact: true }).fill('2026-03-15');
  await dialog.getByLabel('Quilometragem', { exact: true }).fill('999');
  await dialog.getByLabel('Litros', { exact: true }).fill('10');
  await dialog.getByLabel('Valor total', { exact: true }).fill('60');
  await dialog.getByLabel('Posto de combustível (opcional)', { exact: true }).fill(posto);
  const resposta = () => page.waitForResponse(r => r.url().endsWith('/api/abastecimentos') && r.request().method() === 'POST');
  try {
    const rejeicao = resposta();
    await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
    expect((await rejeicao).status()).toBe(409);
    await expect(dialog.getByRole('alert')).toContainText('Quilometragem inferior');
    await expect(dialog.getByLabel('Quilometragem', { exact: true })).toHaveValue('999');
    expect(await sql`SELECT id FROM abastecimento WHERE veiculo_id=938001 AND posto=${posto}`).toHaveLength(0);
    await dialog.getByLabel('Quilometragem', { exact: true }).fill('1000');
    const confirmacao = resposta();
    await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
    const response = await confirmacao;
    expect(response.status()).toBe(201);
    const { data } = await response.json();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    const linha = page.locator('tbody tr').filter({ hasText: 'E2EA001' }).filter({ hasText: '15/03/2026' });
    await expect(linha).toBeVisible();
    await linha.getByRole('button', { name: 'Ver detalhes' }).click();
    await expect(page.getByRole('dialog', { name: 'Detalhes do abastecimento' })).toContainText(posto);
    expect(await sql`SELECT quilometragem FROM abastecimento WHERE id=${data.id} AND veiculo_id=938001 AND posto=${posto}`)
      .toEqual([{ quilometragem: 1000 }]);
    expect(await sql`SELECT tipo_evento FROM log_atividade
      WHERE descricao=${`Registrou abastecimento ID ${data.id}`}`).toEqual([{tipo_evento:'abastecimento_criado'}]);
  } finally {
    await sql`DELETE FROM log_atividade WHERE tipo_evento='abastecimento_criado'
      AND descricao IN (SELECT 'Registrou abastecimento ID ' || id FROM abastecimento
        WHERE veiculo_id=938001 AND posto=${posto})`;
    await sql`DELETE FROM abastecimento WHERE veiculo_id=938001 AND posto=${posto}`;
  }
});

test('consulta inválida oferece nova tentativa', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(value => sessionStorage.setItem('token', value), token);
  let permitirRespostaValida = false;
  await page.route('**/api/abastecimentos', route => {
    if (route.request().method() !== 'GET') return route.continue();
    return !permitirRespostaValida
      ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[{"id":"1"}]}' })
      : route.continue();
  });
  await page.goto('/gestor/abastecimentos');
  await expect(page.getByRole('alert')).toBeVisible();
  permitirRespostaValida = true;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('tbody tr').filter({ hasText: 'E2EA001' })).toBeVisible();
});

test('cadastro aceita motorista e quilometragem ausentes e preserva formulário em erro do servidor', async ({ page }) => {
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
  const corpos: Array<{motorista_id: string | null; quilometragem: number | null}> = [];
  await page.route('**/api/abastecimentos', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    corpos.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'ERRO_INTERNO', message: 'Falha ao registrar abastecimento.' } }) });
  });
  await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Falha ao registrar abastecimento');
  expect(corpos).toHaveLength(1);
  expect(corpos[0]).toMatchObject({motorista_id:null,quilometragem:null});
  await expect(dialog.getByRole('button', { name: 'Registrar', exact: true })).toBeEnabled();

  await selecionarOpcao(dialog.getByLabel('Motorista', { exact: true }), String(driverId));
  await dialog.getByLabel('Quilometragem', { exact: true }).fill('3000');
  await dialog.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Falha ao registrar abastecimento');
  expect(corpos).toHaveLength(2);
  expect(corpos[1]).toMatchObject({motorista_id:String(driverId),quilometragem:3000});
  await expect(dialog.getByLabel('Quilometragem', { exact: true })).toHaveValue('3000');
  await expect(dialog.getByRole('button', { name: 'Registrar', exact: true })).toBeEnabled();
});
