import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { selecionarOpcao } from '../e2e/fixtures/controls';

async function preparar(page: Page, perfil = 'GESTOR_FROTA', caminho = '/gestor/relatorios', invalido = false) {
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({body:'',contentType:'text/css'}));
  await page.addInitScript(({perfil,caminho})=>{
    sessionStorage.setItem('token','fixture-relatorios-ui'); history.replaceState({},'',caminho);
    Object.defineProperty(window,'perfilFixture',{value:perfil});
  },{perfil,caminho});
  let falhar = invalido;
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if(url.pathname==='/api/auth/sessao')return route.fulfill({json:{data:{id:'1',nome:'Gestor de teste',email:'relatorios@example.invalid',perfil}}});
    if(url.pathname.endsWith('/relatorios/recursos'))return route.fulfill({json:{data:{veiculos:[{id:'1',placa:'REL1A23',modelo:'Fixture'}],motoristas:[{id:'2',nome:'Motorista de teste'}]}}});
    if(url.pathname.endsWith('/relatorios')) {
      if(falhar)return route.fulfill({json:{data:{incompleto:true}}});
      const qtd=url.searchParams.has('veiculoId')?1:60;
      const tipo=url.searchParams.get('tipo') ?? 'svo';
      return route.fulfill({json:{data:{
        tipo,titulo:tipo==='svo'?'Ordens de coleta SVO':'Viagens',inicio:url.searchParams.get('inicio'),fim:url.searchParams.get('fim'),
        geradoEm:'2026-11-12T12:00:00Z',criterioPeriodo:'Início real da viagem.',observacoes:['Quilometragem de execuções concluídas.'],
        filtros:{veiculoId:url.searchParams.get('veiculoId'),motoristaId:url.searchParams.get('motoristaId'),status:url.searchParams.get('status')},
        colunas:[{chave:'codigo',titulo:'Ticket',tipo:'texto'},{chave:'data',titulo:'Início',tipo:'dataHora'},{chave:'motorista',titulo:'Motorista',tipo:'texto'},{chave:'placa',titulo:'Veículo',tipo:'texto'},{chave:'kmPercorridos',titulo:'Km concluídos',tipo:'numero'}],
        linhas:Array.from({length:qtd},(_,i)=>({codigo:`TRP-${i+1}`,data:'2026-11-12T08:30:00',motorista:'Motorista de teste',placa:'REL1A23',kmPercorridos:10})),
        resumo:{registros:qtd,kmConcluidos:qtd*10,semQuilometragem:0},
      }}});
    }
    if(url.pathname.endsWith('/sincronizar'))return route.fulfill({json:{data:{atualizadas:0}}});
    return route.fulfill({json:{data:[],meta:{page:1,limit:20,total:0,naoLidas:0}}});
  });
  await page.goto('/tests/ui-controls/application.html');
  return ()=>{falhar=false;};
}

for(const width of [390,768,1280])test(`consulta, teclado, paginação e exportações completas em ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await preparar(page);
  await expect(page.getByRole('heading',{name:'Relatórios operacionais'})).toBeVisible();
  await expect(page.getByText('60 registros encontrados')).toBeVisible();
  await expect(page.getByRole('cell',{name:'TRP-1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Próxima',exact:true}).click();
  await expect(page.getByRole('cell',{name:'TRP-26',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath(`relatorios-${width}.png`),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const formato of ['CSV','XLSX','PDF']){
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:`Exportar ${formato}`,exact:true}).click();
    const arquivo=await download;
    expect(arquivo.suggestedFilename()).toMatch(new RegExp(`\\.${formato.toLowerCase()}$`));
    const path=info.outputPath(`relatorio-${width}.${formato.toLowerCase()}`);await arquivo.saveAs(path);
    const bytes=await readFile(path);
    if(formato==='CSV')expect(bytes.toString('utf8')).toContain('TRP-60');
    if(formato==='XLSX')expect(bytes.subarray(0,2).toString()).toBe('PK');
    if(formato==='PDF')expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  }
  await selecionarOpcao(page.getByRole('combobox',{name:'Veículo',exact:true}),'1');
  await expect(page.getByRole('button',{name:'Exportar CSV',exact:true})).toBeDisabled();
  const gerar=page.getByRole('button',{name:'Gerar relatório',exact:true});
  await gerar.focus();await page.keyboard.press('Enter');
  await expect(page.getByText('1 registros encontrados')).toBeVisible();
  await expect(page.getByRole('cell',{name:'TRP-26',exact:true})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('JSON inválido oferece nova tentativa e recupera o relatório',async({page})=>{
  const recuperar=await preparar(page,'GESTOR_FROTA','/gestor/relatorios',true);
  await expect(page.getByRole('alert')).toContainText('resposta do servidor é inválida');
  recuperar();
  await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
  await expect(page.getByText('60 registros encontrados')).toBeVisible();
});
test('relatório SVO usa endpoint próprio e não oferece relatórios de frota',async({page})=>{
  await preparar(page,'ATENDENTE_SVO','/svo/relatorios');
  await expect(page.getByRole('heading',{name:'Relatórios SVO',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Ordens de coleta SVO'})).toBeVisible();
  await expect(page.getByRole('combobox',{name:'Relatório',exact:true})).toHaveCount(0);
});
test('motorista não monta página de relatório SVO',async({page})=>{
  await preparar(page,'MOTORISTA','/svo/relatorios');
  await expect(page.getByRole('heading',{name:'Acesso negado'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Exportar CSV',exact:true})).toHaveCount(0);
});
