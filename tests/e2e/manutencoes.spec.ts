import { expect, test as base, type Page } from '@playwright/test';
import { verifiedSql, testProfile } from '../../backend/src/database/scripts/verify-test-db.js';
import { selecionarOpcao } from './fixtures/controls';

const emails = {ADM:'t1-adm@example.invalid', GESTOR:'t1-gestor_frota@example.invalid', SOLICITANTE:'t1-solicitante_interno@example.invalid'};
const test = base.extend<{cenario:{veiculo:string; placa:string; hoje:string; amanha:string; reserva:string; db:Awaited<ReturnType<typeof verifiedSql>>}}>({
  cenario: async ({browserName}, use, info) => {
    expect(browserName).toBe('chromium');
    expect(['s10-integracao-clean', 's10-integracao-fk-final', 's10-consolidada-clean', 's10-candidata-e2e']).toContain(testProfile);
    const db = await verifiedSql(true);
    const veiculo = String(-23500000 - info.workerIndex * 1000);
    const placa = 'S35' + String(info.workerIndex).padStart(4,'0');
    const reserva = String(Number(veiculo) - 1);
    const [dias] = await db`SELECT d::text AS hoje, (d+1)::text AS amanha
      FROM (SELECT (statement_timestamp() AT TIME ZONE 'America/Maceio')::date d) x`;
    let criada = false;
    try {
      await db`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status)
        VALUES (${veiculo},${placa},'Fixture','Teste SCRUM-235',2026,'PASSEIO','EM_MANUTENCAO')`;
      criada = true;
      await use({veiculo,placa,hoje:dias.hoje,amanha:dias.amanha,reserva,db});
    } finally {
      try {
        if (criada) await db.begin(async tx => {
          await tx`DELETE FROM public.log_atividade WHERE descricao LIKE 'Manutenção ID %'
            AND substring(descricao from '^Manutenção ID (-?[0-9]+)') IN
              (SELECT id::text FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo})`;
          await tx`DELETE FROM public.manutencao_alerta_revisao WHERE manutencao_id IN
            (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo})`;
          await tx`DELETE FROM public.manutencao_veiculo_historico WHERE manutencao_id IN
            (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo})`;
          await tx`DELETE FROM public.manutencao_veiculo WHERE veiculo_id=${veiculo}`;
          await tx`DELETE FROM public.solicitacao_viagem WHERE id=${reserva} AND veiculo_id=${veiculo}`;
          await tx`DELETE FROM public.veiculo WHERE id=${veiculo}`;
        });
      } finally { await db.end(); }
    }
  },
});
test.use({screenshot:'off',video:'off',trace:'off'});
test.setTimeout(90000);

async function login(page:Page, perfil:keyof typeof emails) {
  await page.goto('/login');
  await page.getByLabel('E-mail',{exact:true}).fill(emails[perfil]);
  await page.getByLabel('Senha',{exact:true}).fill('T1-fixture-2026!');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function preencherCadastro(page:Page, v:string, descricao:string, dia:string, corretiva=false) {
  await page.getByRole('button',{name:'Registrar manutenção'}).click();
  const modal = page.getByRole('dialog');
  await selecionarOpcao(modal.getByRole('combobox',{name:'Veículo',exact:true}),v);
  if (corretiva) {
    await selecionarOpcao(modal.getByRole('combobox',{name:'Tipo de manutenção'}),'CORRETIVA');
    await modal.getByLabel('Iniciar imediatamente').check();
  }
  await modal.getByLabel('Descrição do serviço').fill(descricao);
  await modal.getByLabel('Data de entrada',{exact:true}).fill(dia);
  await modal.getByLabel('Data prevista de conclusão').fill(dia);
  await modal.getByLabel('Quilometragem').fill('12000');
  return modal;
}

async function confirmar(page:Page, acao:string, destino?:string) {
  await page.getByRole('button',{name:acao,exact:true}).click();
  const modal=page.getByRole('dialog',{name:acao});
  if (destino) await selecionarOpcao(modal.getByRole('combobox',{name:'Estado de destino'}),destino);
  await modal.getByRole('button',{name:acao==='Cancelar manutenção'?'Confirmar cancelamento':'Confirmar',exact:true}).click();
  await expect(modal).toBeHidden();
}

for (const perfil of ['ADM','GESTOR'] as const) test('menu, shell e rota de '+perfil,async ({page})=>{
  const rota = perfil==='ADM'?'/admin/manutencoes':'/gestor/manutencoes';
  await login(page,perfil);
  const menu=page.getByRole(perfil==='ADM'?'link':'button',{name:'Manutenções',exact:true});
  await menu.click({timeout:10000});
  await expect(page).toHaveURL(rota);
  await expect(page.getByRole('heading',{name:'Manutenções',exact:true})).toBeVisible();
  await expect(menu).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('banner').getByText(perfil==='ADM'?'Administrador':'Gestor de Frota',{exact:true})).toBeVisible();
});

