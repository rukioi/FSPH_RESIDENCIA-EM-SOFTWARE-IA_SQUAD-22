import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

// Respostas exclusivamente de teste: estes cenários não são evidência de persistência nem prints de apresentação.
async function preparar(page: Page) {
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-svo-integracao'))
  const chamadas: { metodo: string; path: string; body: unknown }[] = []
  const inesperadas: string[] = []
  const erros: string[] = []
  page.on('pageerror', e => erros.push(e.message))
  page.on('console', mensagem => {
    // Erros HTTP intencionais têm validação própria; qualquer outro diagnóstico falha o teste.
    if (['error','warning'].includes(mensagem.type()) && !/^Failed to load resource: the server responded with a status of (400|401|403|404|409|503)\b/.test(mensagem.text())) erros.push(mensagem.text())
  })
  let status: 'AGUARDANDO_TRIAGEM' | 'CONFIRMADA_SVO' | 'ENCAMINHADA_IML' = 'AGUARDANDO_TRIAGEM'
  let observacoes='Rascunho persistido de teste'
  let quantidade=0
  let cadastrado = false
  let falha = 0
  let aguardar: Promise<void> | null = null
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({contentType:'text/css',body:''}))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const req=route.request(), url=new URL(req.url()), path=url.pathname, metodo=req.method()
    const body=req.postData() ? req.postDataJSON() : undefined
    chamadas.push({metodo,path: url.pathname+url.search,body})
    if (metodo==='GET' && path==='/api/auth/sessao') return route.fulfill({json:{data:{id:'42',nome:'Atendente de teste',email:'teste@example.invalid',perfil:'ATENDENTE_SVO'}}})
    if (metodo==='GET' && path==='/api/svo/solicitacoes/paginadas') {
      const data=cadastrado && (!url.searchParams.has('status') || url.searchParams.get('status')===status)
        ? [{id:'71',codigo:'#SVO-71',statusTriagem:status,criadoEm:'2026-11-05T12:00:00.000000'}] : []
      return route.fulfill({json:{data,meta:{page:Number(url.searchParams.get('page')),limit:20,total:data.length}}})
    }
    if (metodo==='GET' && path==='/api/svo/solicitacoes/71') {
      if(!cadastrado) return route.fulfill({status:404,json:{erro:'Solicitação não encontrada.'}})
      return route.fulfill({json:{id:'71',codigo:'#SVO-71',statusTriagem:status,criadoEm:'2026-11-05T12:00:00.000000',triagemObservacoes:observacoes,
        triadoPorId:status==='AGUARDANDO_TRIAGEM'?null:'42',triadoEm:status==='AGUARDANDO_TRIAGEM'?null:'2026-11-05T13:00:00.000000',
        localFalecimento:'Unidade de teste',enderecoRemocao:'Rua de teste',pontoReferencia:null,canalAtendimento:'TELEFONE',solicitanteNome:'Pessoa de teste',
        solicitanteParentesco:null,solicitanteTelefone:null,nomeFalecido:null,observacoesMedicas:null,
        ordemColeta:status==='CONFIRMADA_SVO'?{id:'72',codigo:'#OC-72',status:'PENDENTE_ALOCACAO',quantidadeCorpos:quantidade,motoristaId:null,veiculoId:null}:null}})
    }
    if (metodo==='GET' && path==='/api/svo/ordens-coleta/paginadas') {
      const data=status==='CONFIRMADA_SVO' ? [{id:'72',codigo:'#OC-72',status:'PENDENTE_ALOCACAO',solicitacaoId:'71',solicitacaoCodigo:'#SVO-71',quantidadeCorpos:quantidade}] : []
      return route.fulfill({json:{data,meta:{page:1,limit:20,total:data.length}}})
    }
    if (metodo==='GET' && path==='/api/svo/recursos-disponiveis') return route.fulfill({json:{motoristas:[],veiculos:[]}})
    if (metodo==='POST' && path==='/api/svo/solicitacoes') {
      if(aguardar) await aguardar
      if(falha) return route.fulfill({status:falha,json:{error:{code:`HTTP_${falha}`,message:'Cadastro recusado no teste.'}}})
      cadastrado=true
      return route.fulfill({status:201,json:{solicitacao:{id:'71',codigo:'#SVO-71',statusTriagem:'AGUARDANDO_TRIAGEM',criadoEm:'2026-11-05T12:00:00.000Z'},atividades:[]}})
    }
    if (path==='/api/svo/solicitacoes/71/triagem' && ['PATCH','POST'].includes(metodo)) {
      if(aguardar) await aguardar
      if(falha) return route.fulfill({status:falha,json:{error:{code:`HTTP_${falha}`,message:'Triagem recusada no teste.'}}})
      observacoes=body.triagemObservacoes
      if(metodo==='PATCH') return route.fulfill({json:{solicitacaoId:'71',statusTriagem:status,triagemObservacoes:body.triagemObservacoes,atividades:[]}})
      status=body.decisao
      quantidade=body.quantidadeCorpos
      return route.fulfill({json:{solicitacao:{id:'71',codigo:'#SVO-71',statusTriagem:status,triadoPorId:'42',triadoEm:'2026-11-05T13:00:00.000Z'},
        ordemColeta:status==='CONFIRMADA_SVO'?{id:'72',codigo:'#OC-72',status:'PENDENTE_ALOCACAO',quantidadeCorpos:body.quantidadeCorpos}:null,atividades:[]}})
    }
    inesperadas.push(`${metodo} ${path}`); return route.abort()
  })
  return {chamadas,inesperadas,erros,registrar:()=>{cadastrado=true},falhar:(code:number)=>{falha=code},esperar:(promise:Promise<void>|null)=>{aguardar=promise}}
}

