import { expect, test } from '@playwright/test';
import { verifiedSql } from '../../backend/src/database/scripts/verify-test-db.js';

let token:string;
let sql:Awaited<ReturnType<typeof verifiedSql>>;
test.beforeAll(async({request})=>{
  await expect.poll(async()=>(await request.get('/api/auth/sessao')).status(),{timeout:20_000}).toBe(401);
  const login=await request.post('/api/auth/login',{data:{email:'t1-adm@example.invalid',senha:'T1-fixture-2026!'}});
  expect(login.status()).toBe(200); token=(await login.json()).token;
  sql=await verifiedSql();
});
test.afterAll(async()=>{
  if(sql) { try {await sql`delete from motorista where nome like 'Fixture T30 E2E%'`;} finally {await sql.end();} }
});
for(const width of [390,768,1280]) {
  test(`motoristas confirma cadastro, filtros e detalhes em ${width}px`,async({page},info)=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/login'); await page.evaluate(t=>sessionStorage.setItem('token',t),token);
    await page.goto('/gestor/motoristas');
    await expect(page.getByRole('heading',{name:'Motoristas',exact:true})).toBeVisible();
    await expect(page.getByText('Carregando motoristas...')).toHaveCount(0);
    await page.getByRole('button',{name:'Cadastrar motorista',exact:true}).click();
    const dialog=page.getByRole('dialog');
    const name=`Fixture T30 E2E ${width}`;
    await dialog.getByLabel('Nome completo').fill(name);
    await dialog.getByLabel('Número da CNH').fill(`3000000${String(width).padStart(4,'0')}`);
    await dialog.getByLabel('Categoria da CNH').selectOption('B');
    await dialog.getByLabel('Validade da CNH').fill('2099-01-01');
    await page.screenshot({path:info.outputPath(`motorista-cadastro-${width}.png`),fullPage:true});
    let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/motoristas',async route=>{
      if(route.request().method()==='POST') await gate;
      await route.continue();
    });
    try {
      await dialog.getByRole('button',{name:'Cadastrar motorista',exact:true}).click();
      await expect(dialog.getByRole('button',{name:'Salvando...'})).toBeDisabled();
      await expect(page.locator('.motorista-card').filter({hasText:name})).toHaveCount(0);
    } finally {release();}
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Motorista cadastrado com sucesso');
    await page.unroute('**/api/motoristas');
    await page.getByRole('searchbox').fill(name);
    const card=page.locator('.motorista-card').filter({hasText:name});
    await expect(card).toBeVisible();
    await expect(card).toContainText('Histórico de chamados indisponível');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`motoristas-${width}.png`),fullPage:true});
    await card.getByRole('button',{name:'Ver detalhes'}).click();
    await expect(page.getByRole('heading',{name})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`motorista-detalhes-${width}.png`),fullPage:true});
  });
}
test('motoristas mostra resposta inválida, 403, vazio e nova tentativa',async({page})=>{
  await page.goto('/login');await page.evaluate(t=>sessionStorage.setItem('token',t),token);
  let body:unknown={data:[{id:'1'}]};let status=200;
  await page.route('**/api/motoristas',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}));
  await page.goto('/gestor/motoristas');
  await expect(page.getByRole('alert')).toContainText('Tente novamente');
  body={error:{code:'ACESSO_NEGADO',message:'Acesso não permitido.'}};status=403;
  await page.getByRole('button',{name:'Tentar novamente'}).click();
  await expect(page.getByRole('alert')).toContainText('Acesso não permitido');
  body={data:[]};status=200;
  await page.getByRole('button',{name:'Tentar novamente'}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Nenhum motorista encontrado para os filtros selecionados.')).toBeVisible();
});

test('consulta anterior não apaga um cadastro já confirmado',async({page})=>{
  await page.goto('/login');await page.evaluate(t=>sessionStorage.setItem('token',t),token);
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  let started!:()=>void;const pending=new Promise<void>(resolve=>{started=resolve;});
  let cancelled!:()=>void;const aborted=new Promise<void>(resolve=>{cancelled=resolve;});
  page.on('requestfailed',request=>{if(request.url().endsWith('/api/motoristas'))cancelled();});
  await page.route('**/api/motoristas',async route=>{
    if(route.request().method()!=='GET')return route.continue();
    started();await gate;
    await route.fulfill({status:200,contentType:'application/json',body:'{"data":[]}'});
  });
  await page.goto('/gestor/motoristas');await pending;
  await page.getByRole('button',{name:'Cadastrar motorista',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nome completo').fill('Fixture T30 E2E confirmação');
  await dialog.getByLabel('Número da CNH').fill('30000009999');
  await dialog.getByLabel('Categoria da CNH').selectOption('B');
  await dialog.getByLabel('Validade da CNH').fill('2099-01-01');
  try {
    await dialog.getByRole('button',{name:'Cadastrar motorista',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    await aborted;
  } finally {release();}
  await page.getByRole('searchbox').fill('Fixture T30 E2E confirmação');
  await expect(page.locator('.motorista-card')).toHaveCount(1);
  await expect(page.getByText('Carregando motoristas...')).toHaveCount(0);
});
