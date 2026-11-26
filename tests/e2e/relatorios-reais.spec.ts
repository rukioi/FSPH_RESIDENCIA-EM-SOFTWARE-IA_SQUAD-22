import { expect, test as base } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ExcelJS = createRequire(import.meta.url)('exceljs') as typeof import('exceljs');
import { prepararRelatoriosS10, relatorioS10 } from '../../backend/tests/integration/relatorios-s10.fixture.js';
import { prepararFixtureSvo, emailAtendente } from '../../backend/tests/integration/svo-operacional.fixture.js';
import { selecionarOpcao } from './fixtures/controls';

// Sem page.route ou sessão fabricada: login, relatórios e filtros atravessam a API real.
const test = base.extend<{ cenario: Awaited<ReturnType<typeof prepararRelatoriosS10>> }>({
  cenario: async ({ baseURL }, use) => {
    expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
    const fixture = await prepararRelatoriosS10();
    try { await use(fixture); } finally { await fixture.limpar(); }
  },
});
test.describe.configure({ mode: 'serial' });
for (const width of [390, 768, 1280]) test(`SCRUM-250/251 relatório real, SQL, reload e arquivos completos em ${width}px`, async ({ page, cenario }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill('t1-gestor_frota@example.invalid');
  await page.getByLabel('Senha', { exact: true }).fill('T1-fixture-2026!');
  const login = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Entrar', exact: true }).press('Enter');
  expect((await login).status()).toBe(200);
  await expect(page).toHaveURL(/\/gestor\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  const menu = page.getByRole('button', { name: /Expandir menu/ });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Relatórios operacionais' })).toBeVisible();
  async function gerar() {
    await page.getByRole('textbox', { name: 'Data inicial Abrir calendário', exact: true }).fill('01/05/2097');
    await page.getByRole('textbox', { name: 'Data final Abrir calendário', exact: true }).fill('03/05/2097');
    await selecionarOpcao(page.getByRole('combobox', { name: 'Veículo', exact: true }), String(relatorioS10.veiculo));
    await selecionarOpcao(page.getByRole('combobox', { name: 'Status', exact: true }), '');
    const resposta = page.waitForResponse(r => new URL(r.url()).pathname === '/api/relatorios' && new URL(r.url()).searchParams.get('veiculoId') === String(relatorioS10.veiculo));
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).press('Enter');
    const http = await resposta;
    expect(http.status()).toBe(200);
    const { data } = await http.json();
    expect(data.resumo).toEqual({ registros: 60, kmConcluidos: 580, semQuilometragem: 0 });
    return data as { linhas: { codigo: string }[] };
  }
  const dados = await gerar();
  const [db] = await cenario.sql`SELECT count(*)::int AS registros, sum(km_final-km_inicial)::int AS km FROM public.viagem WHERE veiculo_id=7250001 AND status='CONCLUIDA'`;
  expect(db).toMatchObject({ registros: 59, km: 580 });
  await expect(page.getByText('60 registros encontrados')).toBeVisible();
  await expect(page.getByText('580 km', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page.getByText(/Página 2 de 3/)).toBeVisible();
  for (const formato of ['CSV', 'XLSX', 'PDF']) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: `Exportar ${formato}`, exact: true }).click();
    const path = info.outputPath(`relatorio.${formato.toLowerCase()}`);
    await (await download).saveAs(path);
    const bytes = await readFile(path);
    if (formato === 'CSV') {
      const csv = bytes.toString('utf8');
      expect([...csv.matchAll(/^"(S10-REL-\d+)";/gm)].map(match => match[1])).toEqual(dados.linhas.map(row => row.codigo));
      expect(csv).toContain("'" + '=1+1');
      expect(csv).toContain('São José');
    } else if (formato === 'XLSX') {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(new Uint8Array(bytes).buffer);
      const sheet = wb.getWorksheet('Dados')!;
      expect(sheet.rowCount).toBe(61);
      expect(sheet.getColumn(1).values.slice(2)).toEqual(dados.linhas.map(row => row.codigo));
      expect(sheet.getCell('C2').value).toBe('=1+1');
      expect(wb.getWorksheet('Informações')).toBeDefined();
    } else {
      const pdf = bytes.toString('latin1');
      expect(pdf.startsWith('%PDF-')).toBe(true);
      expect(pdf.match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
      expect(pdf.match(/S10-REL-\d+\b/g)).toEqual(dados.linhas.map(row => row.codigo));
    }
  }
  await page.getByRole('textbox', { name: 'Data final Abrir calendário', exact: true }).fill('04/05/2097');
  await expect(page.getByRole('button', { name: 'Exportar CSV', exact: true })).toBeDisabled();
  await page.reload();
  await gerar();
  await expect(page.getByText('60 registros encontrados')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`relatorios-reload-${width}.png`), fullPage: true });
  expect(errors).toEqual([]);
});


test('SCRUM-250 SVO usa login real, menu e recorte separado dos relatórios de frota', async ({ page, cenario }) => {
  const svo = await prepararFixtureSvo('T1-fixture-2026!');
  try {
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill(emailAtendente);
    await page.getByLabel('Senha', { exact: true }).fill('T1-fixture-2026!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard SVO', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Relatórios SVO', exact: true }).click();
    await page.getByRole('textbox', { name: 'Data inicial Abrir calendário', exact: true }).fill('01/05/2097');
    await page.getByRole('textbox', { name: 'Data final Abrir calendário', exact: true }).fill('03/05/2097');
    const resposta = page.waitForResponse(r => new URL(r.url()).pathname === '/api/svo/relatorios' && new URL(r.url()).searchParams.get('inicio') === '2097-05-01');
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    const http = await resposta;
    expect(http.status()).toBe(200);
    const { data } = await http.json();
    expect(data.resumo).toEqual({ registros: 1, kmConcluidos: 10, semQuilometragem: 0 });
    expect(await cenario.sql`SELECT km_final-km_inicial AS km FROM ordem_coleta WHERE id=7256001`).toMatchObject([{ km: 10 }]);
    await expect(page.getByText('1 registros encontrados')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Relatório', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Relatórios SVO', exact: true })).toBeVisible();
  } finally { await svo.limpar(); }
});
