import { readFileSync } from 'node:fs';
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

test('cadastro fecha com Escape e edição aguarda confirmação do servidor', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'fixture-ui-controls');
    history.replaceState({}, '', '/gestor/veiculos');
  });
  const original = { ...veiculos[0], status: null };
  let falhar = true;
  let enviado: Record<string, unknown> = {};
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (!pathname.startsWith('/api/')) return route.continue();
    if (pathname === '/api/auth/sessao') return route.fulfill({ json: { data: {
      id: '1', nome: 'Gestor de teste', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA',
    } } });
    if (pathname === '/api/veiculos') return route.fulfill({ json: { data: [original] } });
    if (pathname === '/api/veiculos/1' && route.request().method() === 'PATCH') {
      enviado = route.request().postDataJSON();
      if (falhar) return route.fulfill({ status: 500, json: { error: { code: 'ERRO_INTERNO', message: 'Falha ao atualizar.' } } });
      await gate;
      return route.fulfill({ json: { data: { ...original, modelo: 'Modelo atualizado' } } });
    }
    if (pathname.endsWith('/sincronizar')) return route.fulfill({ json: { data: { atualizadas: 0 } } });
    return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } });
  });
  await page.goto('/tests/ui-controls/application.html');
  await expect(page.getByText(original.placa, { exact: true })).toBeVisible();
  const cadastrar = page.getByRole('button', { name: 'Cadastrar veículo', exact: true });
  await cadastrar.click();
  await expect(page.getByRole('dialog', { name: 'Cadastrar veículo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Cadastrar veículo' })).toHaveCount(0);
  await expect(cadastrar).toBeFocused();
  await page.locator('.veiculo-card').getByRole('button', { name: /Ver detalhes/ }).click();
  const editar = page.getByRole('button', { name: 'Editar veículo' });
  await editar.click();
  const dialog = page.getByRole('dialog', { name: 'Editar veículo' });
  await dialog.getByLabel('Modelo').fill('Modelo atualizado');
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(enviado).not.toHaveProperty('status');
  await expect(page.getByRole('heading', { name: `Fixture ${original.modelo}` })).toBeVisible();
  falhar = false;
  await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
  try {
    await expect(dialog.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
    await expect(page.getByRole('heading', { name: `Fixture ${original.modelo}` })).toBeVisible();
  } finally { release(); }
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Fixture Modelo atualizado' })).toBeVisible();
  await expect(editar).toBeFocused();
});

test('imagem indisponível usa ilustração e outra URL volta a exibir fotografia', async ({ page }) => {
  await page.route('**/fixture-image/**', route => {
    if (route.request().url().endsWith('missing.svg')) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160"><rect width="300" height="160" fill="blue"/></svg>' });
  });
  await page.goto('/tests/ui-controls/vehicle-media.html');
  const foto = page.getByRole('img', { name: 'Veículo de teste' });
  await expect(foto).toBeVisible();
  await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(300);
  const before = await page.locator('.vehicle-image').boundingBox();
  await page.getByRole('button', { name: 'Imagem indisponível' }).click();
  await expect(page.locator('.vehicle-image__illustration')).toBeVisible();
  const fallback = await page.locator('.vehicle-image').boundingBox();
  expect(fallback).toEqual(before);
  await page.getByRole('button', { name: 'Outra imagem' }).click();
  await expect(foto).toBeVisible();
  await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(300);
  expect(await page.locator('.vehicle-image').boundingBox()).toEqual(before);
});


test('foto opcional pode ser enviada e exibida após confirmação', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => { sessionStorage.setItem('token', 'fixture-ui-controls'); history.replaceState({}, '', '/gestor/veiculos'); });
  let foto: { tipo: string; dadosBase64: string } | null = null;
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url());
    if (!pathname.startsWith('/api/')) return route.continue();
    if (pathname === '/api/auth/sessao') return route.fulfill({ json: { data: { id: '1', nome: 'Gestor', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA' } } });
    if (pathname === '/api/veiculos') return route.fulfill({ json: { data: [veiculos[0], veiculos[1]] } });
    if (pathname === '/api/veiculos/1' && route.request().method() === 'PATCH') return route.fulfill({ json: { data: veiculos[0] } });
    if (pathname.match(/\/api\/veiculos\/\d+\/foto/)) {
      if (route.request().method() === 'PUT') foto = route.request().postDataJSON();
      return route.fulfill({ json: { data: { foto: pathname.includes('/1/') ? foto : null } } });
    }
    if (pathname.endsWith('/sincronizar')) return route.fulfill({ json: { data: { atualizadas: 0 } } });
    return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } });
  });
  await page.goto('/tests/ui-controls/application.html');
  const cards = page.locator('.veiculo-card');
  await expect(cards).toHaveCount(2);
  await cards.first().getByRole('button', { name: /Ver detalhes/ }).click();
  await page.getByRole('button', { name: 'Editar veículo' }).click();
  const arquivo = readFileSync('docs/veiculos-exemplos/carro-passeio.jpg');
  await page.getByLabel('Foto do veículo (opcional)').setInputFiles({ name: 'carro.jpg', mimeType: 'image/jpeg', buffer: arquivo });
  await expect(page.getByAltText('Prévia da foto selecionada')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Veículo atualizado com sucesso.')).toBeVisible();
  await expect(page.locator('.vehicle-details__image img')).toBeVisible();
  await page.getByRole('button', { name: /Voltar para veículos/ }).click();
  await expect(cards.first().locator('img')).toBeVisible();
  await expect(cards.nth(1).locator('.vehicle-image__illustration')).toBeVisible();
  await page.screenshot({ path: info.outputPath('foto-exemplo.png'), fullPage: true });
});
