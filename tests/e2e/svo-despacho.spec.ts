import {expect,test,type Page} from '@playwright/test'

// Respostas controladas somente para regressão do frontend; não comprovam persistência.
async function preparar(page:Page, conflito=false) {
  const state={ocupacao:0,recursos:0,consultasOcupacao:0,envios:0,legadas:0,despachada:false,quantidade:1,falhaOcupacao:false}
  await page.addInitScript(()=>sessionStorage.setItem('token','fixture-despacho'))
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const path=new URL(route.request().url()).pathname
    if(path==='/api/auth/sessao')return route.fulfill({json:{data:{id:'42',nome:'Fixture',email:'fixture@example.invalid',perfil:'ATENDENTE_SVO'}}})
    if(path==='/api/svo/dashboard')return route.fulfill({json:{periodo:'hoje',inicio:'2026-11-05',fim:'2026-11-05',indicadores:{aguardandoTriagem:0,confirmadasSvo:2,ordensColeta:2,encaminhadasIml:0},visaoGeral:{aguardandoTriagem:0,confirmadasSvo:2,encaminhadasIml:0,semClassificacao:0}}})
    if(path==='/api/svo/dashboard/filas')return route.fulfill({json:{aguardandoTriagem:{total:0,itens:[]},aguardandoDespacho:{total:0,itens:[]}}})
    if(path==='/api/svo/dashboard/atividades')return route.fulfill({json:{data:[]}})
    if(['/api/motoristas','/api/veiculos'].includes(path)){state.legadas++;return route.fulfill({json:{data:[]}})}
    if(path==='/api/svo/recursos-disponiveis'){
      state.recursos++
      return route.fulfill({json:{motoristas:[{id:'5',nome:'Condutor de teste'},{id:'6',nome:'Outro condutor'}],veiculos:[
        {id:'2',placa:'TESTE02',modelo:'S10 de teste',ocupacao:state.ocupacao,capacidade:4,disponivel:state.ocupacao<4},
        {id:'3',placa:'TESTE03',modelo:'S10 lotada',ocupacao:4,capacidade:4,disponivel:false},
        {id:'4',placa:'TESTE04',modelo:'S10 inelegível',ocupacao:0,capacidade:4,disponivel:false},
      ]}})
    }
    if(path==='/api/svo/ordens-coleta')return route.fulfill({json:(state.despachada?['8']:['7','8']).map(id=>({id,status:'PENDENTE_ALOCACAO',solicitacao_obito_id:id,solicitacao_codigo:'#SVO-'+id,nome_falecido:null,endereco_remocao:'Endereço de teste'}))})
    if(path==='/api/svo/ordens-coleta/paginadas') return route.fulfill({json:{
      data:['8','7'].map(id=>({id,codigo:'#OC-'+id,solicitacaoId:id,solicitacaoCodigo:'#SVO-'+id,
        quantidadeCorpos:1,status:id==='7'&&state.despachada?'EM_DESLOCAMENTO':'PENDENTE_ALOCACAO'})),
      meta:{page:1,limit:20,total:2},
    }})
    const detalhe=path.match(/^\/api\/svo\/ordens-coleta\/(7|8)$/)
    if(detalhe)return route.fulfill({json:{id:detalhe[1],codigo:'#OC-'+detalhe[1],status:'PENDENTE_ALOCACAO',solicitacaoId:detalhe[1],solicitacaoCodigo:'#SVO-'+detalhe[1],quantidadeCorpos:state.quantidade,statusTriagem:'CONFIRMADA_SVO',motoristaId:null,veiculoId:null,kmInicial:null,kmFinal:null,dataInicio:null,dataFim:null,enderecoRemocao:'Endereço de teste'}})
    if(path==='/api/svo/veiculos/2/ocupacao'){
      state.consultasOcupacao++
      return route.fulfill(state.falhaOcupacao?{status:503,json:{erro:'Consulta indisponível.'}}:{json:{id:'2',placa:'TESTE02',ocupacao:state.ocupacao,capacidade:4,disponivel:state.ocupacao<4}})
    }
    if(path==='/api/svo/ordens-coleta/7/despachar'){
      state.envios++
      expect(route.request().postDataJSON()).toEqual({motoristaId:5,veiculoId:2})
      if(conflito){state.ocupacao=4;return route.fulfill({status:409,json:{erro:'Conflito de alocação.'}})}
      state.despachada=true;state.ocupacao=1
      return route.fulfill({json:{id:7,motorista_id:5,veiculo_id:2,status:'EM_DESLOCAMENTO'}})
    }
    return route.abort()
  })
  await page.goto('/svo/dashboard')
  await expect(page.getByRole('heading',{name:'Dashboard SVO',exact:true})).toBeVisible()
  return state
}
async function abrir(page:Page,id='7'){
  await page.locator('.svo-despacho__tabela tr').filter({hasText:'#OC-'+id}).getByRole('button',{name:'Preparar despacho'}).press('Enter')
  const modal=page.getByRole('dialog',{name:'Preparar despacho'})
  await expect(modal).toBeVisible()
  return modal
}
for(const width of [390,768,1280])test(`despacho usa capacidade real e mantém S10 com vaga em ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900})
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  const state=await preparar(page)
  await expect.poll(()=>state.recursos).toBeGreaterThan(0)
  const modal=await abrir(page)
  await expect(modal.locator('option[value="3"]')).toBeDisabled()
  await expect(modal.locator('option[value="4"]')).toBeDisabled()
  await modal.getByLabel('Veículo',{exact:true}).selectOption('2')
  await expect(modal.getByText('Ocupação atual: 0/4',{exact:false})).toBeVisible()
  await modal.getByLabel('Motorista',{exact:true}).selectOption('5')
  const confirmar=modal.getByRole('button',{name:'Confirmar despacho',exact:true})
  await expect(confirmar).toBeEnabled()
  await confirmar.focus();await page.keyboard.press('Tab')
  await expect(modal.getByRole('button',{name:'Fechar',exact:true})).toBeFocused()
  await page.keyboard.press('Shift+Tab');await expect(confirmar).toBeFocused()
  const before=state.recursos
  await modal.getByRole('button',{name:'Confirmar despacho',exact:true}).press('Enter')
  await expect(modal).toHaveCount(0)
  await expect.poll(()=>state.recursos).toBeGreaterThan(before)
  const reopened=await abrir(page,'8')
  await expect(reopened.locator('option[value="2"]')).toBeEnabled()
  await expect(reopened.locator('option[value="2"]')).toContainText('1/4')
  await reopened.getByLabel('Veículo',{exact:true}).selectOption('2')
  await expect(reopened.getByText('Ocupação atual: 1/4',{exact:false})).toBeVisible()
  await page.keyboard.press('Escape');await expect(reopened).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.svo-recentes__item').filter({hasText:'#OC-7'})).toContainText('Em deslocamento')
  expect(state.legadas).toBe(0);expect(state.envios).toBe(1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
test('409 mantém modal sem sucesso e reconsulta recursos e ocupação',async({page})=>{
  const state=await preparar(page,true);const modal=await abrir(page)
  await modal.getByLabel('Veículo',{exact:true}).selectOption('2')
  await modal.getByLabel('Motorista',{exact:true}).selectOption('5')
  const before=state.recursos,occupation=state.consultasOcupacao
  await modal.getByRole('button',{name:'Confirmar despacho',exact:true}).click()
  await expect(modal.getByRole('alert').filter({hasText:'409'})).toBeVisible()
  await expect.poll(()=>state.recursos).toBeGreaterThan(before)
  await expect.poll(()=>state.consultasOcupacao).toBeGreaterThan(occupation)
  await expect(modal.getByRole('button',{name:'Confirmar despacho',exact:true})).toBeDisabled()
  await expect(modal.locator('option[value="2"]')).toBeDisabled()
  expect(state.envios).toBe(1)
})
test('ocupação sem espaço suficiente ou consulta falha não autoriza despacho',async({page})=>{
  const state=await preparar(page);state.quantidade=2;state.ocupacao=3
  const modal=await abrir(page)
  await expect(modal.locator('option[value="2"]')).toBeDisabled()
  await expect(modal.getByRole('button',{name:'Confirmar despacho',exact:true})).toBeDisabled()
  await page.keyboard.press('Escape')
  state.quantidade=1;state.ocupacao=0;state.falhaOcupacao=true
  const next=await abrir(page)
  await next.getByLabel('Veículo',{exact:true}).selectOption('2')
  await next.getByLabel('Motorista',{exact:true}).selectOption('5')
  await expect(next.getByRole('alert').filter({hasText:'Consulta indisponível'})).toBeVisible()
  await expect(next.getByRole('button',{name:'Confirmar despacho',exact:true})).toBeDisabled()
  expect(state.envios).toBe(0)
})
