import { expect, test as base, type Page } from '@playwright/test';
import { verifiedSql, testProfile } from '../../backend/src/database/scripts/verify-test-db.js';
import { selecionarOpcao } from './fixtures/controls';

const emails = {ADM:'t1-adm@example.invalid', GESTOR:'t1-gestor_frota@example.invalid', SOLICITANTE:'t1-solicitante_interno@example.invalid'};
const test = base.extend<{cenario:{veiculo:string; placa:string; hoje:string; amanha:string; reserva:string; db:Awaited<ReturnType<typeof verifiedSql>>}}>({
  cenario: async ({browserName}, use, info) => {
    expect(browserName).toBe('chromium');
    expect(['s10-integracao-clean', 's10-integracao-fk-final', 's10-consolidada-clean', 's10-candidata-e2e']).toContain(testProfile);
    const db = await verifiedSql(true);
    const veiculo = String(-23600000 - info.workerIndex * 1000);
    const placa = 'S36' + String(info.workerIndex).padStart(4,'0');
    const reserva = String(Number(veiculo) - 1);
    const [dias] = await db`SELECT d::text AS hoje, (d+1)::text AS amanha
      FROM (SELECT (statement_timestamp() AT TIME ZONE 'America/Maceio')::date d) x`;
    let criada = false;
    try {
      await db`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status)
        VALUES (${veiculo},${placa},'Fixture','Teste SCRUM-236',2026,'PASSEIO','DISPONIVEL')`;
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


const painel = (page:Page) => page.getByRole('region',{name:'Indicadores de manutenção'});
const banner = (page:Page) => page.getByRole('region',{name:'Preventivas nos próximos 7 dias'});
const agendadas = (page:Page) => painel(page).getByRole('article',{name:'Agendadas',exact:true});
const endpoint = '/api/manutencoes/indicadores';

async function abrir(page:Page, veiculo:string, perfil:'ADM'|'GESTOR'='ADM') {
  await login(page,perfil);
  const base = perfil==='ADM'?'/admin/manutencoes':'/gestor/manutencoes';
  await page.goto(base+'?veiculoId='+veiculo);
  await expect(painel(page)).toBeVisible();
}

test('preventiva real faz o banner aparecer e desaparecer; início, conclusão e filtros persistem',async({page,cenario:c})=>{
  await abrir(page,c.veiculo);
  await expect(agendadas(page)).toContainText('0');
  await expect(banner(page)).toHaveCount(0);
  const semEspaco = await page.locator('.manutencoes').evaluate(el =>
    el.querySelector('.manutencoes__indicadores')?.nextElementSibling?.classList.contains('manutencoes__filtros'));
  expect(semEspaco).toBe(true);
  const modal=await preencherCadastro(page,c.veiculo,'Preventiva S236',c.hoje);
  await modal.getByLabel('Custo (R$)').fill('300,50');
  await modal.getByRole('button',{name:'Registrar',exact:true}).click();
  await expect(painel(page).locator('.manutencoes__indicador')).toHaveCount(6);
  const linkPreventiva=banner(page).getByRole('link');
  await expect(banner(page).getByText(c.placa,{exact:true})).toBeVisible();
  const medidas=await linkPreventiva.evaluate(link=>{
    const painel=link.closest('section')!;
    function luminancia(rgb:string) {
      const [r,g,b]=(rgb.match(/\d+(?:\.\d+)?/g) ?? []).slice(0,3).map(x=>{
        const n=Number(x)/255;
        return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4;
      });
      return .2126*r+.7152*g+.0722*b;
    }
    const texto=luminancia(getComputedStyle(link).color);
    const fundo=luminancia(getComputedStyle(painel).backgroundColor);
    return {altura:link.getBoundingClientRect().height,contraste:(Math.max(texto,fundo)+.05)/(Math.min(texto,fundo)+.05)};
  });
  expect(medidas.altura).toBeGreaterThanOrEqual(40);
  expect(medidas.contraste).toBeGreaterThanOrEqual(4.5);
  await expect(banner(page)).toContainText(c.hoje.split('-').reverse().join('/'));
  await expect(painel(page)).toContainText('R$ 300,50');
  await page.getByRole('searchbox',{name:'Buscar',exact:true}).fill('Preventiva S236');
  await expect(page.getByText('1 registro',{exact:true})).toBeVisible();
  await banner(page).getByRole('link').click();
  await expect(page).not.toHaveURL(/q=|Preventiva%20S236/);
  await expect(page.getByRole('heading',{name:'Manutenção do veículo '+c.placa})).toBeVisible();
  const rota=page.url();
  await page.goBack({waitUntil:'domcontentloaded'});
  await expect(page.getByRole('searchbox',{name:'Buscar',exact:true})).toHaveValue('Preventiva S236');
  await page.goForward({waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(rota);
  await confirmar(page,'Iniciar manutenção');
  await page.getByRole('link',{name:/Voltar para manutenções/}).click();
  await expect(page.getByRole('searchbox',{name:'Buscar',exact:true})).toHaveValue('Preventiva S236');
  await expect(painel(page).getByRole('article',{name:'Em andamento',exact:true})).toContainText('1');
  await expect(banner(page)).toHaveCount(0);
  await page.getByRole('link',{name:'Ver detalhes',exact:true}).click();
  await confirmar(page,'Concluir manutenção');
  await expect(page.getByRole('heading',{name:'Conclusão',exact:true})).toBeVisible();
  await page.getByRole('link',{name:/Voltar para manutenções/}).click();
  await page.reload();
  await expect(page.getByRole('searchbox',{name:'Buscar',exact:true})).toHaveValue('Preventiva S236');
  await expect(painel(page).getByRole('article',{name:'Concluídas',exact:true})).toContainText('1');
  await expect(painel(page)).toContainText('R$ 300,50');
});

test('cancelamento exclui o custo e mantém o evento após reload',async({page,cenario:c})=>{
  await abrir(page,c.veiculo,'GESTOR');
  const modal=await preencherCadastro(page,c.veiculo,'Cancelar S236',c.hoje);
  await modal.getByLabel('Custo (R$)').fill('0');
  await modal.getByRole('button',{name:'Registrar',exact:true}).click();
  await expect(painel(page)).toContainText('R$ 0,00');
  await page.getByRole('link',{name:'Ver detalhes da manutenção'}).click();
  await confirmar(page,'Cancelar manutenção');
  await page.reload();
  await expect(page.getByRole('heading',{name:'Cancelamento',exact:true})).toBeVisible();
  await page.getByRole('link',{name:/Voltar para manutenções/}).click();
  await expect(painel(page)).toContainText('Sem ocorrências no recorte');
  await expect(agendadas(page)).toContainText('0');
});

test('atrasos têm acesso compacto, status preservado e limite real; filtros exclusivos não repetem o GET',async({page,cenario:c})=>{
  await c.db`INSERT INTO public.manutencao_veiculo
    (veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
    SELECT ${c.veiculo},'PREVENTIVA','Vencida S236 '||g,
      (${c.hoje}::date-1)::timestamp AT TIME ZONE 'America/Maceio',
      (${c.hoje}::date-1)::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',-27001,-27001 FROM generate_series(1,21) g`;
  const chamadas: URL[]=[];
  page.on('request',r=>{const u=new URL(r.url());if(u.pathname===endpoint)chamadas.push(u);});
  await abrir(page,c.veiculo);
  await selecionarOpcao(page.getByRole('combobox',{name:'Tipo',exact:true}),'PREVENTIVA');
  await page.getByLabel('Entrada a partir de').fill(c.hoje.slice(0,4)+'-01-01');
  await expect(painel(page).getByRole('button',{name:'Atrasadas: 21 ocorrências'})).toBeVisible();
  await expect.poll(()=>chamadas.at(-1)?.searchParams.get('inicio')).toBe(c.hoje.slice(0,4)+'-01-01');
  const antes=chamadas.length;
  await selecionarOpcao(page.getByRole('combobox',{name:'Status',exact:true}),'AGENDADA');
  await page.getByRole('searchbox',{name:'Buscar',exact:true}).fill('Vencida S236');
  await expect(page.getByRole('link',{name:'Ver detalhes',exact:true})).toHaveCount(20);
  await page.getByRole('button',{name:'Próxima página'}).click();
  await expect(page.getByRole('link',{name:'Ver detalhes',exact:true})).toHaveCount(1);
  expect(chamadas.length).toBe(antes);
  expect(chamadas.every(u=>[...u.searchParams.keys()].every(k=>['veiculoId','tipo','inicio','fim'].includes(k)))).toBe(true);
  await expect(page.getByText('Atrasada',{exact:true})).toBeVisible();
  await expect(page.getByText('Agendada',{exact:true}).last()).toBeVisible();
  const card=painel(page).getByRole('button',{name:'Atrasadas: 21 ocorrências'});
  await card.focus(); await page.keyboard.press('Enter');
  const atraso=page.getByRole('region',{name:'Ocorrências atrasadas'});
  await expect(atraso.getByRole('link')).toHaveCount(20);
  await expect(atraso).toContainText('Exibindo 20 de 21 ocorrências.');
  await atraso.getByRole('link').first().click();
  await expect(page.getByRole('heading',{name:'Manutenção do veículo '+c.placa})).toBeVisible();
  await page.getByRole('link',{name:/Voltar para manutenções/}).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('searchbox',{name:'Buscar',exact:true})).toHaveValue('Vencida S236');
});

test('falha apenas no GET de indicadores preserva lista e retry real',async({page,cenario:c})=>{
  await login(page,'ADM');
  await page.route('**/api/manutencoes/indicadores?**',r=>r.abort());
  await page.goto('/admin/manutencoes?veiculoId='+c.veiculo);
  await expect(page.getByRole('alert').filter({hasText:'Indicadores indisponíveis'})).toBeVisible();
  await expect(page.getByText('Nenhuma manutenção encontrada para os filtros.')).toBeVisible();
  await page.unroute('**/api/manutencoes/indicadores?**');
  await page.getByRole('button',{name:'Tentar novamente os indicadores'}).click();
  await expect(painel(page)).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  await login(page,'SOLICITANTE');
  let requests=0;
  page.on('request',r=>{if(new URL(r.url()).pathname===endpoint) requests++;});
  await page.goto('/admin/manutencoes');
  await expect(page).not.toHaveURL(/\/admin\/manutencoes$/);
  await expect(painel(page)).toHaveCount(0);
  expect(requests).toBe(0);
});

test('reserva preservada sem sucesso ou alteração nos indicadores após 409',async({page,cenario:c})=>{
  await c.db`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,
    data_hora_retorno_previsto,status,motorista_id,veiculo_id)
    VALUES (${c.reserva},${'S236-'+c.placa},-27003,'A','B','Fixture S236',
      ${c.amanha}::date + time '10:00',${c.amanha}::date + time '12:00','AGENDADA',-27001,${c.veiculo})`;
  await abrir(page,c.veiculo);
  const modal=await preencherCadastro(page,c.veiculo,'Conflito S236',c.amanha);
  const resultado=page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/api/manutencoes');
  await modal.getByRole('button',{name:'Registrar',exact:true}).click();
  expect((await resultado).status()).toBe(409);
  await expect(modal.getByRole('alert')).toBeVisible();
  await expect(modal.getByLabel('Descrição do serviço')).toHaveValue('Conflito S236');
  await expect(page.getByText('Manutenção registrada.',{exact:true})).toHaveCount(0);
  const [r]=await c.db`SELECT status::text,(SELECT count(*)::int FROM public.manutencao_veiculo WHERE veiculo_id=${c.veiculo}) AS total
    FROM public.solicitacao_viagem WHERE id=${c.reserva} AND veiculo_id=${c.veiculo}`;
  expect({...r}).toEqual({status:'AGENDADA',total:0});
  await page.reload();
  await expect(agendadas(page)).toContainText('0');
});

for (const largura of [390,768,1280,1650]) test('painel responsivo em '+largura+' px',async({page,cenario:c})=>{
  await page.setViewportSize({width:largura,height:900});
  await abrir(page,c.veiculo);
  const grade=painel(page).locator('.manutencoes__indicadores-grade');
  const conferir=async()=>{
    const colunas=await grade.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(colunas).toBe(largura===390?1:largura===768?2:largura===1280?3:6);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  };
  await conferir();
  const menu=page.getByRole('button',{name:/menu/i}).filter({visible:true}).first();
  if (largura>=1280) {await menu.click();await conferir();}
});
