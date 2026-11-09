import { expect, test } from '@playwright/test'

test('falhas persistentes mostram um aviso discreto somente depois das tentativas automáticas', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-dashboard-retry'))
  await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: { id: '42', nome: 'Gestora', email: 'gestora@example.invalid', perfil: 'GESTOR_FROTA' } } }))
  let chamadas = 0
  await page.route('**/api/dashboard/gestor?*', route => {
    chamadas++
    return route.fulfill({ status: 500, json: { error: { code: 'ERRO_INTERNO', message: 'Erro inesperado ao processar os dados do dashboard.' } } })
  })
  await page.route('**/api/dashboard/pendencias', route => route.fulfill({ json: { data: { motoristas: [], documentos: [] } } }))
  await page.goto('/gestor/dashboard')
  await expect.poll(() => chamadas).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Recarregar' })).toHaveCount(0)
  const recarregar = page.getByRole('button', { name: 'Recarregar' })
  await expect(recarregar).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Erro inesperado ao processar os dados do dashboard.')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('aviso-recarregar-390.png'), fullPage: true })
  const antes = chamadas
  await recarregar.click()
  await expect.poll(() => chamadas).toBeGreaterThan(antes)
})

for (const width of [390, 768, 1280]) {
  test(`dashboard do gestor consulta e navega em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-dashboard'))
    await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: { id: '42', nome: 'Gestora', email: 'gestora@example.invalid', perfil: 'GESTOR_FROTA' } } }))
    const periodo = { periodo: 'hoje', inicio: '2026-11-06T00:00:00-03:00', fim: '2026-11-07T00:00:00-03:00', criterio: 'dataHoraSaida', fuso: 'America/Maceio' }
    await page.route('**/api/dashboard/gestor?*', route => route.fulfill({ json: { data: {
      periodo, veiculosPorStatus: [{ status: 'DISPONIVEL', total: 1 }], motoristasDisponiveis: null, motoristasDisponiveisMotivo: 'Jornada indisponível', solicitacoesPorStatus: [{ status: 'PENDENTE', total: 1 }], proximasViagens: [],
      indicadores: { periodo, pendentes: 1, aprovadas: 0, reprovadas: 0, veiculosDisponiveis: 1, filaAguardandoAnalise: [{ id: '1', codigo: 'TRP-1', codigoExibicao: '#TRP-1', origem: 'Origem', destino: 'Destino', criadoEm: null, acao: 'ANALISAR' }], atividadeRecente: [], decisoesRecentes: [], indicadoresIndisponiveis: [] },
    } } }))
    await page.route('**/api/dashboard/pendencias', route => route.fulfill({ json: { data: { motoristas: [], documentos: [] } } }))
    await page.clock.install()
    await page.goto('/gestor/dashboard')
    await expect(page.getByRole('button', { name: 'Atualizar dados' })).toHaveCount(0)
    await expect(page.getByText('Jornada indisponível')).toBeVisible()
    await expect(page.getByText('#TRP-1')).toBeVisible()
    const menu = page.locator('#menu-gestor')
    const alternarMenu = page.getByRole('button', { name: width > 900 ? 'Retrair menu' : 'Expandir menu' })
    await alternarMenu.click()
    await expect(alternarMenu).toHaveAttribute('aria-expanded', width > 900 ? 'false' : 'true')
    await expect(menu.getByRole('button', { name: 'Veículos' })).toBeVisible()
    await alternarMenu.click()
    await expect(page.getByRole('link', { name: 'Analisar chamados →' })).toHaveAttribute('href', '#gestor-fila')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('smooth')
    await expect(page.getByRole('link', { name: 'Analisar', exact: true })).toHaveAttribute('href', '/gestor/solicitacoes/1')
    await page.getByRole('button', { name: '7 dias' }).click()
    await expect(page.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
    const refresh = page.waitForRequest(request => request.url().includes('/api/dashboard/gestor?'))
    await page.clock.fastForward(31_000)
    await refresh
    await expect(page.getByText('#TRP-1')).toBeVisible()
    await page.getByRole('button', { name: 'Personalizado' }).click()
    await page.getByRole('button', { name: 'Aplicar período' }).click()
    await expect(page.getByRole('alert')).toContainText('intervalo válido')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Hoje', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toBeFocused()
    await page.screenshot({ path: info.outputPath(`dashboard-${width}.png`), fullPage: true })
  })
}

