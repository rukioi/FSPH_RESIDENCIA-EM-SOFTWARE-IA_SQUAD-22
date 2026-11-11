import { expect, test as base } from '@playwright/test'
import { join } from 'node:path'

const test = base.extend<{ monitor: void }>({
  monitor: [async ({ page }, use) => {
    const problemas: string[] = []
    // O tema geral oferece fonte externa opcional. Use seu fallback no ensaio offline.
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
    await page.route(url => url.pathname.startsWith('/api/'), route => {
      problemas.push('API: ' + route.request().url())
      return route.abort()
    })
    page.on('pageerror', erro => problemas.push(erro.message))
    page.on('console', msg => {
      if (['error', 'warning'].includes(msg.type())) problemas.push(msg.text())
    })
    page.on('response', resposta => {
      if (resposta.status() >= 400) problemas.push(resposta.status() + ' ' + resposta.url())
    })
    page.on('requestfailed', req => {
      if (req.failure()?.errorText !== 'net::ERR_ABORTED') problemas.push(req.url())
    })
    await use()
    expect(problemas).toEqual([])
  }, { auto: true }],
})

test.use({ locale: 'pt-BR' })

test('preview preserva a sessão existente sem consultar autenticação ou gravar dados', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-preview-sessao'))
  await page.goto('/svo-preview/solicitacoes/exemplo/triagem')
  await page.getByRole('radio', { name: 'SVO', exact: true }).check()
  await page.getByLabel('Observações da triagem').fill('Somente memória de teste')
  await page.getByRole('button', { name: 'Salvar andamento' }).click()
  await expect(page.getByRole('status')).toContainText('depende da integração')
  expect(await page.evaluate(() => ({ token: sessionStorage.getItem('token'), local: localStorage.length, session: sessionStorage.length })))
    .toEqual({ token: 'fixture-preview-sessao', local: 0, session: 1 })
  await page.reload()
  await expect(page.getByLabel('Observações da triagem')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)
})

const telas = [
  ['dashboard', 'Dashboard SVO', 'Dashboard SVO'],
  ['nova-solicitacao', 'Nova Solicitação SVO', 'Nova Solicitação'],
  ['solicitacoes', 'Solicitações', 'Solicitações'],
  ['solicitacoes/exemplo/triagem', 'Triagem', 'Solicitações'],
  ['ordens', 'Ordens de Coleta', 'Ordens de Coleta'],
  ['ordens/exemplo', 'Detalhe da ordem', 'Ordens de Coleta'],
  ['ordens/exemplo/despacho', 'Preparar despacho', 'Ordens de Coleta'],
  ['equipe/minhas-ordens', 'Minhas Ordens', 'Minhas Ordens'],
  ['equipe/ordens/exemplo/execucao', 'Execução da ordem', 'Minhas Ordens'],
]

for (const width of [390, 768, 1280]) {
  test.describe('Preview SVO em ' + width + ' px', () => {
    test.use({ viewport: { width, height: 850 } })
    test('abre as telas sem sessão, sem API e com a seção correta ativa', async ({ page }, info) => {
      for (const [path, titulo, grupo] of telas) {
        await page.goto('/svo-preview/' + path, { waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { level: 1, name: titulo, exact: true })).toBeVisible()
        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByRole('heading', { level: 1, name: titulo, exact: true })).toBeVisible()
        await expect(page.locator('.svo-cabecalho__esquerda strong')).toHaveText(path === 'nova-solicitacao' ? 'Nova Solicitação' : titulo)
        await expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)
        for (const input of await page.locator('main :is(input, select, textarea, button):visible').all()) {
          await expect(input).toHaveAccessibleName(/.+/)
        }
        expect(await page.locator('main section, main input, main textarea, main select').evaluateAll(nodes =>
          nodes.every(node => node.getBoundingClientRect().right <= innerWidth + 1))).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.screenshot({ path: join(info.project.outputDir, 'capturas', String(width), path.replaceAll('/', '-') + '.png'), fullPage: true })
        if (width < 900) {
          await page.keyboard.press('Tab')
          await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused()
          await page.keyboard.press('Enter')
        }
        await expect(page.locator('nav [aria-current="page"]')).toHaveText(grupo)
      }

    })
  })
}

