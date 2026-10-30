import { expect, test } from '@playwright/test';
import { verifiedSql } from '../../backend/src/database/scripts/verify-test-db.js';

let token: string;
let userToken: string;
let sessionId: string;
let sql: Awaited<ReturnType<typeof verifiedSql>>;
test.beforeAll(async ({ request }) => {
  await expect.poll(async () => (await request.get('/api/auth/sessao')).status(),
    { timeout: 20_000, message: 'Aguardar o backend isolado responder antes do login' }).toBe(401);
  const response = await request.post('/api/auth/login', { data: {email:'t1-adm@example.invalid',senha:'T1-fixture-2026!'} });
  expect(response.status()).toBe(200);
  token=(await response.json()).token;
  sql=await verifiedSql();
  const created=await request.post('/api/admin/usuarios',{headers:{Authorization:`Bearer ${token}`},
    data:{nome:'Fixture E2E Sessão',email:'t29-e2e-session@example.invalid',senha:'T29-fixture-2026!',perfil:'ADM'}});
  expect(created.status()).toBe(201);
  sessionId=String((await created.json()).id);
  const login=await request.post('/api/auth/login',{data:{email:'t29-e2e-session@example.invalid',senha:'T29-fixture-2026!'}});
  expect(login.status()).toBe(200);
  userToken=(await login.json()).token;
});
test.afterAll(async () => {
  if (!sql) return;
  try {
    await sql`delete from public.log_atividade where usuario_id in (select id from public.usuario where email like 't29-e2e-%@example.invalid')`;
    await sql`delete from public.usuario where email like 't29-e2e-%@example.invalid'`;
  } finally { await sql.end(); }
});
for (const width of [390,768,1280]) {
  test(`cadastro, edição e status confirmados em ${width}px`,async ({page,request},info) => {
    await page.setViewportSize({width,height:900});
    await page.goto('/login');
    await page.evaluate(value=>sessionStorage.setItem('token',value),token);
    await page.goto('/admin/configuracoes');
    await expect(page.getByRole('heading',{name:'Gestão de usuários'})).toBeVisible();
    const nome=`Fixture E2E ${width}`;
    const email=`t29-e2e-${width}@example.invalid`;
    await page.getByRole('button',{name:'Novo usuário',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByLabel('Nome completo').fill(nome);
    await dialog.getByLabel('E-mail',{exact:true}).fill(email);
    await dialog.getByLabel('Senha',{exact:true}).fill('T29-fixture-2026!');
    await dialog.getByLabel('Perfil',{exact:true}).selectOption('Solicitante');
    await page.screenshot({path:info.outputPath(`novo-usuario-${width}.png`),fullPage:true});
    const created=page.waitForResponse(r=>r.url().endsWith('/api/admin/usuarios')&&r.request().method()==='POST');
    await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
    const result=await created;
    expect(result.status()).toBe(201);
    const usuario=await result.json();
    expect(usuario.perfil).toBe('SOLICITANTE_INTERNO');
    await expect(dialog).toHaveCount(0);
    await page.getByRole('searchbox').fill(email);
    const row=page.getByRole('row').filter({hasText:email});
    await row.getByRole('button',{name:`Editar ${nome}`,exact:true}).click();
    await dialog.getByLabel('Perfil',{exact:true}).selectOption('Gestor da Frota');
    const edited=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(`/usuarios/${usuario.id}`));
    await dialog.getByRole('button',{name:'Salvar alterações'}).click();
    expect((await edited).status()).toBe(200);
    await expect(row).toContainText('Gestor da Frota');
    await page.locator('.usuarios__rolagem').evaluate(element=>{element.scrollLeft=0;});
    await page.screenshot({path:info.outputPath(`usuarios-${width}.png`),fullPage:true});
    await row.getByRole('switch').click();
    await page.getByRole('alertdialog').getByRole('button',{name:'Desativar',exact:true}).click();
    await expect(row.getByRole('switch')).toHaveAttribute('aria-checked','false');
    const repeated=await request.patch(`/api/admin/usuarios/${usuario.id}/status`,{headers:{Authorization:`Bearer ${token}`},data:{ativo:false}});
    expect(repeated.status()).toBe(200);
    expect((await repeated.json()).ativo).toBe(false);
    await page.route(`**/api/admin/usuarios/${usuario.id}/status`,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Falha de teste. Tente novamente.'}})}));
    await row.getByRole('switch').click();
    await expect(page.getByRole('alert')).toContainText('Tente novamente');
    await expect(row.getByRole('switch')).toHaveAttribute('aria-checked','false');
    await page.unroute(`**/api/admin/usuarios/${usuario.id}/status`);
    let liberar!: () => void;
    const confirmacao=new Promise<void>(resolve=>{liberar=resolve;});
    await page.route(`**/api/admin/usuarios/${usuario.id}/status`,async route=>{await confirmacao;await route.continue();});
    try {
      await row.getByRole('switch').click();
      await expect(page.getByText('Salvando situação da conta...')).toBeVisible();
      await expect(row.getByRole('switch')).toBeDisabled();
      await expect(row.getByRole('switch')).toHaveAttribute('aria-checked','false');
    } finally {liberar();}
    await expect(row.getByRole('switch')).toHaveAttribute('aria-checked','true');
    await page.unroute(`**/api/admin/usuarios/${usuario.id}/status`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const consulta=await request.get('/api/admin/auditoria/logs?page=1&limit=100',
      {headers:{Authorization:`Bearer ${token}`}});
    expect(consulta.status()).toBe(200);
    const atividades=await consulta.json();
    expect(atividades.meta).toMatchObject({page:1,limit:100});
    const descricoes=[`Criou o usuário ID ${usuario.id}`,`Atualizou os dados do usuário ID ${usuario.id}`,
      `Alterou o status do usuário ID ${usuario.id} para Inativo`,`Alterou o status do usuário ID ${usuario.id} para Ativo`];
    const eventos=atividades.data.filter((item:{descricao:string})=>descricoes.includes(item.descricao));
    expect(eventos.map((item:{descricao:string})=>item.descricao)).toEqual([...descricoes].reverse());
    expect(eventos.every((item:Record<string,unknown>)=>!('usuario_email' in item)&&!('email' in item))).toBe(true);
  });
}
test('perfil atual redireciona na próxima consulta sem emitir outro JWT',async ({page})=>{
  await sql`update public.usuario set perfil='ADM', ativo=true where id=${sessionId}`;
  await page.goto('/login');
  await page.evaluate(value=>sessionStorage.setItem('token',value),userToken);
  await page.goto('/admin/configuracoes');
  await expect(page.getByRole('heading',{name:'Gestão de usuários'})).toBeVisible();
  await sql`update public.usuario set perfil='GESTOR_FROTA' where id=${sessionId}`;
  await page.reload();
  await expect(page).toHaveURL(/\/gestor\/dashboard$/);
});
test('desativação encerra o acesso na próxima consulta',async ({page})=>{
  await sql`update public.usuario set perfil='ADM', ativo=true where id=${sessionId}`;
  await page.goto('/login');
  await page.evaluate(value=>sessionStorage.setItem('token',value),userToken);
  await page.goto('/admin/configuracoes');
  await expect(page.getByRole('heading',{name:'Gestão de usuários'})).toBeVisible();
  await sql`update public.usuario set ativo=false where id=${sessionId}`;
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(()=>sessionStorage.getItem('token'))).toBeNull();
});
