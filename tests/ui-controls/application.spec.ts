import { expect, test } from '@playwright/test';
import { selecionarOpcao } from '../e2e/fixtures/controls';

const veiculo = { id: '1', placa: 'FSP1A23', marca: 'Fixture', modelo: 'Veículo de teste', ano: 2026,
  tipo: 'PASSEIO', capacidade_obitos: 0, quilometragem_atual: 1000, status: 'DISPONIVEL', is_svo: false,
  criado_em: null, capacidade_passageiros: 4, vinculo: 'PROPRIO', fornecedor_locacao: null };
const motorista = { id: '2', usuario_id: null, nome: 'Motorista de teste', cnh: '10000000001',
  categoria_cnh: 'B', validade_cnh: '2099-01-01T00:00:00.000Z', status: 'DISPONIVEL', criado_em: null };
const registro = { id: '1', veiculo_id: '1', motorista_id: '2', posto: null, litragem: '10.00',
  valor_total: '50.00', quilometragem: 1000, data_abastecimento: '2026-11-09T00:00:00.000Z',
  criado_em: null, tanque_completo: false, comprovante_nome: null };

for (const width of [390, 768, 1280]) {
  test(`formulário da aplicação conserva formato API em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const erros: string[] = [];
    page.on('pageerror', error => erros.push(error.message));
    page.on('console', message => { if (message.type() === 'error') erros.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) erros.push(`${response.status()} ${response.url()}`); });
    await page.addInitScript(() => {
      sessionStorage.setItem('token', 'fixture-ui-controls');
      history.replaceState({}, '', '/gestor/abastecimentos');
    });
    let enviado: Record<string, unknown> | undefined;
    await page.route('**/api/**', async route => {
      const { pathname } = new URL(route.request().url());
      if (!pathname.startsWith('/api/')) return route.continue();
      if (pathname === '/api/auth/sessao') return route.fulfill({ json: { data: {
        id: '1', nome: 'Gestor de teste', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA',
      } } });
      if (pathname === '/api/veiculos') return route.fulfill({ json: { data: [veiculo] } });
      if (pathname === '/api/motoristas') return route.fulfill({ json: { data: [motorista] } });
      if (pathname === '/api/abastecimentos') {
        if (route.request().method() === 'POST') {
          enviado = route.request().postDataJSON();
          return route.fulfill({ status: 201, json: { data: registro } });
        }
        return route.fulfill({ json: { data: [{ ...registro, veiculo_placa: veiculo.placa, motorista_nome: motorista.nome }] } });
      }
      if (pathname.endsWith('/sincronizar')) return route.fulfill({ json: { data: { atualizadas: 0 } } });
      return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } });
    });
    await page.goto('/tests/ui-controls/application.html');
    try { await expect(page.getByText(veiculo.placa, { exact: true })).toBeVisible(); }
    catch (error) { throw new Error(`Estado: ${await page.locator('body').innerText()}; erros: ${JSON.stringify(erros)}; URL: ${page.url()}`, { cause: error }); }
    await page.getByRole('button', { name: 'Registrar abastecimento' }).click();
    const modal = page.getByRole('dialog', { name: 'Registrar abastecimento' });
    await selecionarOpcao(modal.getByRole('combobox', { name: 'Veículo', exact: true }), '1');
    await selecionarOpcao(modal.getByRole('combobox', { name: 'Motorista', exact: true }), '2');
    const data = modal.getByLabel('Data', { exact: true });
    await data.fill('09112026');
    await expect(data).toHaveValue('09/11/2026');
    await modal.getByRole('button', { name: 'Abrir calendário' }).click();
    const calendario = page.getByRole('dialog', { name: 'Escolher data' });
    await expect(calendario).toBeVisible();
    const limites = await calendario.boundingBox();
    expect(limites!.x).toBeGreaterThanOrEqual(0);
    expect(limites!.x + limites!.width).toBeLessThanOrEqual(width);
    expect(limites!.y + limites!.height).toBeLessThanOrEqual(900);
    await page.screenshot({ path: info.outputPath(`aplicacao-calendario-${width}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await modal.getByLabel('Quilometragem', { exact: true }).fill('1000');
    await modal.getByLabel('Litros', { exact: true }).fill('10');
    await modal.getByLabel('Valor total', { exact: true }).fill('50');
    await modal.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(modal).toBeHidden();
    expect(enviado).toMatchObject({ veiculo_id: '1', motorista_id: '2', data_abastecimento: '2026-11-09',
      quilometragem: 1000, litragem: '10', valor_total: '50' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(erros).toEqual([]);
  });
}