test('abre o detalhe sem atribuir registros e mantém as decisões sem envio', async ({ page }) => {
  await page.goto('/svo-preview/solicitacoes')
  await expect(page.getByText('Consulta indisponível')).toBeVisible()
  await page.getByRole('link', { name: 'Abrir triagem' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar SVO' })).toBeDisabled()
  await page.goto('/svo-preview/solicitacoes/exemplo/triagem?estado=concluida')
  await expect(page.getByRole('radio', { name: 'SVO' })).toBeDisabled()
  await page.goto('/svo-preview/ordens/exemplo/despacho?estado=conflito')
  await expect(page.getByRole('alert')).toContainText('409')
  await expect(page.getByRole('button', { name: 'Confirmar despacho' })).toBeDisabled()
})

test('expõe os estados alternativos das filas somente quando pedidos pela URL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  for (const fila of ['solicitacoes', 'ordens', 'equipe/minhas-ordens']) {
    for (const [estado, mensagem] of [
      ['loading', 'Carregando a listagem…'], ['erro', 'Não foi possível consultar a listagem.'],
      ['vazio', 'Nenhum registro encontrado para os filtros selecionados.'],
    ]) {
      await page.goto('/svo-preview/' + fila + '?estado=' + estado)
      await expect(page.getByText(mensagem, { exact: true })).toBeVisible()
    }
  }
})

