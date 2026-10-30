import { expect, test } from '@playwright/test';
import { verifiedSql } from '../../backend/src/database/scripts/verify-test-db.js';

let admToken:string;
let svoToken:string;
let svoId:string;
let sql:Awaited<ReturnType<typeof verifiedSql>>;
test.beforeAll(async({request})=>{
  await expect.poll(async()=>(await request.get('/api/auth/sessao')).status(),{timeout:20_000}).toBe(401);
  const login=await request.post('/api/auth/login',{data:{email:'t1-adm@example.invalid',senha:'T1-fixture-2026!'}});
  expect(login.status()).toBe(200);admToken=(await login.json()).token;
  const created=await request.post('/api/admin/usuarios',{headers:{Authorization:`Bearer ${admToken}`},
    data:{nome:'Fixture T30 SVO',email:'t30-svo-e2e@example.invalid',senha:'T30-fixture-2026!',perfil:'ATENDENTE_SVO'}});
  expect(created.status()).toBe(201);svoId=String((await created.json()).id);
  const session=await request.post('/api/auth/login',{data:{email:'t30-svo-e2e@example.invalid',senha:'T30-fixture-2026!'}});
  expect(session.status()).toBe(200);svoToken=(await session.json()).token;
  sql=await verifiedSql();
  await sql`insert into veiculo (id,placa,marca,modelo,ano,tipo,status,is_svo) values (30003,'T30SV01','Fixture','Fixture SVO',2026,'VAN','DISPONIVEL',true)`;
  await sql`insert into motorista (id,nome,cnh,categoria_cnh,validade_cnh,status) values (30003,'Fixture T30 SVO','30000000003','B','2099-01-01','DISPONIVEL')`;
});
test.afterAll(async()=>{
  if(!sql)return;
  try {
    await sql`delete from ordem_coleta where solicitacao_obito_id in (select id from solicitacao_obito where atendente_id=${svoId})`;
    await sql`delete from solicitacao_obito where atendente_id=${svoId}`;
    await sql`delete from log_atividade where usuario_id=${svoId}`;
    await sql`delete from usuario where id=${svoId}`;
    await sql`delete from motorista where id=30003`;
    await sql`delete from veiculo where id=30003`;
  } finally {await sql.end();}
});

for (const width of [390, 768, 1280]) {
  test(`a aplicação inicia sem rolagem horizontal em ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Acesse sua conta' }),
    ).toBeVisible();

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const screenshot = await page.screenshot({
      path: testInfo.outputPath(`preview-${width}.png`),
      fullPage: true,
    });

    await testInfo.attach(`preview-${width}`, {
      body: screenshot,
      contentType: 'image/png',
    });
  });
}

test('rotas privadas sem sessão redirecionam para o login', async ({ page }) => {
  for (const rota of [
    '/admin/dashboard',
    '/admin/configuracoes',
    '/gestor/dashboard',
    '/gestor/veiculos',
    '/svo',
  ]) {
    await page.goto(rota);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole('heading', { name: 'Acesse sua conta' }),
    ).toBeVisible();
  }
});

test('o proxy de desenvolvimento alcança o backend', async ({ request }) => {
  const response = await request.get('/api/usuarios');

  expect(response.status()).toBe(404);

  await expect(response.json()).resolves.toEqual({
    error: {
      code: 'NAO_ENCONTRADO',
      message: 'Rota não encontrada.',
    },
  });
});

for(const width of [390,768,1280]) {
  test(`demonstrações e indisponibilidade explícitas em ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/login'); await page.evaluate(t=>sessionStorage.setItem('token',t),admToken);
    let kpis=0;page.on('request',req=>{if(req.url().includes('/api/dashboard/kpis'))kpis++;});
    await page.goto('/gestor/dashboard');
    await expect(page.getByRole('status')).toContainText('Indicadores por período indisponíveis');
    for(const period of ['7 dias','30 dias','Personalizado','Hoje']) await page.getByRole('button',{name:period,exact:true}).click();
    await expect(page.locator('.card-kpi strong')).toHaveText(['—','—','—','—']);
    expect(kpis).toBe(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`dashboard-${width}.png`),fullPage:true});
    await page.goto('/admin/auditoria');
    await expect(page.locator('.pagina__descricao')).toContainText('Demonstração');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`auditoria-${width}.png`),fullPage:true});
    await page.evaluate(t=>sessionStorage.setItem('token',t),svoToken);
    await page.goto('/svo');
    await expect(page.getByRole('heading',{name:'Dashboard SVO'})).toBeVisible();
    await expect(page.getByText('Carregando ordens...')).toHaveCount(0);
    await expect(page.getByText(/Resumo desta sessão/)).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`svo-${width}.png`),fullPage:true});
  });
}

test('SVO confirma despacho existente e mantém conflito sem confirmação local',async({page,request})=>{
  const created=await request.post('/api/svo/solicitacoes',{headers:{Authorization:`Bearer ${svoToken}`},
    data:{localFalecimento:'Fixture',enderecoRemocao:'Endereço fictício T30',solicitanteNome:'Fixture T30'}});
  expect(created.status()).toBe(201);const order=(await created.json()).ordemColeta;
  await page.goto('/login');await page.evaluate(t=>sessionStorage.setItem('token',t),svoToken);
  await page.goto('/svo');
  const row=page.locator('.svo-despacho').getByRole('row').filter({hasText:`OC-${order.id}`});
  await row.getByRole('button',{name:'Preparar despacho'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Veículo',{exact:true}).selectOption('30003');
  await dialog.getByLabel('Motorista',{exact:true}).selectOption('30003');
  await page.route('**/despachar',route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({erro:'Recurso indisponível. Tente novamente.'})}));
  await dialog.getByRole('button',{name:'Confirmar despacho',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Recurso indisponível');
  await expect(row).toBeVisible();
  await page.unroute('**/despachar');
  await dialog.getByRole('button',{name:'Confirmar despacho',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  const [persisted]=await sql`select status,motorista_id,veiculo_id from ordem_coleta where id=${order.id}`;
  expect(persisted).toMatchObject({status:'EM_DESLOCAMENTO',motorista_id:'30003',veiculo_id:'30003'});
});
