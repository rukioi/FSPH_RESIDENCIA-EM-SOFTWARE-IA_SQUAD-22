import { expect, test, type Page, type Response } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { emailAtendente, motoristas, ordens, prepararFixtureSvo, veiculo } from '../../backend/tests/integration/svo-operacional.fixture.js';
import { verifiedSql } from '../../backend/src/database/scripts/verify-test-db.js';

const senhaFixture = 'T1-fixture-2026!';
const recursos = '/api/svo/recursos-disponiveis';
const ocupacao = `/api/svo/veiculos/${veiculo}/ocupacao`;
const botaoConfirmar = { name: 'Confirmar despacho', exact: true };

function resposta(page: Page, caminho: string, metodo = 'GET') {
  return page.waitForResponse(r => new URL(r.url()).pathname === caminho && r.request().method() === metodo);
}

async function login(page: Page, email: string = emailAtendente) {
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(senhaFixture);
  const [autenticacao, sessao] = await Promise.all([
    resposta(page, '/api/auth/login', 'POST'), resposta(page, '/api/auth/sessao'),
    page.getByRole('button', { name: 'Entrar', exact: true }).press('Enter'),
  ]);
  expect(autenticacao.status()).toBe(200);
  const atendimento = email === emailAtendente;
  expect((await sessao.json()).data.perfil).toBe(atendimento ? 'ATENDENTE_SVO' : 'MOTORISTA');
  await expect(page).toHaveURL(atendimento ? /\/svo\/dashboard$/ : /\/svo\/equipe\/minhas-ordens$/);
}

async function preparar(page: Page, ordemId: number, motoristaId: number, uso: number) {
  const linha = page.getByRole('region', { name: 'Aguardando despacho' })
    .getByRole('row').filter({ hasText: `#OC-${ordemId}` });
  const [candidatos, detalhe] = await Promise.all([
    resposta(page, recursos), resposta(page, `/api/svo/ordens-coleta/${ordemId}`),
    linha.getByRole('button', { name: 'Preparar despacho' }).press('Enter'),
  ]);
  expect(candidatos.status()).toBe(200);
  expect(detalhe.status()).toBe(200);
  expect(await detalhe.json()).toMatchObject({ id: String(ordemId), status: 'PENDENTE_ALOCACAO', statusTriagem: 'CONFIRMADA_SVO' });
  const dados = await candidatos.json();
  expect(dados.motoristas).toContainEqual(expect.objectContaining({ id: String(motoristaId) }));
  expect(dados.veiculos).toContainEqual(expect.objectContaining({ id: String(veiculo), ocupacao: uso, capacidade: 4, disponivel: true }));
  const modal = page.getByRole('dialog', { name: 'Preparar despacho' });
  const [capacidade] = await Promise.all([
    resposta(page, ocupacao), modal.getByLabel('Veículo', { exact: true }).selectOption(String(veiculo)),
  ]);
  expect(capacidade.status()).toBe(200);
  expect(await capacidade.json()).toMatchObject({ id: String(veiculo), ocupacao: uso, capacidade: 4 });
  await expect(modal.getByText(`Ocupação atual: ${uso}/4`, { exact: true })).toBeVisible();
  await modal.getByLabel('Motorista', { exact: true }).selectOption(String(motoristaId));
  await expect(modal.getByRole('button', botaoConfirmar)).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  return modal;
}

async function despachar(page: Page, ordemId: number, motoristaId: number, usoFinal: number) {
  const modal = page.getByRole('dialog', { name: 'Preparar despacho' });
  const [gravacao, reconsulta] = await Promise.all([
    resposta(page, `/api/svo/ordens-coleta/${ordemId}/despachar`, 'PATCH'), resposta(page, recursos),
    modal.getByRole('button', botaoConfirmar).press('Enter'),
  ]);
  expect(gravacao.status()).toBe(200);
  const ordem = await gravacao.json();
  expect(ordem).toMatchObject({ id: ordemId, motorista_id: motoristaId, veiculo_id: veiculo, status: 'EM_DESLOCAMENTO' });
  expect(reconsulta.status()).toBe(200);
  expect((await reconsulta.json()).veiculos).toContainEqual(expect.objectContaining({
    id: String(veiculo), ocupacao: usoFinal, capacidade: 4, disponivel: usoFinal < 4,
  }));
  await expect(modal).toHaveCount(0);
  return ordem;
}

