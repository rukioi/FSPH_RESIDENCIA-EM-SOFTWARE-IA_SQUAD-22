import { expect, test } from '@playwright/test';
import { verifiedSql } from '../../backend/src/database/scripts/verify-test-db.js';

let token: string;
let sql: Awaited<ReturnType<typeof verifiedSql>>;
test.beforeAll(async ({request})=>{
  await expect.poll(async ()=>(await request.get('/api/auth/sessao')).status(),{timeout:20_000}).toBe(401);
  const login=await request.post('/api/auth/login',{data:{email:'t1-adm@example.invalid',senha:'T1-fixture-2026!'}});
  expect(login.status()).toBe(200); token=(await login.json()).token;
  sql=await verifiedSql();
});
test.afterAll(async()=>{
  if (sql) { try { await sql`DELETE FROM public.veiculo WHERE placa LIKE 'T32E%'`; } finally { await sql.end(); } }
});
for (const width of [390,768,1280]) {
  test(`veículos preserva cadastro, filtros, detalhes e layout em ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/login');
    await page.evaluate(value=>sessionStorage.setItem('token',value),token);
    await page.goto('/gestor/veiculos');
    await expect(page.getByRole('heading',{name:'Veículos',exact:true})).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.getByRole('button',{name:'Cadastrar veículo',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Placa',{exact:true}).fill(`T32E${width}`);
    await dialog.getByLabel('Marca',{exact:true}).fill('Fixture');
    await dialog.getByLabel('Modelo',{exact:true}).fill(`Contrato ${width}`);
    await dialog.getByLabel('Ano',{exact:true}).fill('2026');
    await page.screenshot({path:info.outputPath(`cadastro-${width}.png`),fullPage:true});
    await dialog.getByRole('button',{name:'Salvar veículo',exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`cadastro-acoes-${width}.png`),fullPage:true});
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/veiculos',async route=>{
      if (route.request().method()==='POST') await gate;
      await route.continue();
    });
    try {
      await dialog.getByRole('button',{name:'Salvar veículo',exact:true}).click();
      await expect(dialog.getByRole('button',{name:'Salvando...'})).toBeDisabled();
      await expect(page.locator('.veiculo-card').filter({hasText:`T32E${width}`})).toHaveCount(0);
    } finally { release(); }
    await expect(dialog).toHaveCount(0);
    await page.unroute('**/api/veiculos');
    await page.getByRole('searchbox').fill(`T32E${width}`);
    const card=page.locator('.veiculo-card').filter({hasText:`T32E${width}`});
    await expect(card).toBeVisible();
    await page.getByLabel('Filtrar por status').selectOption('EM_VIAGEM');
    await expect(card).toHaveCount(0);
    await page.getByLabel('Filtrar por status').selectOption('DISPONIVEL');
    await expect(card).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`veiculos-${width}.png`),fullPage:true});
    await card.getByRole('button',{name:'Ver detalhes'}).click();
    await expect(page.getByRole('heading',{name:`T32E${width} · Administrativo`})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`detalhes-${width}.png`),fullPage:true});
  });
}
test('resposta inválida mostra erro acionável; 401 encerra a sessão',async({page})=>{
  await page.goto('/login');
  await page.evaluate(value=>sessionStorage.setItem('token',value),token);
  await page.route('**/api/veiculos',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:1}]})}));
  await page.goto('/gestor/veiculos');
  await expect(page.getByRole('alert')).toContainText('Tente novamente');
  await expect(page.locator('.veiculo-card')).toHaveCount(0);
  await page.unroute('**/api/veiculos');
  await page.route('**/api/veiculos',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:{code:'NAO_AUTENTICADO',message:'Autenticação necessária.'}})}));
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(()=>sessionStorage.getItem('token'))).toBeNull();
});
