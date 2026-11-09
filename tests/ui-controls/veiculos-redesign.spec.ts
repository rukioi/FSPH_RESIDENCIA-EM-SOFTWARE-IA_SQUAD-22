import { expect, test } from '@playwright/test';

const base = { marca: 'Fixture', ano: 2026, capacidade_obitos: 0, quilometragem_atual: 1000,
  criado_em: null, capacidade_passageiros: 4, vinculo: 'PROPRIO', fornecedor_locacao: null };
const veiculos = [
  { ...base, id: '1', placa: 'FSP1A01', modelo: 'Modelo de nome muito longo para verificar a apresentação responsiva', tipo: 'PASSEIO', status: 'DISPONIVEL', is_svo: false },
  { ...base, id: '2', placa: 'FSP1A02', modelo: 'Van', tipo: 'VAN', status: 'EM_VIAGEM', is_svo: false },
  { ...base, id: '3', placa: 'FSP1A03', modelo: 'Ambulância', tipo: 'AMBULANCIA', status: 'EM_MANUTENCAO', is_svo: false },
  { ...base, id: '4', placa: 'FSP1A04', modelo: 'Rabecão', tipo: 'RABECÃO_SVO', status: 'INDISPONIVEL', is_svo: true,
    quilometragem_atual: null, capacidade_passageiros: null, capacidade_obitos: null },
];

for (const width of [390, 768, 1280, 1440]) {
  test(`listagem e detalhes responsivos em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      sessionStorage.setItem('token', 'fixture-ui-controls');
      history.replaceState({}, '', '/gestor/veiculos');
    });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/**', async route => {
      const { pathname } = new URL(route.request().url());
      if (!pathname.startsWith('/api/')) return route.continue();
      if (pathname === '/api/auth/sessao') return route.fulfill({ json: { data: {
        id: '1', nome: 'Gestor de teste', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA',
      } } });
      if (pathname === '/api/veiculos') { await gate; return route.fulfill({ json: { data: veiculos } }); }
      if (pathname.endsWith('/sincronizar')) return route.fulfill({ json: { data: { atualizadas: 0 } } });
      return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } });
    });
    await page.goto('/tests/ui-controls/application.html');
    try { await expect(page.getByRole('status').filter({ hasText: 'Carregando veículos' })).toBeVisible(); }
    finally { release(); }
    for (const veiculo of veiculos) await expect(page.getByText(veiculo.placa, { exact: true })).toBeVisible();
    const cards = page.locator('.veiculo-card');
    await expect(cards).toHaveCount(4);
    await expect(cards.locator('.vehicle-image__illustration')).toHaveCount(4);
    await expect(cards.locator('img')).toHaveCount(0);
    await expect(cards.last()).toContainText('Não informada');
    for (const [index, status] of ['Disponível', 'Em viagem', 'Em manutenção', 'Indisponível'].entries()) {
      await expect(cards.nth(index)).toContainText(status);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`listagem-${width}.png`), fullPage: true });
    const detalhes = cards.first().getByRole('button', { name: /Ver detalhes/ });
    await detalhes.focus();
    await expect(detalhes).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: `Fixture ${veiculos[0].modelo}` })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`detalhes-${width}.png`), fullPage: true });
  });
}

test('falha na listagem permite nova tentativa', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'fixture-ui-controls');
    history.replaceState({}, '', '/gestor/veiculos');
  });
  let attempts = 0;
  let falhar = true;
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url());
      if (!pathname.startsWith('/api/')) return route.continue();
    if (pathname === '/api/auth/sessao') return route.fulfill({ json: { data: {
      id: '1', nome: 'Gestor de teste', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA',
    } } });
    if (pathname === '/api/veiculos') {
      attempts++;
      return falhar
        ? route.fulfill({ status: 500, json: { error: { code: 'ERRO_INTERNO', message: 'Falha na consulta.' } } })
        : route.fulfill({ json: { data: veiculos } });
    }
    if (pathname.endsWith('/sincronizar')) return route.fulfill({ json: { data: { atualizadas: 0 } } });
    return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } });
  });
  await page.goto('/tests/ui-controls/application.html');
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  falhar = false;
  await alert.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('FSP1A01', { exact: true })).toBeVisible();
  expect(attempts).toBeGreaterThanOrEqual(2);
});