test('navegação móvel, teclado, histórico e formulário de preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  await page.goto('/svo-preview')
  const abrir = page.getByRole('button', { name: 'Abrir menu' })
  await expect(page.getByRole('heading', { name: 'Nova Solicitação SVO' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(abrir).toBeFocused()
  await expect(abrir).toHaveAttribute('aria-expanded', 'false')
  await page.keyboard.press('Enter')
  const dashboard = page.getByRole('link', { name: 'Dashboard SVO' })
  await expect(dashboard).toBeFocused()
  expect(await dashboard.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('#svo-menu').getByRole('button', { name: 'Fechar menu' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(abrir).toBeFocused()
  await expect(dashboard).toHaveCount(0)
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Canal de atendimento')).toBeFocused()
  await page.getByLabel('Nome completo').fill('Teste de teclado')
  await expect(page.getByRole('button', { name: 'Confirmar solicitação' })).toBeDisabled()
  await abrir.click()
  await page.getByRole('link', { name: 'Solicitações', exact: true }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Solicitações', exact: true })).toBeVisible()
  await expect(abrir).toHaveAttribute('aria-expanded', 'false')
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Nova Solicitação SVO' })).toBeVisible()
  await page.goForward()
  await expect(page.getByRole('heading', { name: 'Solicitações', exact: true })).toBeVisible()
})

test('decisão local e variantes de conflito, leitura e ocupação no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 })
  const triagem = '/svo-preview/solicitacoes/exemplo/triagem'
  await page.goto(triagem)
  await page.getByRole('radio', { name: 'IML' }).check()
  await expect(page.getByRole('radio', { name: 'IML' })).toBeChecked()
  await page.reload()
  await expect(page.getByRole('radio', { name: 'IML' })).not.toBeChecked()
  await page.goto(triagem + '?estado=conflito')
  await expect(page.getByRole('alert')).toContainText('409')
  await page.goto(triagem + '?estado=concluida')
  await expect(page.getByLabel('Observações da triagem')).not.toBeEditable()
  for (const [query, texto] of [['', 'Indisponível'], ['?estado=disponivel', 'Disponível'], ['?estado=ocupado', 'Ocupado'], ['?estado=conflito', 'Indisponível']]) {
    await page.goto('/svo-preview/ordens/exemplo/despacho' + query)
    await expect(page.getByText('Disponibilidade: ' + texto, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirmar despacho' })).toBeDisabled()
  }
  await page.getByRole('link', { name: 'Cancelar' }).click()
  await expect(page.getByRole('heading', { name: 'Detalhe da ordem' })).toBeVisible()
})

test('apresenta a sequência da Sprint 7 e distingue o percurso da equipe', async ({ page }) => {
  await page.goto('/svo-preview')
  const ajuda = page.getByRole('complementary')
  await expect(ajuda.getByText(/entra na fila Aguardando triagem/)).toBeVisible()
  await expect(ajuda.getByText(/Somente a decisão SVO gera uma ordem/)).toBeVisible()
  await page.getByRole('link', { name: 'Minhas Ordens' }).click()
  await page.getByRole('link', { name: 'Ver execução' }).click()
  await expect(page.getByRole('heading', { name: 'Execução da ordem' })).toBeVisible()
  await expect(page.locator('.svo-cabecalho__direita strong')).toHaveText('Equipe de coleta')
  await expect(page.getByRole('button', { name: 'Iniciar execução' })).toBeDisabled()
})

for (const width of [390, 768, 1280]) {
  test('triagem interativa por teclado em ' + width + ' px', async ({ page }) => {
    await page.setViewportSize({ width, height: 850 })
    const url = '/svo-preview/solicitacoes/exemplo/triagem'
    await page.goto(url)
    const svo = page.getByRole('radio', { name: 'SVO', exact: true })
    const iml = page.getByRole('radio', { name: 'IML', exact: true })
    const notas = page.getByLabel('Observações da triagem')
    const salvar = page.getByRole('button', { name: 'Salvar andamento' })
    const confirmar = page.getByRole('button', { name: 'Confirmar SVO' })
    const encaminhar = page.getByRole('button', { name: 'Encaminhar IML' })
    await expect(salvar).toBeDisabled()
    await svo.press('Space')
    await expect(svo).toBeChecked()
    await expect(encaminhar).toBeDisabled()
    await page.keyboard.press('Tab')
    await expect(notas).toBeFocused()
    await page.keyboard.type('Observação da prévia')
    await page.keyboard.press('Tab')
    await expect(salvar).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('Salvar andamento:')
    await confirmar.press('Enter')
    await expect(page.getByRole('dialog', { name: 'Confirmar decisão da triagem' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Voltar à triagem' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(confirmar).toBeFocused()
    await expect(notas).toHaveValue('Observação da prévia')
    await confirmar.press('Enter')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Confirmar prévia' })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Confirmar prévia' }).press('Enter')
    await expect(page.getByRole('status')).toContainText('Confirmar SVO:')
    await expect(confirmar).toBeFocused()
    await svo.press('ArrowRight')
    await expect(iml).toBeChecked()
    await expect(confirmar).toBeDisabled()
    await encaminhar.press('Enter')
    await page.getByRole('button', { name: 'Confirmar prévia' }).press('Enter')
    await expect(page.getByRole('status')).toContainText('Encaminhar IML:')
    await expect(page.getByRole('status')).toContainText('integração com o backend')
    await page.reload()
    await expect(notas).toHaveValue('')
    await expect(iml).not.toBeChecked()
    for (const estado of ['conflito', 'concluida']) {
      await page.goto(url + '?estado=' + estado)
      await expect(svo).toBeDisabled()
      await expect(notas).not.toBeEditable()
      for (const acao of [salvar, confirmar, encaminhar]) await expect(acao).toBeDisabled()
    }
  })
}

test('não exige dados pessoais sem contrato nem confunde fila atual com indicadores de período', async ({ page }) => {
  await page.goto('/svo-preview/nova-solicitacao')
  await expect(page.getByLabel('CPF')).toBeDisabled()
  await expect(page.getByLabel('Data de nascimento')).toBeDisabled()
  await expect(page.getByLabel('Local do falecimento')).toHaveAttribute('required', '')
  await expect(page.getByLabel('Telefone / WhatsApp')).not.toHaveAttribute('required')
  await page.goto('/svo-preview/dashboard')
  await expect(page.getByRole('heading', { name: 'Aguardando triagem', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Encaminhadas ao IML', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '30 dias', exact: true }).click()
  await expect(page.getByRole('button', { name: '30 dias', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Fila atual · independente do período')).toBeVisible()
  await expect(page.locator('.svo-indicadores strong')).toHaveText(['—', '—', '—', '—', '—', '—'])
})

test('triagem não permite decisão enquanto a consulta carrega ou falha', async ({ page }) => {
  for (const estado of ['loading', 'erro']) {
    await page.goto('/svo-preview/solicitacoes/exemplo/triagem?estado=' + estado)
    await expect(page.getByRole('radio', { name: 'SVO', exact: true })).toBeDisabled()
    await expect(page.getByLabel('Observações da triagem')).not.toBeEditable()
  }
})