test('SCRUM-136 despacha pela interface, persiste após reload e recusa a quinta vaga', async ({ page, context, baseURL }, info) => {
  test.setTimeout(60_000);
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
  const fixture = await prepararFixtureSvo(senhaFixture);
  const http: object[] = [];
  const erros: string[] = [];
  function observar(p: Page) {
    p.on('pageerror', e => erros.push(e.message));
    p.on('response', (r: Response) => {
      const path = new URL(r.url()).pathname;
      if (path.startsWith('/api/')) http.push({ metodo: r.request().method(), path, status: r.status(), requestId: r.headers()['x-request-id'] });
    });
  }
  async function lerOrdens() {
    return fixture.sql`SELECT id::int, status::text, motorista_id::int, veiculo_id::int, quantidade_corpos
      FROM public.ordem_coleta WHERE id IN (${ordens[0]}, ${ordens[1]}, ${ordens[2]}) ORDER BY id`;
  }
  const evidencia: Record<string, unknown> = { baseURL, http, erros };
  try {
    observar(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    const outraAba = await context.newPage();
    observar(outraAba);
    await outraAba.setViewportSize({ width: 390, height: 850 });
    await login(outraAba);
    // A terceira ordem concorre com as duas primeiras por uma vaga na mesma S10.
    const modalAntigo = await preparar(outraAba, ordens[2], motoristas[2], 0);
    evidencia.antes = await lerOrdens();
    await preparar(page, ordens[0], motoristas[0], 0);
    evidencia.primeiroDespacho = await despachar(page, ordens[0], motoristas[0], 3);
    await page.setViewportSize({ width: 768, height: 900 });
    await preparar(page, ordens[1], motoristas[1], 3);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: info.outputPath('preparar-despacho-3-de-4.png') });
    evidencia.segundoDespacho = await despachar(page, ordens[1], motoristas[1], 4);
    const [conflito, candidatos, capacidade] = await Promise.all([
      resposta(outraAba, `/api/svo/ordens-coleta/${ordens[2]}/despachar`, 'PATCH'),
      resposta(outraAba, recursos), resposta(outraAba, ocupacao),
      modalAntigo.getByRole('button', botaoConfirmar).press('Enter'),
    ]);
    expect(conflito.status()).toBe(409);
    expect(candidatos.status()).toBe(200);
    expect(capacidade.status()).toBe(200);
    evidencia.ocupacaoFinal = await capacidade.json();
    expect(evidencia.ocupacaoFinal).toMatchObject({ id: String(veiculo), ocupacao: 4, capacidade: 4, disponivel: false });
    await expect(modalAntigo.getByRole('alert').filter({ hasText: '409' })).toBeVisible();
    await expect(modalAntigo.getByRole('button', botaoConfirmar)).toBeDisabled();
    await expect(modalAntigo.getByText('Ocupação atual: 4/4')).toBeVisible();
    await outraAba.setViewportSize({ width: 1280, height: 900 });
    await outraAba.screenshot({ path: info.outputPath('conflito-409-lotacao.png') });
    await page.goto('/svo/ordens?status=EM_DESLOCAMENTO');
    const [lista] = await Promise.all([resposta(page, '/api/svo/ordens-coleta/paginadas'), page.reload()]);
    expect(lista.status()).toBe(200);
    for (const id of ordens.slice(0, 2)) {
      await expect(page.getByRole('row').filter({ hasText: `#OC-${id}` })).toContainText('Em deslocamento');
    }
    evidencia.urlAposReload = page.url();
    await page.screenshot({ path: info.outputPath('ordens-apos-reload.png') });
    const persistidas = await lerOrdens();
    expect(persistidas).toEqual([
      { id: ordens[0], status: 'EM_DESLOCAMENTO', motorista_id: motoristas[0], veiculo_id: veiculo, quantidade_corpos: 3 },
      { id: ordens[1], status: 'EM_DESLOCAMENTO', motorista_id: motoristas[1], veiculo_id: veiculo, quantidade_corpos: 1 },
      { id: ordens[2], status: 'PENDENTE_ALOCACAO', motorista_id: null, veiculo_id: null, quantidade_corpos: 1 },
    ]);
    evidencia.depoisDoReload = persistidas;
    expect(erros).toEqual([]);
  } finally {
    await fixture.limpar();
    const verificacao = await verifiedSql();
    try {
      const [restantes] = await verificacao`SELECT
        (SELECT count(*)::int FROM public.ordem_coleta WHERE id BETWEEN 38141 AND 38145) AS ordens,
        (SELECT count(*)::int FROM public.solicitacao_obito WHERE id BETWEEN 38131 AND 38135) AS solicitacoes,
        (SELECT count(*)::int FROM public.motorista WHERE id BETWEEN 38110 AND 38112) AS motoristas,
        (SELECT count(*)::int FROM public.veiculo WHERE id IN (38120,38121)) AS veiculos,
        (SELECT count(*)::int FROM public.usuario WHERE id BETWEEN 38100 AND 38104) AS usuarios,
        (SELECT count(*)::int FROM public.log_atividade WHERE usuario_id BETWEEN 38100 AND 38104) AS atividades`;
      evidencia.restantesAposLimpeza = restantes;
      await writeFile(info.outputPath('evidencias.json'), JSON.stringify(evidencia, null, 2));
      expect(Object.values(restantes)).toEqual([0, 0, 0, 0, 0, 0]);
    } finally {
      await verificacao.end();
    }
  }
});

