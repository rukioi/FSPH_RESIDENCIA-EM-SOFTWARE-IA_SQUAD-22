import { expect, test, type Page } from '@playwright/test';

async function preparar(page: Page) {
  const itens = [
    {id:'101',titulo:'Nova solicitação aguardando análise',descricao:'Solicitação #TRP-1025',categoria:'informacao',criadoEm:'2026-11-09T11:12:00Z',lidaEm:null},
    {id:'102',titulo:'CNH de Carlos Henrique',descricao:'Validade em 12/11/2026',categoria:'atencao',criadoEm:'2026-11-09T10:40:00Z',lidaEm:null},
    {id:'103',titulo:'Documento CRLV — ABC1234',descricao:'Validade em 04/11/2026',categoria:'urgente',criadoEm:'2026-11-08T21:05:00Z',lidaEm:'2026-11-09T10:00:00Z'},
    {id:'104',titulo:'Veículo ABC5678 em manutenção',descricao:'Mercedes Sprinter',categoria:'atencao',criadoEm:'2026-11-08T12:20:00Z',lidaEm:'2026-11-09T10:00:00Z'},
    {id:'105',titulo:'Solicitação aprovada',descricao:'Solicitação #TRP-1022',categoria:'sucesso',criadoEm:'2026-11-08T11:22:00Z',lidaEm:'2026-11-09T10:00:00Z'},
  ];
  await page.route('**/api/auth/sessao',r=>r.fulfill({json:{data:{id:'1',nome:'Carlos Almeida',email:'gestor@example.invalid',perfil:'GESTOR_FROTA'}}}));
  await page.route('**/api/notificacoes/sincronizar',r=>r.fulfill({json:{data:{atualizadas:0}}}));
  await page.route('**/api/notificacoes?*',r=>{
    const filtro = new URL(r.request().url()).searchParams.get('filtro');
    const data = itens.filter(n=>filtro==='lidas'?!!n.lidaEm:filtro==='nao-lidas'?!n.lidaEm:true);
    return r.fulfill({json:{data,meta:{page:1,limit:20,total:data.length,naoLidas:itens.filter(n=>!n.lidaEm).length}}});
  });
  await page.route(/\/api\/notificacoes\/(\d+\/ler|ler-todas)$/,async r=>{
    const id = r.request().url().match(/\/(\d+)\/ler$/)?.[1];
    for (const n of itens) if (!id || n.id===id) n.lidaEm='2026-11-09T12:00:00Z';
    await r.fulfill({json:{data:{atualizadas:1}}});
  });
  await page.addInitScript(()=>sessionStorage.setItem('token','fixture'));
}

for (const width of [390,768,1280]) {
  test(`caixa individual, sininho, filtros e leitura em ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    await preparar(page);
    await page.goto('/notificacoes');
    await expect(page.getByRole('heading',{name:'Notificações',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Abrir notificações: 2 não lidas',exact:true})).toBeVisible();
    await expect(page.locator('.notificacoes__item')).toHaveCount(5);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`notificacoes-${width}.png`),fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'Não lidas',exact:true}).click();
    await expect(page.locator('.notificacoes__item')).toHaveCount(2);
    await page.getByRole('button',{name:'Marcar como lida: Nova solicitação aguardando análise'}).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.notificacoes__item')).toHaveCount(1);
    await expect(page.getByRole('button',{name:'Abrir notificações: 1 não lidas',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Marcar todas como lidas'}).click();
    await expect(page.getByText('Tudo em dia!')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button',{name:'Abrir notificações: 0 não lidas',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Lidas',exact:true}).click();
    await expect(page.locator('.notificacoes__item')).toHaveCount(5);
    await page.getByRole('button',{name:'Abrir notificações: 0 não lidas',exact:true}).click();
    await expect(page).toHaveURL(/\/notificacoes$/);
  });
}

test('falha de escrita mantém aviso não lido e permite tentar novamente',async({page})=>{
  await preparar(page);
  await page.route('**/api/notificacoes/101/ler',r=>r.fulfill({status:500,json:{error:{code:'ERRO_INTERNO',message:'Não foi possível salvar a leitura.'}}}));
  await page.goto('/notificacoes');
  await page.getByRole('button',{name:'Marcar como lida: Nova solicitação aguardando análise'}).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar');
  await expect(page.locator('.notificacoes__item--nova')).toHaveCount(2);
});

test('JSON inválido apresenta erro acionável sem exibir conteúdo privado',async({page})=>{
  await preparar(page);
  await page.route('**/api/notificacoes?*',r=>r.fulfill({json:{data:[{titulo:'sentinela privada'}]}}));
  await page.goto('/notificacoes');
  await expect(page.getByRole('button',{name:'Tentar novamente'})).toBeVisible();
  await expect(page.getByText('sentinela privada')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Marcar todas como lidas'})).toBeDisabled();
});

test('leitura aguarda confirmação do servidor antes de atualizar o contador',async({page})=>{
  await preparar(page);
  let liberar!:()=>void;
  const confirmacao = new Promise<void>(resolve=>{liberar=resolve;});
  await page.route('**/api/notificacoes/101/ler',async r=>{await confirmacao;await r.fallback();});
  await page.goto('/notificacoes');
  const acao = page.getByRole('button',{name:'Marcar como lida: Nova solicitação aguardando análise'});
  await acao.click();
  await expect(acao).toBeDisabled();
  await expect(page.getByRole('button',{name:'Abrir notificações: 2 não lidas',exact:true})).toBeVisible();
  await expect(page.locator('.notificacoes__item--nova')).toHaveCount(2);
  liberar();
  await expect(page.getByRole('button',{name:'Abrir notificações: 1 não lidas',exact:true})).toBeVisible();
});
