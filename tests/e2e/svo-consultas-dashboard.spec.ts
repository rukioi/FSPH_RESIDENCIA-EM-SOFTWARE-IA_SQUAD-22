import { responderNotificacoesVazias } from './fixtures/svo-ui';
import { expect, test, type Page } from '@playwright/test'

// Fixtures exclusivamente de teste. Não constituem persistência real ou prints de apresentação.
test.use({timezoneId:'Pacific/Auckland'})
async function preparar(page:Page) {
  await page.addInitScript(()=>sessionStorage.setItem('token','fixture-svo-consultas'))
  const urls:string[]=[], erros:string[]=[], inesperadas:string[]=[]
  page.on('pageerror',e=>erros.push(e.message))
  page.on('console',e=>{if(['error','warning'].includes(e.type())&&!e.text().includes('503 (Service Unavailable)')) erros.push(e.text())})
  let falhar=false, vazio=false
  let esperar:Promise<void>|null=null
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}))
  await page.route(url=>url.pathname.startsWith('/api/'),async r=>{
    if (await responderNotificacoesVazias(r)) return;
    const url=new URL(r.request().url()), path=url.pathname
    urls.push(path+url.search)
    if(r.request().method()!=='GET') {inesperadas.push(r.request().method()+' '+path);return r.abort()}
    if(path==='/api/auth/sessao') return r.fulfill({json:{data:{id:'42',nome:'Atendente de teste',email:'teste@example.invalid',perfil:'ATENDENTE_SVO'}}})
    if(path==='/api/svo/dashboard') {
      const periodo=url.searchParams.get('periodo')
      if(esperar && periodo==='7d') await esperar
      if(falhar) return r.fulfill({status:503,json:{erro:'Indicadores indisponíveis no teste.'}})
      return r.fulfill({json:{periodo,inicio:periodo==='hoje'?'2026-11-05':'2026-10-30',fim:'2026-11-05',
        indicadores:vazio?{aguardandoTriagem:0,confirmadasSvo:0,ordensColeta:0,encaminhadasIml:0}:{aguardandoTriagem:9,confirmadasSvo:periodo==='hoje'?4:8,ordensColeta:periodo==='hoje'?4:8,encaminhadasIml:periodo==='hoje'?1:3},
        visaoGeral:vazio?{aguardandoTriagem:0,confirmadasSvo:0,encaminhadasIml:0,semClassificacao:0}:{aguardandoTriagem:1,confirmadasSvo:2,encaminhadasIml:1,semClassificacao:2}}})
    }
    if(path==='/api/svo/dashboard/filas') return r.fulfill({json:{
      aguardandoTriagem:vazio?{total:0,itens:[]}:{total:9,itens:[{id:'9',codigo:'#SVO-9',criadoEm:'2020-01-01T00:01:02.000000'}]},
      aguardandoDespacho:vazio?{total:0,itens:[]}:{total:3,itens:[{id:'8',codigo:'#OC-8',solicitacaoCodigo:'#SVO-8',quantidadeCorpos:2}]}}})
    if(path==='/api/svo/dashboard/atividades') return r.fulfill({json:{data:vazio?[]:[{id:'5',descricao:'Rascunho da triagem de #SVO-9 atualizado',dataHora:'2026-11-05T00:01:02.000000',usuarioId:'42',usuarioNome:'Atendente de teste'}]}})
    if(path==='/api/svo/ordens-coleta') return r.fulfill({json:[]})
    if(path==='/api/svo/recursos-disponiveis') return r.fulfill({json:{motoristas:[],veiculos:[]}})
    if(path==='/api/svo/solicitacoes/paginadas') {
      const pagina=Number(url.searchParams.get('page')), status=url.searchParams.get('status')||'AGUARDANDO_TRIAGEM'
      return r.fulfill({json:{data:[{id:String(pagina),codigo:`#SVO-${pagina}`,statusTriagem:status,criadoEm:'2026-11-05T00:01:02.000000'}],meta:{page:pagina,limit:20,total:21}}})
    }
    if(path==='/api/svo/ordens-coleta/paginadas') return r.fulfill({json:{data:[{id:'8',codigo:'#OC-8',solicitacaoId:'9',solicitacaoCodigo:'#SVO-9',quantidadeCorpos:2,status:url.searchParams.get('status')||'PENDENTE_ALOCACAO'}],meta:{page:Number(url.searchParams.get('page')),limit:20,total:1}}})
    inesperadas.push(path);return r.abort()
  })
  return {urls,erros,inesperadas,falhar:(valor:boolean)=>{falhar=valor},zerar:()=>{vazio=true},esperar:(promise:Promise<void>)=>{esperar=promise}}
}
for(const width of [390,768,1280]) {
  test(`dashboard usa agregações, filas e eventos de período em ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900})
    const c=await preparar(page)
    await page.goto('/svo/dashboard')
    await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['9','4','1','4'])
    await expect(page.getByRole('heading',{name:'Aguardando triagem: 9',exact:true})).toBeVisible()
    await expect(page.getByText('01/01/2020, 00:01:02',{exact:true})).toBeVisible()
    await expect(page.locator('.svo-atividade time')).toHaveText('05/11/2026, 00:01:02')
    await expect(page.locator('.svo-grafico__legenda strong')).toHaveText(['1','2','1','2'])
    const filaAntes=c.urls.filter(url=>url==='/api/svo/dashboard/filas').length
    await page.getByRole('button',{name:'7 dias',exact:true}).press('Enter')
    await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['9','8','3','8'])
    expect(c.urls.filter(url=>url==='/api/svo/dashboard/filas')).toHaveLength(filaAntes)
    await expect(page.getByText('01/01/2020, 00:01:02',{exact:true})).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button',{name:'7 dias',exact:true})).toHaveAttribute('aria-pressed','true')
    await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['9','8','3','8'])
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.evaluate(()=>scrollTo(0,0))
    await page.screenshot({path:info.outputPath(`teste-dashboard-${width}.png`),fullPage:true})
    c.falhar(true)
    await page.getByRole('button',{name:'Atualizar dashboard'}).press('Enter')
    await expect(page.getByRole('alert')).toContainText('Indicadores indisponíveis')
    await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['—','—','—','—'])
    await expect(page.getByRole('heading',{name:'Aguardando triagem: 9',exact:true})).toBeVisible()
    c.falhar(false);c.zerar()
    await page.getByRole('button',{name:'Atualizar dashboard'}).press('Enter')
    await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['0','0','0','0'])
    await expect(page.getByText('Nenhuma solicitação criada no período.')).toBeVisible()
    await expect(page.getByText('Nenhuma atividade SVO registrada.')).toBeVisible()
    expect(c.inesperadas).toEqual([]);expect(c.erros).toEqual([])
  })
  test(`listas paginadas preservam filtros, datas civis e status reais em ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900})
    const c=await preparar(page)
    await page.goto('/svo/solicitacoes?page=2&status=AGUARDANDO_TRIAGEM&inicio=2026-11-01&fim=2026-11-05')
    await expect(page.getByRole('cell',{name:'#SVO-2',exact:true})).toBeVisible()
    await expect(page.getByRole('cell',{name:'05/11/2026, 00:01:02',exact:true})).toBeVisible()
    await expect(page.getByRole('button',{name:'Próxima página'})).toBeDisabled()
    await page.getByRole('button',{name:'Página anterior'}).press('Enter')
    await expect(page.getByRole('cell',{name:'#SVO-1',exact:true})).toBeVisible()
    await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('ENCAMINHADA_IML')
    await page.reload()
    await expect(page.getByRole('cell',{name:'Encaminhada ao IML',exact:true})).toBeVisible()
    await expect(page.getByLabel('Recebidas desde')).toHaveValue('2026-11-01')
    expect(c.urls.some(url=>url==='/api/svo/solicitacoes/paginadas?page=1&limit=20&status=ENCAMINHADA_IML&inicio=2026-11-01&fim=2026-11-05')).toBe(true)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath(`teste-listas-${width}.png`),fullPage:true})
    await page.goto('/svo/ordens?status=EM_DESLOCAMENTO')
    await expect(page.getByRole('cell',{name:'Em deslocamento',exact:true})).toBeVisible()
    await expect(page.getByRole('link',{name:'#SVO-9',exact:true})).toHaveAttribute('href','/svo/solicitacoes/9')
    await page.reload()
    await expect(page.getByRole('combobox',{name:'Status da ordem'})).toHaveValue('EM_DESLOCAMENTO')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    expect(c.inesperadas).toEqual([]);expect(c.erros).toEqual([])
  })
}
test('resposta atrasada de outro período não sobrescreve a seleção atual',async({page})=>{
  const c=await preparar(page)
  let liberar!:()=>void
  c.esperar(new Promise<void>(resolve=>{liberar=resolve}))
  await page.goto('/svo/dashboard')
  await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['9','4','1','4'])
  await page.getByRole('button',{name:'7 dias',exact:true}).click()
  await expect.poll(()=>c.urls.includes('/api/svo/dashboard?periodo=7d')).toBe(true)
  await page.getByRole('button',{name:'Hoje',exact:true}).click()
  await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['9','4','1','4'])
  liberar()
  await expect(page.getByRole('button',{name:'Hoje',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['9','4','1','4'])
  expect(c.inesperadas).toEqual([])
})

test('Ver todas abre a listagem integrada de ordens pelo teclado',async({page})=>{
  const c=await preparar(page)
  await page.goto('/svo/dashboard')
  await page.getByText('Ver todas',{exact:true}).press('Enter')
  await expect(page).toHaveURL(/\/svo\/ordens$/)
  await expect(page.getByRole('cell',{name:'#OC-8',exact:true})).toBeVisible()
  expect(c.inesperadas).toEqual([])
})