for(const width of [390,768,1280]) {
  test(`cadastro completo e consulta posterior em ${width}px`, async ({page}, info) => {
    await page.setViewportSize({width,height:900})
    const controle=await preparar(page)
    await page.goto('/svo/solicitacoes/nova')
    await page.getByLabel('Nome do solicitante').fill('Pessoa de teste')
    await page.getByLabel('Telefone / WhatsApp').fill('79999999999')
    await page.getByLabel('Relação com a pessoa falecida').fill('Parente')
    await page.getByLabel('Nome da pessoa falecida').fill('Registro de teste')
    await page.getByLabel('Local do falecimento').fill('Unidade de teste')
    await page.getByLabel('Endereço de remoção').fill('Rua de teste')
    await page.getByLabel('Ponto de referência').fill('Referência de teste')
    await page.getByLabel('Informações validadas na ligação').fill('Relato de teste')
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath(`teste-cadastro-${width}.png`),fullPage:true})
    controle.falhar(400)
    await page.getByRole('button',{name:'Registrar',exact:true}).press('Enter')
    await expect(page.getByRole('alert')).toContainText('Cadastro recusado')
    await expect(page.getByLabel('Nome do solicitante')).toHaveValue('Pessoa de teste')
    controle.falhar(0)
    let liberar!:()=>void
    controle.esperar(new Promise<void>(r=>{liberar=r}))
    await page.getByRole('button',{name:'Registrar',exact:true}).press('Enter')
    await expect(page.getByRole('button',{name:'Registrando...'})).toBeDisabled()
    await expect(page.getByLabel('Nome do solicitante')).toBeDisabled()
    // Mesmo dois eventos síncronos de submit não podem iniciar nova requisição.
    await page.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})
    expect(controle.chamadas.filter(c=>c.metodo==='POST').length).toBe(2)
    liberar()
    await expect(page.getByRole('status')).toContainText('#SVO-71 registrada. Aguardando triagem; nenhuma ordem')
    expect(controle.chamadas.filter(c=>c.metodo==='POST').at(-1)?.body).toEqual({localFalecimento:'Unidade de teste',enderecoRemocao:'Rua de teste',solicitanteNome:'Pessoa de teste',nomeFalecido:'Registro de teste',solicitanteTelefone:'79999999999',solicitanteParentesco:'Parente',pontoReferencia:'Referência de teste',observacoesMedicas:'Relato de teste',canalAtendimento:'TELEFONE'})
    await page.getByRole('link',{name:'Consultar solicitações'}).click()
    await expect(page.getByRole('cell',{name:'#SVO-71',exact:true})).toBeVisible()
    await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('AGUARDANDO_TRIAGEM')
    await page.reload()
    await expect(page.getByRole('combobox',{name:'Status',exact:true})).toHaveValue('AGUARDANDO_TRIAGEM')
    await expect(page.getByRole('cell',{name:'#SVO-71',exact:true})).toBeVisible()
    expect(controle.chamadas.some(c=>c.path==='/api/svo/solicitacoes/paginadas?page=1&limit=20&status=AGUARDANDO_TRIAGEM')).toBe(true)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await page.screenshot({path:info.outputPath(`teste-solicitacoes-${width}.png`),fullPage:true})
    expect(controle.inesperadas).toEqual([]); expect(controle.erros).toEqual([])
  })
  for(const destino of ['SVO','IML']) test(`triagem ${destino} e releitura em ${width}px`, async ({page}, info)=>{
    await page.setViewportSize({width,height:900})
    const controle=await preparar(page);controle.registrar()
    await page.goto('/svo/solicitacoes/71/triagem')
    const notas=page.getByLabel('Observações da triagem')
    await expect(notas).toBeEditable()
    await expect(notas).toHaveValue('Rascunho persistido de teste')
    await notas.fill('Justificativa de teste')
    await page.getByRole('button',{name:'Salvar andamento'}).press('Enter')
    await expect(page.getByRole('status').filter({hasText:'Andamento salvo pelo servidor'})).toBeVisible()
    await page.reload()
    await expect(notas).toHaveValue('Justificativa de teste')
    expect(controle.chamadas.filter(c=>c.metodo==='POST')).toHaveLength(0)
    await page.getByRole('radio',{name:destino,exact:true}).check()
    if(destino==='SVO') {
      await expect(page.getByRole('button',{name:'Concluir triagem'})).toBeDisabled()
      await page.getByLabel('Quantidade de corpos').fill('2')
    }
    await page.getByRole('button',{name:'Concluir triagem'}).press('Enter')
    await expect(page.getByRole('button',{name:'Voltar à triagem'})).toBeFocused()
    await page.screenshot({path:info.outputPath(`teste-confirmacao-${destino}-${width}.png`),fullPage:true})
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button',{name:'Concluir triagem'})).toBeFocused()
    await page.getByRole('button',{name:'Concluir triagem'}).press('Enter')
    await page.getByRole('button',{name:destino==='SVO'?'Confirmar SVO':'Encaminhar IML',exact:true}).press('Enter')
    await expect(page.getByRole('status').filter({hasText:destino==='SVO'?'Ordem #OC-72 gerada':'Nenhuma ordem de coleta SVO foi criada'})).toBeVisible()
    const post=controle.chamadas.find(c=>c.metodo==='POST')
    expect(post?.body).toEqual(destino==='SVO'?{decisao:'CONFIRMADA_SVO',triagemObservacoes:'Justificativa de teste',quantidadeCorpos:2}:{decisao:'ENCAMINHADA_IML',triagemObservacoes:'Justificativa de teste'})
    await expect(page.getByRole('button',{name:'Concluir triagem'})).toBeDisabled()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    if(destino==='SVO') {
      await page.getByRole('link',{name:'Consultar ordens de coleta'}).click()
      await expect(page.getByRole('cell',{name:'#OC-72',exact:true})).toBeVisible()
      expect(controle.chamadas.some(c=>c.path==='/api/svo/ordens-coleta/paginadas?page=1&limit=20')).toBe(true)
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
      await page.screenshot({path:info.outputPath(`teste-ordens-${width}.png`),fullPage:true})
      await page.goBack()
    }
    await page.reload()
    await expect(page.getByText('Somente leitura.',{exact:false})).toBeVisible()
    await expect(notas).not.toBeEditable()
    await expect(notas).toHaveValue('Justificativa de teste')
    await expect(page.getByRole('radio',{name:destino,exact:true})).toBeChecked()
    await page.getByRole('link',{name:'Voltar às solicitações'}).click()
    await expect(page.getByRole('cell',{name:destino==='SVO'?'Confirmada SVO':'Encaminhada ao IML',exact:true})).toBeVisible()
    expect(controle.inesperadas).toEqual([]);expect(controle.erros).toEqual([])
  })
}
for(const status of [400,401,403,404,409]) test(`triagem trata HTTP ${status} sem confirmar decisão`,async({page})=>{
  const controle=await preparar(page);controle.registrar()
  await page.goto('/svo/solicitacoes/71/triagem')
  await page.getByLabel('Observações da triagem').fill('Texto preservado')
  await page.getByRole('radio',{name:'IML',exact:true}).check()
  controle.falhar(status)
  await page.getByRole('button',{name:'Concluir triagem'}).click()
  await page.getByRole('button',{name:'Encaminhar IML',exact:true}).click()
  if(status===401) { await expect(page).toHaveURL(/\/login$/); return }
  await expect(page.getByRole('alert')).toContainText(`Erro ${status}`)
  await expect(page.getByLabel('Observações da triagem')).toHaveValue('Texto preservado')
  await expect(page.getByText('Nenhuma ordem de coleta SVO foi criada.',{exact:true})).toHaveCount(0)
  if(status===400) await expect(page.getByRole('button',{name:'Concluir triagem'})).toBeEnabled()
  else await expect(page.getByRole('button',{name:'Concluir triagem'})).toBeDisabled()
  expect(controle.inesperadas).toEqual([])
  expect(controle.erros).toEqual([])
})

