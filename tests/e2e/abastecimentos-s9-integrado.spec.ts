import { expect, test, type Page } from '@playwright/test';
import { verifiedSql } from '../../backend/src/database/scripts/verify-test-db.js';
import { selecionarOpcao } from './fixtures/controls';

// Fluxo real: sem page.route, respostas controladas ou token fabricado.
let sql: Awaited<ReturnType<typeof verifiedSql>>;
let admin: Awaited<ReturnType<typeof verifiedSql>>;
const veiculoId = 938091;
const placa = 'E2ES901';
const pdf = Buffer.from('%PDF-1.4\nFixture oficial de integração S9\n%%EOF');

test.beforeAll(async () => {
  sql = await verifiedSql();
  admin = await verifiedSql(true);
  await sql`INSERT INTO veiculo (id,placa,marca,modelo,ano,tipo,is_svo)
    VALUES (${veiculoId},${placa},'Fixture','S10 TESTE',2026,'RABECÃO_SVO',true)`;
});
test.afterAll(async () => {
  if (!sql) return;
  try {
    await admin.begin(async tx => {
      await tx`DELETE FROM log_atividade WHERE descricao IN (
        SELECT 'Anexou arquivo ID ' || id::text FROM anexo WHERE abastecimento_id IN (SELECT id FROM abastecimento WHERE veiculo_id=${veiculoId}))`;
      await tx`DELETE FROM anexo WHERE abastecimento_id IN (SELECT id FROM abastecimento WHERE veiculo_id=${veiculoId})`;
      await tx`DELETE FROM log_atividade WHERE descricao IN (
        SELECT 'Registrou o abastecimento ID ' || id::text FROM abastecimento WHERE veiculo_id=${veiculoId})`;
      await tx`DELETE FROM abastecimento_comprovante WHERE abastecimento_id IN (SELECT id FROM abastecimento WHERE veiculo_id=${veiculoId})`;
      await tx`DELETE FROM abastecimento WHERE veiculo_id=${veiculoId}`;
      await tx`DELETE FROM veiculo WHERE id=${veiculoId}`;
    });
  } finally { await sql.end(); await admin.end(); }
});

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail', {exact:true}).fill('t1-adm@example.invalid');
  await page.getByLabel('Senha', {exact:true}).fill('T1-fixture-2026!');
  await page.getByRole('button', {name:'Entrar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

for (const width of [390, 768, 1280]) {
  test(`Sprint 9 real: km nulo/zero, histórico, PDF, indicadores e reload em ${width}px`, async ({page, request}, info) => {
    const erros: string[] = [];
    page.on('pageerror', erro => erros.push(erro.message));
    await page.setViewportSize({width,height:900});
    await login(page);
    await page.goto('/gestor/abastecimentos');
    await expect(page.getByRole('heading', {name:'Abastecimentos',exact:true})).toBeVisible();
    await selecionarOpcao(page.getByLabel('Filtrar por veículo'), String(veiculoId));
    const ids: string[] = [];
    for (const km of [null, 0]) {
      const abrir = page.getByRole('button', {name:'Registrar abastecimento',exact:true});
      await abrir.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await selecionarOpcao(dialog.getByLabel('Veículo', {exact:true}), String(veiculoId));
      await dialog.getByLabel('Data', {exact:true}).fill('12/11/2026');
      if (km !== null) await dialog.getByRole('spinbutton', {name:/^Quilometragem/}).fill(String(km));
      await dialog.getByLabel('Litros', {exact:true}).fill('12.50');
      await dialog.getByLabel('Valor total', {exact:true}).fill('75');
      let envios = 0;
      const contar = (req: import('@playwright/test').Request) => { if (new URL(req.url()).pathname === '/api/abastecimentos' && req.method() === 'POST') envios++; };
      page.on('request', contar);
      const resposta = page.waitForResponse(res => new URL(res.url()).pathname === '/api/abastecimentos' && res.request().method() === 'POST');
      // Dois submits consecutivos exercitam a trava, sem atrasar/interceptar a rede.
      await dialog.locator('form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
      const sucesso = await resposta;
      expect(sucesso.status()).toBe(201);
      const {data} = await sucesso.json(); ids.push(data.id);
      await expect(dialog).toBeHidden();
      await expect(abrir).toBeFocused();
      page.off('request', contar);
      expect(envios).toBe(1);
      const [persistido] = await sql`SELECT quilometragem,motorista_id,litragem,valor_total FROM abastecimento WHERE id=${data.id}`;
      expect(persistido).toMatchObject({quilometragem:km,motorista_id:null,litragem:'12.50',valor_total:'75.00'});
      await page.goto(`/gestor/abastecimentos/${data.id}`);
      await expect(page.getByRole('heading', {name:`Abastecimento #${data.id}`,exact:true})).toBeVisible();
      const campoKm = page.locator('dl > div').filter({has:page.locator('dt', {hasText:'Quilometragem'})});
      await expect(campoKm.locator('dd')).toHaveText(km === null ? 'Não informada' : '0 km');
      await page.reload();
      await expect(campoKm.locator('dd')).toHaveText(km === null ? 'Não informada' : '0 km');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({path:info.outputPath(`detalhe-${km === null ? 'sem-km' : 'zero'}-${width}.png`),fullPage:true});
      await page.goto('/gestor/abastecimentos');
      await expect(abrir).toBeEnabled();
    }
    // Prepara comprovante pelo endpoint oficial multipart; download ocorre pela tela real.
    const token = await page.evaluate(() => sessionStorage.getItem('token'));
    const headers = {Authorization:`Bearer ${token}`};
    const upload = await request.post(`/api/abastecimentos/${ids[0]}/comprovante`, {
      headers, multipart:{arquivo:{name:'comprovante-s9.pdf',mimeType:'application/pdf',buffer:pdf}},
    });
    expect(upload.status()).toBe(201);
    const [arquivo] = await sql`SELECT dados FROM anexo WHERE abastecimento_id=${ids[0]}`;
    expect(Buffer.from(arquivo.dados)).toEqual(pdf);
    expect((await request.get(`/api/abastecimentos/${ids[0]}/comprovante`)).status()).toBe(401);
    await page.goto(`/gestor/abastecimentos/${ids[0]}`);
    const baixado = page.waitForEvent('download');
    await page.getByRole('button',{name:`Baixar comprovante do abastecimento ${ids[0]}`}).click();
    expect((await baixado).suggestedFilename()).toBe('comprovante-s9.pdf');
    await page.goto(`/gestor/veiculos/${veiculoId}/abastecimentos`);
    await expect(page.getByRole('heading',{name:'Histórico de abastecimentos',exact:true})).toBeVisible();
    await expect(page.locator('tbody')).toContainText('Não informada');
    await expect(page.locator('tbody')).toContainText('0 km');
    await page.getByLabel('Período inicial').fill('2027-01-01');
    await expect(page.getByText('Nenhum abastecimento encontrado para os filtros selecionados.')).toBeVisible();
    await page.getByLabel('Período inicial').fill('');
    await page.reload();
    await expect(page.locator('tbody')).toContainText('Não informada');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`historico-${width}.png`),fullPage:true});
    await page.goto('/gestor/abastecimentos/indicadores');
    await page.getByLabel('Veículo', {exact:true}).selectOption(String(veiculoId));
    const [total] = await sql`SELECT count(*)::int AS quantidade, sum(litragem)::text AS litros,sum(valor_total)::text AS custo FROM abastecimento WHERE veiculo_id=${veiculoId}`;
    await expect(page.locator('article').filter({has:page.getByRole('heading',{name:'Abastecimentos',exact:true})})).toContainText(String(total.quantidade));
    await expect(page.locator('article').filter({hasText:'Litros abastecidos'})).toContainText(`${new Intl.NumberFormat('pt-BR').format(Number(total.litros))} L`);
    await expect(page.getByRole('heading',{name:'Consumo por distância indisponível'})).toBeVisible();
    await page.getByLabel('Período inicial').fill('2027-01-01');
    await expect(page.getByText('Nenhum abastecimento encontrado no período.')).toBeVisible();
    await expect(page.locator('article').filter({hasText:'Litros abastecidos'})).toContainText('0 L');
    await page.getByRole('button',{name:'Limpar período'}).click();
    await expect(page.locator('article').filter({hasText:'Litros abastecidos'})).toContainText(`${new Intl.NumberFormat('pt-BR').format(Number(total.litros))} L`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`indicadores-${width}.png`),fullPage:true});
    await page.reload();
    await expect(page.locator('article').first()).toContainText('Dados consultados no servidor');
    expect(erros).toEqual([]);
    await page.goto('/gestor/abastecimentos/9223372036854775807');
    await expect(page.getByRole('alert')).toBeVisible();
  });
}
