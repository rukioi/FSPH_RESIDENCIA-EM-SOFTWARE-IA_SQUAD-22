import { expect, test } from '@playwright/test'

for (const width of [390, 768, 1280]) {
  test(`icones da frota em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-perfil'))
    await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: {
      id: '42', nome: 'Gestora Exemplo', email: 'gestora@example.invalid', perfil: 'GESTOR_FROTA',
    } } }))
    await page.route('**/api/veiculos', route => route.fulfill({ json: { data: [{
      id: '20', placa: 'ABC1D23', marca: 'Marca exemplo', modelo: 'Veiculo de teste', ano: 2026,
      tipo: 'PASSEIO', status: 'DISPONIVEL', capacidade_obitos: null, quilometragem_atual: 1500,
      is_svo: false, criado_em: null, capacidade_passageiros: 5, vinculo: 'PROPRIO', fornecedor_locacao: null,
    }] } }))
    await page.goto('/gestor/veiculos')
    await expect(page.locator('.veiculo-card')).toBeVisible()
    await expect(page.locator('.veiculo-card .vehicle-image__illustration')).toHaveAttribute('aria-hidden', 'true')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`veiculos-icones-${width}.png`), fullPage: true })
  })

  test(`gestor acessa o próprio perfil em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-perfil'))
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ status: 500, json: { error: { code: 'ERRO', message: 'Indisponível' } } }))
    await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: {
      id: '42', nome: 'Gestora Exemplo', email: 'gestora@example.invalid', perfil: 'GESTOR_FROTA',
    } } }))
    await page.goto('/gestor/dashboard')
    const perfil = page.getByRole('button', { name: 'Meu perfil' })
    await perfil.focus()
    await expect(perfil).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/gestor\/dashboard$/)
    const dialog = page.getByRole('dialog', { name: 'Meu perfil' })
    await expect(dialog).toBeVisible()
    const caixa = await dialog.boundingBox()
    expect(caixa).not.toBeNull()
    expect(Math.abs((caixa!.x + caixa!.width / 2) - width / 2)).toBeLessThan(2)
    expect(caixa!.width).toBeGreaterThan(width < 600 ? width - 40 : 600)
    await expect(dialog.getByText('gestora@example.invalid')).toBeVisible()
    await expect(page.locator('dd').filter({ hasText: 'Gestor de Frota' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`perfil-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await expect(perfil).toBeFocused()
    await perfil.click()
    await dialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(dialog).not.toBeVisible()
  })
}

for (const width of [390, 768, 1280]) {
  test(`card de detalhes do motorista em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-perfil'))
    await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: {
      id: '42', nome: 'Gestora Exemplo', email: 'gestora@example.invalid', perfil: 'GESTOR_FROTA',
    } } }))
    await page.route('**/api/motoristas', route => route.fulfill({ json: { data: [{
      id: '12', usuario_id: null, nome: 'Motorista Exemplo', cnh: '12345678901', categoria_cnh: 'B',
      validade_cnh: '2099-01-01', status: 'DISPONIVEL', criado_em: null, cpf: null, telefone: null,
    }] } }))
    await page.goto('/gestor/motoristas')
    const detalhes = page.getByRole('button', { name: 'Ver detalhes' })
    await expect(detalhes).toBeVisible()
    await page.screenshot({ path: info.outputPath(`motoristas-cards-${width}.png`), fullPage: true })
    await detalhes.focus()
    await expect(detalhes).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Motorista Exemplo' })).toBeVisible()
    await expect(page.getByText('Pendências documentais')).toBeVisible()
    await expect(page.getByText('Histórico de chamados/rotas')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`motorista-perfil-${width}.png`), fullPage: true })
    await page.locator('.motorista-voltar').click()
    await expect(page.getByRole('button', { name: 'Ver detalhes' })).toBeVisible()
  })
}

test('perfil de outro usuário não autoriza acesso à página do gestor', async ({ page }) => {
  await page.addInitScript(() => { if (location.pathname !== '/login') sessionStorage.setItem('token', 'fixture-perfil') })
  await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: {
    id: '43', nome: 'Motorista', email: 'motorista@example.invalid', perfil: 'MOTORISTA',
  } } }))
  await page.goto('/gestor/dashboard')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Meu perfil' })).toHaveCount(0)
})
