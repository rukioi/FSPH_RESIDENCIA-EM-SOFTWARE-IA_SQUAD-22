import { expect, test } from '@playwright/test'

// Fixtures exclusivas deste teste; nenhum servidor ou banco recebe as requisições.
for (const width of [390, 768, 1280]) {
  test(`cadastro SVO aguarda protocolo sem antecipar ordem em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-svo-dashboard'))
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
    const inesperadas: string[] = []
    const erros: string[] = []
    page.on('pageerror', error => erros.push(error.message))
    let liberar!: () => void
    const aguardar = new Promise<void>(resolve => { liberar = resolve })
    let corpo: unknown
    let envios = 0
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      const method = route.request().method()
      if (method === 'GET' && path === '/api/auth/sessao') return route.fulfill({ json: { data: {
        id: '42', nome: 'Atendente de teste', email: 'svo@example.invalid', perfil: 'ATENDENTE_SVO',
      } } })
      if(path==='/api/svo/dashboard') return route.fulfill({json:{periodo:'hoje',inicio:'2026-11-05',fim:'2026-11-05',indicadores:{aguardandoTriagem:3,confirmadasSvo:7,ordensColeta:7,encaminhadasIml:2},visaoGeral:{aguardandoTriagem:1,confirmadasSvo:1,encaminhadasIml:0,semClassificacao:0}}})
      if(path==='/api/svo/dashboard/filas') return route.fulfill({json:{aguardandoTriagem:{total:0,itens:[]},aguardandoDespacho:{total:0,itens:[]}}})
      if(path==='/api/svo/dashboard/atividades') return route.fulfill({json:{data:[]}})
      if (method === 'GET' && path === '/api/svo/ordens-coleta/paginadas') return route.fulfill({json:{data:[],meta:{page:1,limit:20,total:0}}})
      if (method === 'GET' && path === '/api/svo/ordens-coleta') return route.fulfill({ json: [] })
      if (method === 'GET' && path === '/api/svo/recursos-disponiveis') return route.fulfill({ json: { motoristas: [], veiculos: [] } })
      if (method === 'POST' && path === '/api/svo/solicitacoes') {
        envios++
        corpo = route.request().postDataJSON()
        await aguardar
        return route.fulfill({ status: 201, json: {
          solicitacao: { id: '9007199254740993', codigo: '#SVO-9007199254740993', statusTriagem: 'AGUARDANDO_TRIAGEM', criadoEm: '2026-11-05T12:00:00.000Z' },
          atividades: ['Solicitação de teste registrada por telefone'],
        } })
      }
      inesperadas.push(`${method} ${path}`)
      return route.abort()
    })
    await page.goto('/svo/dashboard')
    await page.getByRole('button', { name: '+ Nova Solicitação' }).press('Enter')
    await page.getByLabel('Local do falecimento').fill('Unidade de teste')
    await page.getByLabel('Endereço de remoção').fill('Endereço de teste')
    await page.getByLabel('Nome do solicitante').fill('Pessoa de teste')
    await page.getByRole('button', { name: 'Registrar', exact: true }).press('Enter')
    await expect(page.getByRole('button', { name: 'Registrando...' })).toBeDisabled()
    await expect(page.getByText(/#SVO-9007199254740993/)).toHaveCount(0)
    liberar()
    await expect(page.getByRole('status').filter({hasText:'Solicitação'})).toContainText('Solicitação #SVO-9007199254740993 registrada. Aguardando triagem; nenhuma ordem de coleta foi criada.')
    expect(corpo).toEqual({ localFalecimento: 'Unidade de teste', enderecoRemocao: 'Endereço de teste', solicitanteNome: 'Pessoa de teste', canalAtendimento: 'TELEFONE' })
    expect(envios).toBe(1)
    await page.getByRole('link', {name:'Voltar ao dashboard'}).press('Enter')
    await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['3', '7', '2', '7'])
    await expect(page.getByText('Nenhuma ordem aguardando despacho.')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`cadastro-confirmado-${width}.png`), fullPage: true })
    expect(inesperadas).toEqual([])
    expect(erros).toEqual([])
  })

  test(`dashboard SVO distingue falha de consulta vazia em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 850 })
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-svo-dashboard'))
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }))
    const erros: string[] = []
    const inesperadas: string[] = []
    page.on('pageerror', error => erros.push(error.message))
    page.on('console', msg => {
      // O 503 intencional abaixo produz diagnóstico de rede no Chromium.
      if (['error', 'warning'].includes(msg.type()) && !msg.text().includes('503 (Service Unavailable)')) erros.push(msg.text())
    })
    let falhar = true
    let falharRecursos = false
    await page.route(url => url.pathname.startsWith('/api/'), async route => {
      const path = new URL(route.request().url()).pathname
      if (route.request().method() !== 'GET') {
        inesperadas.push(path)
        return route.abort()
      }
      if (path === '/api/auth/sessao') return route.fulfill({ json: { data: {
        id: '42', nome: 'Atendente de teste', email: 'svo@example.invalid', perfil: 'ATENDENTE_SVO',
      } } })
      if(path==='/api/svo/dashboard') return route.fulfill({json:{periodo:'hoje',inicio:'2026-11-05',fim:'2026-11-05',indicadores:{aguardandoTriagem:3,confirmadasSvo:7,ordensColeta:7,encaminhadasIml:2},visaoGeral:{aguardandoTriagem:1,confirmadasSvo:1,encaminhadasIml:0,semClassificacao:0}}})
      if(path==='/api/svo/dashboard/filas') return route.fulfill({json:{aguardandoTriagem:{total:0,itens:[]},aguardandoDespacho:{total:0,itens:[]}}})
      if(path==='/api/svo/dashboard/atividades') return route.fulfill({json:{data:[]}})
      if (path === '/api/svo/ordens-coleta/paginadas') return route.fulfill({json:{data:[],meta:{page:1,limit:20,total:0}}})
      if (path === '/api/svo/ordens-coleta' && falhar) return route.fulfill({ status: 503, json: {
        error: { code: 'ERRO_INTERNO', message: 'Consulta temporariamente indisponível.' },
      } })
      if (path === '/api/svo/ordens-coleta') return route.fulfill({ json: [] })
      if (path === '/api/svo/recursos-disponiveis') return route.fulfill(falharRecursos
        ? { status: 503, json: { error: { code: 'ERRO_INTERNO', message: 'Recursos indisponíveis.' } } }
        : { json: { motoristas: [], veiculos: [] } })
      inesperadas.push(path)
      return route.abort()
    })
    await page.goto('/svo')
    await expect(page.getByRole('alert')).toContainText('Consulta temporariamente indisponível')
    expect(await page.getByRole('button', { name: 'Tentar novamente' }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40)
    if (width > 900) expect(await page.getByRole('button', { name: 'Sair' }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40)
    await expect(page.getByText('Nenhuma ordem aguardando despacho.')).toHaveCount(0)
    await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['3', '7', '2', '7'])
    await expect(page.getByText('Dados ilustrativos')).toHaveCount(0)
    await expect(page.getByText('Nenhuma atividade SVO registrada.')).toBeVisible()
    await page.screenshot({ path: info.outputPath(`dashboard-erro-${width}.png`), fullPage: true })
    falhar = false
    await page.getByRole('button', { name: 'Tentar novamente' }).press('Enter')
    await expect(page.getByText('Nenhuma ordem aguardando despacho.')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.locator('nav [aria-current="page"]')).toHaveText('Dashboard SVO')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`dashboard-vazio-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: '+ Nova Solicitação' }).press('Enter')
    await expect(page.getByRole('heading', { name: 'Nova Solicitação', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Dashboard SVO', exact: true })).toBeVisible()
    falharRecursos = true
    await page.reload()
    await expect(page.getByRole('alert')).toContainText('Recursos indisponíveis.')
    await expect(page.getByText('Nenhuma ordem aguardando despacho.')).toBeVisible()
    expect(inesperadas).toEqual([])
    expect(erros).toEqual([])
  })
}