test('consulta distingue falha, vazio e detalhe inexistente com 404',async({page})=>{
  const controle=await preparar(page)
  let falha=true
  await page.route('**/api/svo/solicitacoes/paginadas?**',async route=>{
    if(!falha) return route.fallback()
    return route.fulfill({status:503,json:{error:{code:'INDISPONIVEL',message:'Consulta indisponível no teste.'}}})
  })
  await page.goto('/svo/solicitacoes')
  await expect(page.getByRole('alert')).toContainText('Consulta indisponível')
  await expect(page.getByText('Nenhum registro encontrado',{exact:false})).toHaveCount(0)
  falha=false
  await page.getByRole('button',{name:'Tentar novamente'}).press('Enter')
  await expect(page.getByText('Nenhum registro encontrado',{exact:false})).toBeVisible()
  await page.goto('/svo/solicitacoes/71/triagem')
  await expect(page.getByRole('alert')).toContainText('Solicitação não encontrada')
  await expect(page.getByRole('button',{name:'Salvar andamento'})).toBeDisabled()
  await expect(page.getByRole('button',{name:'Concluir triagem'})).toBeDisabled()
  await page.goto('/svo/ordens')
  await expect(page.getByText('Nenhuma ordem encontrada para o filtro desta página.')).toBeVisible()
  expect(controle.inesperadas).toEqual([]);expect(controle.erros).toEqual([])
})
