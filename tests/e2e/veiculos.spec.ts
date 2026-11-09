import { selecionarOpcao } from './fixtures/controls';
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
    await selecionarOpcao(page.getByLabel('Filtrar por status'), 'EM_VIAGEM');
    await expect(card).toHaveCount(0);
    await selecionarOpcao(page.getByLabel('Filtrar por status'), 'DISPONIVEL');
    await expect(card).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`veiculos-${width}.png`),fullPage:true});
    const response = await page.request.get('/api/veiculos', {headers: {Authorization: `Bearer ${token}`}});
    const vehicle = (await response.json()).data.find((item: {placa: string}) => item.placa === `T32E${width}`);
    let attempts = 0;
    await page.route('**/api/abastecimentos', route => {
      attempts++;
      return route.fulfill(attempts === 1
        ? {status: 500, contentType: 'application/json', body: JSON.stringify({error: {code: 'ERRO_INTERNO', message: 'Falha na consulta.'}})}
        : {status: 200, contentType: 'application/json', body: JSON.stringify({data: [
          {id: '1', veiculo_id: vehicle.id, motorista_id: '1', litragem: '10.50', valor_total: '63.00', quilometragem: 1000, data_abastecimento: '2026-01-15T00:00:00.000Z', criado_em: null, posto: 'Posto teste', veiculo_placa: vehicle.placa, motorista_nome: null},
          {id: '2', veiculo_id: '999999', motorista_id: '1', litragem: '20.00', valor_total: '100.00', quilometragem: 2000, data_abastecimento: '2026-01-15T00:00:00.000Z', criado_em: null, posto: 'Outro posto', veiculo_placa: null, motorista_nome: null},
        ]})});
    });
    await page.route('**/api/documentos', route => route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({data: [
      {id: '1', tipo: 'DOCUMENTO_VEICULO', descricao: 'Licenciamento teste', relacionado_id: vehicle.id, data_validade: '2030-01-15T00:00:00.000Z', status: 'REGULAR'},
      {id: '2', tipo: 'DOCUMENTO_VEICULO', descricao: 'Documento de outro veiculo', relacionado_id: '999999', data_validade: '2030-01-15T00:00:00.000Z', status: 'REGULAR'},
      {id: '3', tipo: 'CNH_MOTORISTA', descricao: 'CNH teste', relacionado_id: vehicle.id, data_validade: null, status: 'SEM_VALIDADE'},
    ]})}));
    await card.getByRole('button',{name:'Ver detalhes'}).click();
    await expect(page.getByText('Licenciamento teste')).toBeVisible();
    await expect(page.getByText('Documento de outro veiculo')).toHaveCount(0);
    await expect(page.getByText('CNH teste')).toHaveCount(0);
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', {name: 'Tentar novamente'}).click();
    await expect(page.getByText('Posto teste')).toBeVisible();
    await expect(page.getByText('Outro posto')).toHaveCount(0);
    await expect(page.getByText('A consulta de manutenção por veículo ainda não está disponível.')).toBeVisible();
    await expect(page.getByRole('heading',{name:`Fixture Contrato ${width}`})).toBeVisible();
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