test('sessão encerrada e solicitante não acessam manutenção pela URL direta',async ({page})=>{
  await login(page,'ADM');
  await page.goto('/admin/manutencoes');
  await expect(page.getByRole('heading',{name:'Manutenções',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  await expect(page).toHaveURL('/login');
  await login(page,'SOLICITANTE');
  const chamadas:string[]=[];
  page.on('request',r=>{if(r.url().includes('/api/manutencoes'))chamadas.push(r.url());});
  await page.goto('/gestor/manutencoes/-23500000',{waitUntil:'domcontentloaded'});
  await expect(page).not.toHaveURL(/\/gestor\/manutencoes/);
  await expect(page.getByRole('heading',{name:'Manutenções',exact:true})).toHaveCount(0);
  expect(chamadas).toEqual([]);
});


test('lista real usa filtros combinados e paginação do servidor', async ({page,cenario:c}) => {
  await c.db`INSERT INTO public.manutencao_veiculo
    (veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
    SELECT ${c.veiculo},'PREVENTIVA','Listagem S235 '||g,
      ${c.hoje}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${c.hoje}::date::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',-27001,-27001 FROM generate_series(1,22) g`;
  await login(page,'GESTOR');
  await page.goto('/gestor/manutencoes');
  await selecionarOpcao(page.getByRole('combobox',{name:'Veículo',exact:true}),c.veiculo);
  await selecionarOpcao(page.getByRole('combobox',{name:'Tipo',exact:true}),'PREVENTIVA');
  await selecionarOpcao(page.getByRole('combobox',{name:'Status',exact:true}),'AGENDADA');
  await page.getByLabel('Entrada a partir de').fill(c.hoje);
  await page.getByLabel('Buscar',{exact:true}).fill('Listagem S235');
  await expect(page.getByText('22 registros',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Ver detalhes',exact:true})).toHaveCount(20);
  const segunda = page.waitForResponse(r=>r.url().includes('/api/manutencoes?') && new URL(r.url()).searchParams.get('page')==='2');
  await page.getByRole('button',{name:'Próxima página'}).click();
  expect((await segunda).status()).toBe(200);
  await expect(page.getByRole('link',{name:'Ver detalhes',exact:true})).toHaveCount(2);
  await page.getByRole('button',{name:'Limpar filtros'}).click();
  await expect(page.getByLabel('Buscar',{exact:true})).toHaveValue('');
});

test('cadastro, transições, correção e navegação persistem após reload',async ({page,cenario:c})=>{
  await login(page,'ADM');
  await page.goto('/admin/manutencoes');
  let modal=await preencherCadastro(page,c.veiculo,'Preventiva S235',c.hoje);
  await expect(modal.getByLabel('Custo (R$)')).toHaveValue('');
  await modal.getByRole('button',{name:'Registrar',exact:true}).click();
  await page.getByRole('link',{name:'Ver detalhes da manutenção'}).click();
  const rota=page.url();
  await expect(page.getByRole('heading',{name:'Manutenção do veículo '+c.placa})).toBeVisible();
  const eventos = page.getByRole('region',{name:'Histórico da manutenção'});
  await expect(eventos.getByText(/Cadastro, edições comuns e início constam na Auditoria/)).toBeVisible();
  await confirmar(page,'Iniciar manutenção');
  await expect(eventos.getByText('Nenhum evento de histórico registrado para esta manutenção.')).toBeVisible();
  await confirmar(page,'Concluir manutenção');
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  modal=page.getByRole('dialog',{name:'Editar manutenção'});
  await modal.getByLabel('Conclusão efetiva').fill(c.amanha+' 21:00:00,123456');
  await modal.getByLabel('Custo (R$)').fill('0');
  await modal.getByLabel('Prestador responsável').fill('Prestador atualizado S235');
  await modal.getByLabel('Observações').fill('Observações atualizadas S235');
  await modal.getByRole('button',{name:'Salvar alterações'}).click();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('heading',{name:'Correção de datas'})).toBeVisible();
  await page.reload();
  await expect(page.getByText('R$ 0,00',{exact:true})).toBeVisible();
  await expect(page.getByText('Prestador atualizado S235',{exact:true})).toBeVisible();
  await expect(page.getByText('Observações atualizadas S235',{exact:true})).toBeVisible();
  await confirmar(page,'Reabrir manutenção','AGENDADA');
  await confirmar(page,'Cancelar manutenção');
  await confirmar(page,'Reativar manutenção','EM_ANDAMENTO');
  await expect(page.getByRole('heading',{name:'Reativação'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Cancelar manutenção'})).toHaveCount(0);
  await page.getByRole('link',{name:'Ver veículo',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/admin/veiculos/'+c.veiculo+'$'));
  await page.reload();
  await expect(page.getByText('Status cadastral',{exact:true})).toBeVisible();
  await expect(page.getByText(/A disponibilidade para viagens e despachos é verificada/)).toBeVisible();
  const historico=page.getByRole('region',{name:'Manutenções do veículo'});
  await expect(historico.getByText('Preventiva S235',{exact:true})).toBeVisible();
  await historico.getByRole('link',{name:'Ver detalhes'}).click();
  await expect(page).toHaveURL(rota);
  await page.goto('/admin/manutencoes');
  modal=await preencherCadastro(page,c.veiculo,'Corretiva imediata S235',c.hoje,true);
  await modal.getByRole('button',{name:'Registrar',exact:true}).click();
  await page.getByRole('link',{name:'Ver detalhes da manutenção'}).click();
  await expect(page.getByRole('button',{name:'Concluir manutenção'})).toBeVisible();
});

test('duas sessões preservam rascunho e exigem revisão antes de reenviar',async ({page,baseURL,cenario:c})=>{
  const [m]=await c.db`INSERT INTO public.manutencao_veiculo
    (veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
    VALUES (${c.veiculo},'PREVENTIVA','Original S235',${c.hoje}::date::timestamp AT TIME ZONE 'America/Maceio',
       ${c.hoje}::date::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',-27001,-27001) RETURNING id::text`;
  await login(page,'ADM'); await page.goto('/admin/manutencoes/'+m.id);
  const outra=await page.context().browser()!.newContext({baseURL});
  try {
    const b=await outra.newPage(); await login(b,'GESTOR'); await b.goto('/gestor/manutencoes/'+m.id);
    for (const p of [page,b]) await p.getByRole('button',{name:'Editar',exact:true}).click();
    const aModal=page.getByRole('dialog',{name:'Editar manutenção'}), bModal=b.getByRole('dialog',{name:'Editar manutenção'});
    await aModal.getByLabel('Descrição do serviço').fill('Alteração do ADM');
    await bModal.getByLabel('Descrição do serviço').fill('Alteração concorrente');
    await bModal.getByLabel('Prestador responsável').fill('Prestador da concorrente');
    await bModal.getByRole('button',{name:'Salvar alterações'}).click();
    await expect(bModal).toBeHidden();
    await aModal.getByRole('button',{name:'Salvar alterações'}).click();
    await expect(aModal.getByText('Alteração concorrente neste campo')).toBeVisible();
    await expect(aModal.getByLabel('Descrição do serviço')).toHaveValue('Alteração do ADM');
    await aModal.getByRole('button',{name:'Revisar com os dados atuais'}).click();
    await expect(aModal.getByLabel('Prestador responsável')).toHaveValue('Prestador da concorrente');
    await expect(b.getByText('Alteração concorrente',{exact:true})).toBeVisible();
    await aModal.getByRole('button',{name:'Salvar alterações'}).click();
    await expect(aModal).toBeHidden();
    await b.reload();
    await expect(b.getByText('Alteração do ADM',{exact:true})).toBeVisible();
    await expect(b.getByText('Prestador da concorrente',{exact:true})).toBeVisible();
  } finally { await outra.close(); }
});

test('conflito de alocação conserva o formulário e a reserva',async ({page,cenario:c})=>{
  await c.db`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,
    data_hora_retorno_previsto,status,motorista_id,veiculo_id)
    VALUES (${c.reserva},${'S235-'+c.placa},-27003,'A','B','Fixture S235',
      ${c.amanha}::date + time '10:00',${c.amanha}::date + time '12:00','AGENDADA',-27001,${c.veiculo})`;
  await login(page,'GESTOR'); await page.goto('/gestor/manutencoes');
  const modal=await preencherCadastro(page,c.veiculo,'Janela conflitante S235',c.amanha);
  const erro=page.waitForResponse(r=>r.url().endsWith('/api/manutencoes') && r.request().method()==='POST');
  await modal.getByRole('button',{name:'Registrar',exact:true}).click();
  const resposta=await erro;
  expect(resposta.status()).toBe(409);
  expect((await resposta.json()).error.code).toBe('CONFLITO_ALOCACAO');
  await expect(modal.getByRole('alert')).toBeVisible();
  await expect(modal.getByLabel('Descrição do serviço')).toHaveValue('Janela conflitante S235');
  const [reserva]=await c.db`SELECT veiculo_id::text, status::text FROM public.solicitacao_viagem WHERE id=${c.reserva}`;
  expect({...reserva}).toMatchObject({veiculo_id:c.veiculo,status:'AGENDADA'});
});

for(const width of [390,768,1280]) test('layout e teclado em '+width+' px',async ({page,cenario:c})=>{
  await c.db`INSERT INTO public.manutencao_veiculo
      (veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
      SELECT ${c.veiculo},'PREVENTIVA','Layout S235 '||g,
        ${c.hoje}::date::timestamp AT TIME ZONE 'America/Maceio',
        ${c.hoje}::date::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',-27001,-27001 FROM generate_series(1,2) g`;
  await page.setViewportSize({width,height:900});
  await login(page,'ADM');
  await page.goto('/admin/manutencoes');
  await page.getByLabel('Buscar',{exact:true}).fill(c.placa);
  await expect(page.getByText('2 registros',{exact:true})).toBeVisible();
  const colunas=await page.locator('.manutencoes__grade').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(colunas).toBe(width===1280?2:1);
  const trigger=page.getByRole('button',{name:'Registrar manutenção'});
  await trigger.focus();
  await page.keyboard.press('Enter');
  const modal=page.getByRole('dialog',{name:'Registrar manutenção'});
  await expect(modal).toBeVisible();
  for(let i=0;i<16;i++) {
    await page.keyboard.press('Tab');
    expect(await modal.evaluate(d=>d.contains(document.activeElement))).toBe(true);
  }
  const metricas=await modal.evaluate(d=>({
    semOverflow:document.documentElement.scrollWidth<=innerWidth && d.scrollWidth<=d.clientWidth+1,
    alvos:[...d.querySelectorAll<HTMLElement>('.btn, .select-personalizado, input:not([type=checkbox])')]
      .filter(a=>a.getClientRects().length).every(a=>{const box=a.getBoundingClientRect();return box.height>=40 && box.width>=40;}),
  }));
  expect(metricas).toEqual({semOverflow:true,alvos:true});
  const contrastes=await modal.evaluate(d => {
    function luminancia(rgb:string) {
      const [r,g,b]=(rgb.match(/\d+(?:\.\d+)?/g) ?? []).slice(0,3).map(x=>{
        const n=Number(x)/255;
        return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
      });
      return .2126*r+.7152*g+.0722*b;
    }
    return ['h2','header p','button.btn--primario'].map(selector=>{
      const style=getComputedStyle(d.querySelector(selector)!);
      const fundo=style.backgroundColor==='rgba(0, 0, 0, 0)'?getComputedStyle(d).backgroundColor:style.backgroundColor;
      const a=luminancia(style.color), b=luminancia(fundo);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
  });
  for(const contraste of contrastes) expect(contraste).toBeGreaterThanOrEqual(4.5);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(trigger).toBeFocused();
});
