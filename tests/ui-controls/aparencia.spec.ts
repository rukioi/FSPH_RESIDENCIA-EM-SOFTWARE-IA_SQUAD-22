import { expect, test, type Page } from '@playwright/test';

async function preparar(page: Page, perfil = 'GESTOR_FROTA', caminho = '/gestor/dashboard') {
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
  await page.addInitScript(({ caminho }) => {
    sessionStorage.setItem('token', 'fixture-aparencia');
    history.replaceState({}, '', caminho);
  }, { caminho });
  const periodo = { periodo: 'hoje', inicio: '2026-11-12T00:00:00-03:00', fim: '2026-11-13T00:00:00-03:00', criterio: 'dataHoraSaida', fuso: 'America/Maceio' };
  await page.route('**/api/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (!pathname.startsWith('/api/')) return route.continue();
    if (pathname === '/api/auth/sessao') return route.fulfill({ json: { data: { id: '1', nome: 'Pessoa de teste', email: 'teste@example.invalid', perfil } } });
    if (pathname === '/api/dashboard/gestor') return route.fulfill({ json: { data: {
      periodo, veiculosPorStatus: [{status:'DISPONIVEL',total:3}], motoristasDisponiveis: null, motoristasDisponiveisMotivo: 'Sem escala cadastrada',
      solicitacoesPorStatus: [{status:'PENDENTE',total:2}], proximasViagens: [],
      indicadores: { periodo, pendentes:2, aprovadas:0, reprovadas:0, veiculosDisponiveis:3, filaAguardandoAnalise:[], atividadeRecente:[], decisoesRecentes:[], indicadoresIndisponiveis:[] },
    } } });
    if (pathname === '/api/dashboard/pendencias') return route.fulfill({ json: { data: {
      motoristas: [{id:'1',nome:'CNH de teste',vencimento:'2026-11-01',situacao:'VENCIDO'}],
      documentos: [{id:'2',tipo_documento:'Licenciamento',placa:'TST1A23',modelo:'Teste',vencimento:'2026-11-30',situacao:'A_VENCER'}],
    } } });
    if (pathname.endsWith('/sincronizar')) return route.fulfill({ json: { data: { atualizadas:0 } } });
    return route.fulfill({ json: {data:[],meta:{page:1,limit:20,total:0,naoLidas:0}} });
  });
  await page.goto('/tests/ui-controls/application.html');
}

for (const width of [390,768,1280]) test(`hierarquia, alertas e navegação em ${width}px`, async ({page},info) => {
  await page.setViewportSize({width,height:900});
  await preparar(page);
  await expect(page.getByRole('heading',{name:'Pendências documentais'})).toBeVisible();
  await expect(page.locator('.pendencia--critica')).toContainText('Vencida');
  await expect(page.locator('.pendencia--atencao')).toContainText('Licenciamento');
  expect(await page.locator('.pendencia--critica').evaluate(el=>getComputedStyle(el).backgroundColor)).not.toBe(await page.locator('.pendencia--atencao').evaluate(el=>getComputedStyle(el).backgroundColor));
  await page.screenshot({path:info.outputPath(`dashboard-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width>900) {
    await page.getByRole('button',{name:'Retrair menu'}).click();
    const menu=page.locator('#menu-gestor');
    await expect(menu.getByRole('button',{name:'Veículos',exact:true})).toBeVisible();
    expect((await menu.boundingBox())!.width).toBeLessThan(100);
    await menu.getByRole('button',{name:'Veículos',exact:true}).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/gestor\/veiculos$/);
    await expect(page.getByRole('heading',{name:'Veículos',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Expandir menu'})).toBeVisible();
    expect((await page.locator('#menu-gestor').boundingBox())!.width).toBeLessThan(100);
    await page.screenshot({path:info.outputPath('sidebar-retraido.png'),fullPage:true});
  } else {
    await page.getByRole('button',{name:'Expandir menu'}).click();
    await expect(page.locator('#menu-gestor').getByRole('button',{name:'Dashboard',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Expandir menu'})).toBeFocused();
    await expect(page.locator('#menu-gestor')).toHaveAttribute('inert','');
    await page.getByRole('button',{name:'Expandir menu'}).click();
    await page.locator('#menu-gestor').getByRole('button',{name:'Veículos',exact:true}).click();
    await expect(page.locator('#menu-gestor')).toHaveAttribute('inert','');
  }
});

test('sidebar mantém preferência entre layouts de administrador e gestor', async ({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await preparar(page,'ADM','/admin/dashboard');
  await page.getByRole('button',{name:'Recolher menu'}).click();
  await page.locator('.menu').getByRole('link',{name:'Veículos',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Veículos',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Expandir menu'})).toBeVisible();
  expect((await page.locator('.menu').boundingBox())!.width).toBeLessThan(100);
});


test('página de veículos é solicitada somente ao navegar', async ({page})=>{
  const modules: string[] = [];
  page.on('request',request=>modules.push(new URL(request.url()).pathname));
  await page.setViewportSize({width:1280,height:900});
  await preparar(page);
  await expect(page.getByRole('heading',{name:'Pendências documentais'})).toBeVisible();
  expect(modules.some(path=>path.endsWith('/pages/veiculos/Veiculos.tsx'))).toBe(false);
  expect(modules.some(path=>path.endsWith('/pages/administrador/Auditoria.tsx'))).toBe(false);
  await page.locator('#menu-gestor').getByRole('button',{name:'Veículos',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Veículos',exact:true})).toBeVisible();
  expect(modules.some(path=>path.endsWith('/pages/veiculos/Veiculos.tsx'))).toBe(true);
});