type Evento = { id: string; descricao: string; dataHora: string; usuarioNome: string };
const apiOrdens = '/api/svo/ordens-coleta';
const apiSolicitacoes = '/api/svo/solicitacoes';
const execucao = (id: string | number) => '/svo/equipe/ordens/' + id + '/execucao';

// Usa o mesmo transporte autenticado do frontend para sondar recusas que a interface impede.
async function verificarPermissao(page: Page, path: string, status: number, init: RequestInit = {}) {
  const recebido = await page.evaluate(async ({ path, init }) => {
    const modulo = '/src/shared/services/auth.service.ts';
    const { fetchAutenticada } = await import(modulo);
    return (await fetchAutenticada(path, init)).status;
  }, { path, init });
  expect(recebido, path).toBe(status);
}

async function abrirComando(page: Page, nome: string) {
  await page.getByRole('button', { name: nome, exact: true }).press('Enter');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Voltar' })).toBeFocused();
}

async function confirmarComando(page: Page, id: string | number, acao: string, status = 200) {
  const [resultado] = await Promise.all([
    resposta(page, apiOrdens + '/' + id + '/' + acao, 'PATCH'),
    page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).press('Enter'),
  ]);
  expect(resultado.status()).toBe(status);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

for (const width of [390, 768, 1280]) test('Épico 06 — atendimento, duas equipes, execução e histórico em ' + width + ' px', async ({ page, context, request, baseURL }, info) => {
  test.setTimeout(120_000);
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1');
  const fixture = await prepararFixtureSvo(senhaFixture);
  const { sql } = fixture;
  const http: object[] = [];
  const erros: string[] = [];
  const evidencia: Record<string, unknown> = { http, erros };
  const capturas: string[] = [];
  const falhasHttp: string[] = [];
  const falhasDeRede: string[] = [];
  const cancelamentosDeLeitura: string[] = [];
  const externos = new Set<string>();
  const avisosReact: string[] = [];
  const etapas: object[] = [];
  let offline = false;
  evidencia.etapas = etapas;
  async function capturar(p: Page, nome: string) {

      expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), nome + ' em ' + width).toBe(true);
      await expect(p.getByRole('main').getByRole('button', {name: '', exact: true})).toHaveCount(0);
      await expect(p.getByRole('main').getByRole('textbox', {name: '', exact: true})).toHaveCount(0);
      const dialog = p.getByRole('dialog');
      if (await dialog.count()) {
        const caixa = await dialog.boundingBox();
        expect(caixa).not.toBeNull();
        expect(caixa!.x).toBeGreaterThanOrEqual(0);
        expect(caixa!.y).toBeGreaterThanOrEqual(0);
        expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(width + 1);
        expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(901);
      }
      const arquivo = nome + '-' + width + '.png';
      await p.screenshot({ path: info.outputPath(arquivo), animations: 'disabled' });
      capturas.push(arquivo);
  }
  function observar(p: Page) {
    p.on('pageerror', e => erros.push(e.message));
    p.on('console', msg => {
      if (msg.type() === 'warning' || msg.type() === 'error' && !msg.text().startsWith('Failed to load resource:')) {
        avisosReact.push(msg.text());
      }
    });
    p.on('requestfailed', req => {
      const url = new URL(req.url());
      const erro = req.failure()?.errorText;
      if (url.origin !== baseURL) { externos.add(url.hostname + ' ' + erro); return; }
      if (req.method() === 'GET' && erro === 'net::ERR_ABORTED') { cancelamentosDeLeitura.push(url.pathname); return; }
      if (offline && req.method() === 'GET' && url.pathname === apiOrdens + '/minhas' && erro === 'net::ERR_INTERNET_DISCONNECTED') return;
      falhasDeRede.push(req.method() + ' ' + url.pathname + ' ' + erro);
    });
    p.on('response', r => {
      const path = new URL(r.url()).pathname;
      if (r.status() >= 400) falhasHttp.push(r.request().method() + ' ' + path + ' ' + r.status());
      if (path.startsWith('/api/')) http.push({ path, method: r.request().method(), status: r.status(), requestId: r.headers()['x-request-id'] });
    });
  }
  async function contarOrdens(id: string) {
    const [linha] = await sql`SELECT count(*)::int AS total FROM public.ordem_coleta WHERE solicitacao_obito_id=${id}`;
    return linha.total;
  }
  async function cadastrarETriar(destino: 'SVO' | 'IML') {
    await page.getByRole('button', { name: /Nova Solicitação/ }).press('Enter');
    await expect(page).toHaveURL(/\/svo\/solicitacoes\/nova$/);
    await page.reload();
    await page.locator('[name=nomeSolicitante]').fill('Atendimento de teste isolado');
    await page.locator('[name=localFalecimento]').fill('Unidade fictícia');
    await page.locator('[name=endereco]').fill('Rua fictícia');
    if (destino === 'SVO') await capturar(page, 'cadastro');
    const [cadastro] = await Promise.all([resposta(page, apiSolicitacoes, 'POST'), page.getByRole('button', { name: 'Registrar', exact: true }).press('Enter')]);
    expect(cadastro.status()).toBe(201);
    const { solicitacao } = await cadastro.json();
    expect(solicitacao.statusTriagem).toBe('AGUARDANDO_TRIAGEM');
    const [criada] = await sql`SELECT id::text, codigo, status_triagem::text FROM public.solicitacao_obito WHERE id=${solicitacao.id}`;
    expect(criada).toEqual({id: solicitacao.id, codigo: solicitacao.codigo, status_triagem:'AGUARDANDO_TRIAGEM'});
    etapas.push({cadastro: criada});
    expect(await contarOrdens(solicitacao.id)).toBe(0);
    await page.getByRole('link', { name: 'Consultar solicitações', exact: true }).press('Enter');
    const protocolo = page.getByRole('link', { name: solicitacao.codigo, exact: true });
    await expect(protocolo).toBeVisible();
    if (destino === 'SVO') await capturar(page, 'lista');
    await protocolo.press('Enter');
    await expect(page.getByText('Sem ordem vinculada.')).toBeVisible();
    await page.goBack();
    await expect(protocolo).toBeVisible();
    await page.goForward();
    await expect(page.getByText('Sem ordem vinculada.')).toBeVisible();
    await page.reload();
    await page.getByRole('link', { name: 'Realizar triagem' }).press('Enter');
    await page.reload();
    const notas = page.getByLabel('Observações da triagem');
    await expect(notas).toBeEditable();
    await notas.fill('Observação da fixture oficial para ' + destino);
    {
      const [salvo] = await Promise.all([resposta(page, apiSolicitacoes + '/' + solicitacao.id + '/triagem', 'PATCH'),
        page.getByRole('button', { name: 'Salvar andamento' }).press('Enter')]);
      expect(salvo.status()).toBe(200);
      const [rascunho] = await sql`SELECT triagem_observacoes, status_triagem::text FROM public.solicitacao_obito WHERE id=${solicitacao.id}`;
      expect(rascunho).toEqual({triagem_observacoes:'Observação da fixture oficial para ' + destino, status_triagem:'AGUARDANDO_TRIAGEM'});
      expect(await contarOrdens(solicitacao.id)).toBe(0);
      await page.reload();
      await expect(notas).toHaveValue(rascunho.triagem_observacoes);
      etapas.push({id:solicitacao.id, rascunho});
    }
    await page.getByRole('radio', { name: destino, exact: true }).check();
    if (destino === 'SVO') {
      await page.getByLabel(/Quantidade de corpos/).fill('3');
      await capturar(page, 'triagem');
    }
    await page.getByRole('button', { name: 'Concluir triagem' }).press('Enter');
    const [decisao] = await Promise.all([resposta(page, apiSolicitacoes + '/' + solicitacao.id + '/triagem', 'POST'),
      page.getByRole('dialog').getByRole('button', { name: destino === 'SVO' ? 'Confirmar SVO' : 'Encaminhar IML' }).press('Enter')]);
    expect(decisao.status()).toBe(200);
    const retorno = await decisao.json();
    expect(await contarOrdens(solicitacao.id)).toBe(destino === 'SVO' ? 1 : 0);
    expect(retorno.solicitacao.statusTriagem).toBe(destino === 'SVO' ? 'CONFIRMADA_SVO' : 'ENCAMINHADA_IML');
    const [triada] = await sql`SELECT status_triagem::text, triado_por_id::text FROM public.solicitacao_obito WHERE id=${solicitacao.id}`;
    expect(triada).toMatchObject({status_triagem:retorno.solicitacao.statusTriagem, triado_por_id:'38100'});
    await page.reload();
    await expect(page.getByText(/Somente leitura\./)).toBeVisible();
    etapas.push({id:solicitacao.id, triada, ordens:await contarOrdens(solicitacao.id)});
    return retorno;
  }
  try {
    observar(page);
    const motoristaA = await context.newPage(), motoristaB = await context.newPage();
    for (const p of [page, motoristaA, motoristaB]) await p.setViewportSize({width, height: 900});
    observar(motoristaA);
    observar(motoristaB);
    await motoristaA.goto(execucao(ordens[0]));
    await expect(motoristaA).toHaveURL(/\/login$/);
    expect((await request.get(apiOrdens + '/minhas')).status()).toBe(401);
    await login(motoristaA, 's7-a@example.invalid');
    await expect(motoristaA.getByText('Nenhuma ordem atribuída a você.')).toBeVisible();
    await login(motoristaB, 's7-b@example.invalid');
    const inicial = resposta(page, '/api/svo/dashboard');
    await login(page);
    const antes = (await (await inicial).json()).indicadores;
    await expect(page.getByRole('button', { name: /Nova Solicitação/ })).toBeVisible();
    await capturar(page, 'dashboard');
    await verificarPermissao(page, apiOrdens + '/minhas', 403);
    await page.goto('/svo/ordens/' + ordens[4]);
    await expect(page.getByText('Nenhum evento registrado.')).toBeVisible();
    await page.goto('/svo/dashboard');
    const iml = await cadastrarETriar('IML');
    expect(iml.ordemColeta).toBeNull();
    await page.goto('/svo/solicitacoes/' + iml.solicitacao.id + '/historico');
    await expect(page.getByText('Encaminhada ao IML, sem ordem de coleta SVO.')).toBeVisible();
    await expect(page.locator('main a[href^="/svo/ordens/"]')).toHaveCount(0);
    await page.goto('/svo/dashboard');
    const svo = await cadastrarETriar('SVO');
    const id: string = svo.ordemColeta.id, codigo: string = svo.ordemColeta.codigo;
    evidencia.triagem = { svo, iml };
    await page.getByRole('link', { name: codigo, exact: true }).press('Enter');
    await expect(page.getByRole('heading', { name: codigo })).toBeVisible();
    await expect(page.locator('nav [aria-current=page]')).toHaveText('Ordens de Coleta');
    await page.getByRole('button', { name: 'Preparar despacho' }).press('Enter');
    const modal = page.getByRole('dialog', { name: 'Preparar despacho' });
    await modal.getByLabel('Veículo', { exact: true }).selectOption(String(veiculo));
    await expect(modal.getByText('Ocupação atual: 0/4')).toBeVisible();
    await modal.getByLabel('Motorista', { exact: true }).selectOption(String(motoristas[0]));
    await capturar(page, 'despacho');
    await despachar(page, Number(id), motoristas[0], 3);
    await page.reload();
    await expect(page.getByText('Em deslocamento', { exact: true })).toBeVisible();
    const [despacho] = await sql`SELECT status::text, motorista_id::int, veiculo_id::int FROM public.ordem_coleta WHERE id=${id}`;
    expect(despacho).toEqual({status:'EM_DESLOCAMENTO',motorista_id:motoristas[0],veiculo_id:veiculo});
    etapas.push({id, despacho});
    await page.goto('/svo/dashboard');
    await preparar(page, ordens[1], motoristas[1], 3);
    await despachar(page, ordens[1], motoristas[1], 4);
    for (const [p, propria, alheia] of [[motoristaA, id, ordens[1]], [motoristaB, ordens[1], id]] as const) {
      await p.reload();
      await expect(p.getByRole('link', { name: 'Abrir execução #OC-' + propria })).toBeVisible();
      await expect(p.getByRole('link', { name: 'Abrir execução #OC-' + alheia })).toHaveCount(0);
      await expect(p.locator('nav a')).toHaveCount(1);
      const [recusa] = await Promise.all([resposta(p, apiOrdens + '/minhas/' + alheia), p.goto(execucao(alheia))]);
      expect(recusa.status()).toBe(404);
      await expect(p.getByRole('alert')).toBeVisible();
      await verificarPermissao(p, apiOrdens + '/' + propria, 403);
      await p.goto('/svo/ordens/' + propria);
      await expect(p.getByRole('heading', { name: 'Acesso negado' })).toBeVisible();
      await p.getByRole('link', { name: 'Voltar ao início' }).press('Enter');
    }
    await capturar(motoristaA, 'minhas-ordens');
    {
      const abrir = motoristaA.getByRole('button', { name: 'Abrir menu' });
      if (width < 901) {
        await expect(abrir).toHaveAttribute('aria-expanded','false');
        await expect(motoristaA.getByRole('navigation')).toHaveCount(0);
        await abrir.press('Enter');
        await expect(motoristaA.locator('[aria-controls="svo-menu"]')).toHaveAttribute('aria-expanded','true');
        await expect(motoristaA.locator('nav [aria-current=page]')).toBeFocused();
      }
      await motoristaA.screenshot({ path: info.outputPath('menu-' + width + '.png') });
      if (width < 901) {
        await motoristaA.keyboard.press('Escape');
        await expect(abrir).toBeFocused();
      }
    }
    await motoristaA.getByRole('link', { name: 'Abrir execução ' + codigo }).press('Enter');
    await expect(motoristaA.getByRole('main')).toBeFocused();
    await expect(motoristaA.getByRole('button', { name: 'Iniciar execução' })).toBeDisabled();
    await verificarPermissao(motoristaA, apiOrdens + '/' + id + '/iniciar', 400, {method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: '{"kmInicial":-1}'});
    const antiga = await context.newPage();
    await antiga.setViewportSize({width, height: 900});
    observar(antiga);
    await login(antiga, 's7-a@example.invalid');
    await antiga.goto(execucao(id));
    for (const p of [antiga, motoristaA]) {
      await p.getByLabel('Quilometragem inicial').fill('100');
      await abrirComando(p, 'Iniciar execução');
    }
    const [listaAposInicio, detalheAposInicio] = await Promise.all([
      resposta(motoristaA, apiOrdens + '/minhas'), resposta(motoristaA, apiOrdens + '/minhas/' + id),
      confirmarComando(motoristaA, id, 'iniciar'),
    ]);
    expect(listaAposInicio.status()).toBe(200);
    expect((await detalheAposInicio.json()).kmInicial).toBe(100);
    await confirmarComando(antiga, id, 'iniciar', 409);
    await expect(antiga.getByRole('alert')).toContainText('409');
    await expect(antiga.getByRole('button', {name: 'Iniciar transporte'})).toBeVisible();
    const [inicio] = await sql`SELECT status::text, km_inicial, data_inicio IS NOT NULL AS iniciada FROM public.ordem_coleta WHERE id=${id}`;
    expect(inicio).toEqual({status:'EM_DESLOCAMENTO', km_inicial:100, iniciada:true});
    etapas.push({id, inicio});
    await motoristaA.reload();
    await abrirComando(motoristaA, 'Iniciar transporte');
    await confirmarComando(motoristaA, id, 'etapa');
    await motoristaA.reload();
    await expect(motoristaA.getByText('Em transporte', {exact: true})).toBeVisible();
    const [transporte] = await sql`SELECT status::text FROM public.ordem_coleta WHERE id=${id}`;
    expect(transporte.status).toBe('EM_TRANSPORTE');
    etapas.push({id, transporte});
    await motoristaA.getByLabel(/Quilometragem final/).fill('99');
    await expect(motoristaA.getByRole('button', {name:'Concluir ordem'})).toBeDisabled();
    await motoristaA.getByLabel(/Quilometragem final/).fill('115');
    await capturar(motoristaA, 'execucao');
    await abrirComando(motoristaA, 'Concluir ordem');
    await confirmarComando(motoristaA, id, 'concluir');
    await motoristaA.reload();
    await expect(motoristaA.getByText('Concluída', {exact:true})).toBeVisible();
    await expect(motoristaA.getByRole('button', {name: 'Concluir ordem'})).toHaveCount(0);
    await motoristaA.getByRole('link', {name:'Voltar a Minhas Ordens'}).press('Enter');
    await expect(motoristaA.getByRole('main')).toContainText('Concluída');
    await page.goto('/svo/ordens/' + ordens[1]);
    await abrirComando(page, 'Cancelar ordem');
    await confirmarComando(page, ordens[1], 'cancelar');
    await motoristaB.reload();
    await expect(motoristaB.getByRole('main')).toContainText('Cancelada');
    await page.goto('/svo/ordens?status=CONCLUIDA');
    await page.reload();
    await page.getByRole('link', {name: codigo, exact: true}).press('Enter');
    const hist = resposta(page, apiOrdens + '/' + id + '/historico');
    await page.reload();
    const eventos: Evento[] = (await (await hist).json()).data;
    const banco = await sql`SELECT l.id::text, l.descricao, to_char(l.data_hora, 'YYYY-MM-DD"T"HH24:MI:SS.US') as "dataHora", u.nome as "usuarioNome"
      FROM public.log_atividade l JOIN public.usuario u ON u.id=l.usuario_id
      WHERE l.descricao LIKE ${'Ordem de coleta #OC-' + id + ' %'} ORDER BY l.data_hora, l.id`;
    expect(banco).toHaveLength(5);
    expect(eventos.map(({id, descricao, dataHora, usuarioNome}) => ({id, descricao, dataHora, usuarioNome}))).toEqual([...banco]);
    const itens = page.locator('main ol li');
    await expect(itens).toHaveCount(eventos.length);
    for (const [indice, evento] of eventos.entries()) {
      await expect(itens.nth(indice)).toContainText(evento.descricao);
      await expect(itens.nth(indice)).toContainText(evento.usuarioNome);
      await expect(itens.nth(indice).locator('time')).toHaveAttribute('datetime', evento.dataHora);
    }
    await capturar(page, 'historico');
    await page.getByRole('link', {name: /e histórico completo/}).press('Enter');
    await expect(page.locator('main ol')).toContainText('registrada por telefone');
    await expect(page.locator('main ol')).toContainText(codigo + ' concluída');
    const [persistida] = await sql`SELECT status::text, motorista_id::int, veiculo_id::int, km_inicial, km_final,
      data_inicio IS NOT NULL AS iniciada, data_fim IS NOT NULL AS encerrada FROM public.ordem_coleta WHERE id=${id}`;
    expect(persistida).toMatchObject({status:'CONCLUIDA', motorista_id: motoristas[0], veiculo_id: veiculo, km_inicial:100, km_final:115, iniciada:true, encerrada:true});
    await page.goto('/svo/ordens/9223372036854775807');
    await expect(page.getByRole('alert')).toBeVisible();
    const final = resposta(page, '/api/svo/dashboard');
    await page.goto('/svo/dashboard');
    const depois = (await (await final).json()).indicadores;
    expect(depois).toEqual({...antes, confirmadasSvo: antes.confirmadasSvo + 1, encaminhadasIml: antes.encaminhadasIml + 1, ordensColeta: antes.ordensColeta + 1});
    await expect(page.getByRole('article').filter({hasText:'Confirmadas SVO'}).locator('strong')).toHaveText(String(depois.confirmadasSvo));
    const [totais] = await sql`WITH dia AS (SELECT timezone('America/Maceio',CURRENT_TIMESTAMP)::date AS d)
      SELECT (SELECT count(*)::int FROM public.solicitacao_obito WHERE status_triagem='AGUARDANDO_TRIAGEM') AS "aguardandoTriagem",
      count(*) FILTER (WHERE status_triagem='CONFIRMADA_SVO')::int AS "confirmadasSvo",
      count(*) FILTER (WHERE status_triagem='ENCAMINHADA_IML')::int AS "encaminhadasIml",
      count(oc.id) FILTER (WHERE status_triagem='CONFIRMADA_SVO')::int AS "ordensColeta"
      FROM public.solicitacao_obito s LEFT JOIN public.ordem_coleta oc ON oc.solicitacao_obito_id=s.id
      CROSS JOIN dia WHERE s.triado_em>=dia.d AND s.triado_em<dia.d+1`;
    expect(depois).toEqual(totais);
    evidencia.dashboard = { antes, depois, postgresql:totais };
    evidencia.postgresql = { id, persistida, historico: banco };
    expect(erros).toEqual([]);
    const rotasAtendimento = [
      ['/svo/dashboard','Dashboard SVO'], ['/svo/solicitacoes','Solicitações'],
      ['/svo/solicitacoes/nova','Nova Solicitação'], ['/svo/solicitacoes/' + svo.solicitacao.id, 'Solicitações'],
      ['/svo/solicitacoes/' + svo.solicitacao.id + '/triagem','Solicitações'],
      ['/svo/ordens','Ordens de Coleta'], ['/svo/ordens/' + id,'Ordens de Coleta'],
    ];
    for (const [aba, rotas] of [[page, rotasAtendimento], [motoristaA, [['/svo/equipe/minhas-ordens','Minhas Ordens'],[execucao(id),'Minhas Ordens']]]] as const) {
      for (const [url, menu] of rotas) {
        await aba.goto(url);
        await expect(aba.locator('nav [aria-current=page]')).toHaveText(menu);
        await aba.reload();
        await expect(aba.locator('nav [aria-current=page]')).toHaveText(menu);
        await aba.goBack();
        await aba.goForward();
        await expect(aba).toHaveURL(baseURL + url);
        await expect(aba.locator('nav [aria-current=page]')).toHaveText(menu);
      }
    }
    await motoristaA.goto('/svo/equipe/minhas-ordens');
    await expect(motoristaA.getByRole('main')).toContainText('Concluída');
    offline = true;
    await context.setOffline(true);
    await motoristaA.getByRole('button', {name:'Atualizar ordens'}).press('Enter');
    await expect(motoristaA.getByRole('alert')).toContainText('conectar');
    await context.setOffline(false);
    offline = false;
    await motoristaA.getByRole('button', {name:'Tentar novamente'}).press('Enter');
    await expect(motoristaA.getByRole('main')).toContainText('Concluída');
    const esperados = new Set([
      'GET '+apiOrdens+'/minhas 403', 'GET '+apiOrdens+'/minhas/'+id+' 404',
      'GET '+apiOrdens+'/minhas/'+ordens[1]+' 404', 'GET '+apiOrdens+'/'+id+' 403',
      'GET '+apiOrdens+'/'+ordens[1]+' 403', 'PATCH '+apiOrdens+'/'+id+'/iniciar 400',
      'PATCH '+apiOrdens+'/'+id+'/iniciar 409', 'GET '+apiOrdens+'/9223372036854775807 404',
    ]);
    expect(new Set(falhasHttp)).toEqual(esperados);
    expect(erros).toEqual([]);
    expect(avisosReact).toEqual([]);
    expect(falhasDeRede).toEqual([]);
  } finally {
    await fixture.limpar();
    await writeFile(info.outputPath('fluxo-real.json'), JSON.stringify({...evidencia, capturas, falhasHttp, falhasDeRede, cancelamentosDeLeitura, externos:[...externos], avisosReact}, null, 2));
  }
});
