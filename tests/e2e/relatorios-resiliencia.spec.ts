import { expect, test } from '@playwright/test';
import { prepararRelatoriosS10 } from '../../backend/tests/integration/relatorios-s10.fixture.js';
import { selecionarOpcao } from './fixtures/controls';

// RESILIÊNCIA CONTROLADA: falha apenas o download do módulo JS; login/API/SQL não são interceptados.
test('SCRUM-251 falha do exportador não cria arquivo nem trava filtros; reload permite nova exportação', async ({ page, baseURL }) => {
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
  const fixture = await prepararRelatoriosS10();
  const downloads: string[] = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));
  const modulo = /\/exceljs(?:[^/]*)\.js(?:\?|$)/;
  await page.route(modulo, route => route.abort('internetdisconnected'));
  try {
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill('t1-gestor_frota@example.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('T1-fixture-2026!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
    async function gerar() {
      await page.getByRole('textbox', { name: 'Data inicial Abrir calendário', exact: true }).fill('01/05/2097');
      await page.getByRole('textbox', { name: 'Data final Abrir calendário', exact: true }).fill('03/05/2097');
      await selecionarOpcao(page.getByRole('combobox', { name: 'Status', exact: true }), '');
      await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
      await expect(page.getByText('60 registros encontrados')).toBeVisible();
    }
    await gerar();
    await page.getByRole('button', { name: 'Exportar XLSX', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Não foi possível exportar');
    expect(downloads).toEqual([]);
    await expect(page.getByRole('button', { name: 'Gerar relatório', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Exportar XLSX', exact: true })).toBeEnabled();
    await page.unroute(modulo);
    await page.reload();
    await gerar();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar XLSX', exact: true }).click();
    expect((await download).suggestedFilename()).toBe('relatorio-viagens-2097-05-01-2097-05-03.xlsx');
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { await fixture.limpar(); }
});


// RESILIÊNCIA CONTROLADA: atraso do módulo XLSX, sem alterar a resposta da API.
test('SCRUM-251 sair durante exportação cancela o download e preserva navegação', async ({ page }) => {
  const fixture = await prepararRelatoriosS10();
  const downloads: string[] = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));
  let liberar!: () => void;
  const espera = new Promise<void>(resolve => { liberar = resolve; });
  let solicitado = false;
  await page.route(/\/exceljs(?:[^/]*)\.js(?:\?|$)/, async route => {
    solicitado = true;
    await espera;
    await route.continue();
  });
  try {
    await page.goto('/login');
    await page.getByLabel('E-mail', { exact: true }).fill('t1-gestor_frota@example.invalid');
    await page.getByLabel('Senha', { exact: true }).fill('T1-fixture-2026!');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Relatórios', exact: true }).click();
    await page.getByRole('textbox', { name: 'Data inicial Abrir calendário', exact: true }).fill('01/05/2097');
    await page.getByRole('textbox', { name: 'Data final Abrir calendário', exact: true }).fill('03/05/2097');
    await page.getByRole('button', { name: 'Gerar relatório', exact: true }).click();
    await expect(page.getByText('59 registros encontrados')).toBeVisible();
    await page.getByRole('button', { name: 'Exportar XLSX', exact: true }).click();
    await expect.poll(() => solicitado).toBe(true);
    await expect(page.getByRole('button', { name: 'Exportando…', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    const fim = page.waitForEvent('requestfinished', req => /\/exceljs(?:[^/]*)\.js(?:\?|$)/.test(req.url()));
    liberar();
    await fim;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    expect(downloads).toEqual([]);
    await expect(page.getByRole('alert')).toHaveCount(0);
  } finally { liberar(); await fixture.limpar(); }
});
