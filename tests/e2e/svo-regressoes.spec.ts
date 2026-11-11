import { expect, test, type Page } from '@playwright/test';
import { selecionarRecurso } from './fixtures/svo-ui';

// Respostas controladas para falhas de interface; persistência é provada no E2E real separado.
async function preparar(page: Page, perfil = 'ATENDENTE_SVO') {
  const estado = { negar: 0, conflito: 0, despachada: false, atualizado: false, executada: false,
    envios: 0, consultas: [] as string[], aguardar: null as Promise<void> | null };
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture-regressao-svo'));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await page.route(url => url.pathname.startsWith('/api/'), async r => {
    const url = new URL(r.request().url()), path = url.pathname, metodo = r.request().method();
    if (metodo === 'GET') estado.consultas.push(path + url.search);
    if (path === '/api/auth/sessao') return r.fulfill({ json: { data: { id: '42', nome: 'Revisão', email: 'teste@example.invalid', perfil } } });
    if (path === '/api/notificacoes') return r.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } });
    if (path === '/api/notificacoes/sincronizar') return r.fulfill({ json: { data: { atualizadas: 0 } } });
    if (path === '/api/svo/solicitacoes/71/triagem') return r.fulfill({ status: estado.negar, json: { erro: 'Acesso à ocorrência recusado.' } });
    if (path === '/api/svo/solicitacoes/71') return r.fulfill(estado.negar
      ? { status: estado.negar, json: { erro: 'Consulta da ocorrência recusada.' } }
      : { json: { id: '71', codigo: '#SVO-71', statusTriagem: 'AGUARDANDO_TRIAGEM', criadoEm: null,
        triagemObservacoes: 'Observação sensível da fixture', triadoPorId: null, triadoEm: null,
        localFalecimento: 'Local da fixture', enderecoRemocao: 'Endereço da fixture', pontoReferencia: null,
        canalAtendimento: 'TELEFONE', solicitanteNome: 'Pessoa identificada da fixture', solicitanteParentesco: null,
        solicitanteTelefone: null, nomeFalecido: null, observacoesMedicas: 'Relato médico da fixture', ordemColeta: null } });
    if (path === '/api/svo/ordens-coleta/7/despachar') {
      estado.envios++;
      if (estado.aguardar) await estado.aguardar;
      estado.despachada = true;
      return r.fulfill(estado.conflito ? { status: estado.conflito, json: { erro: 'Ordem alterada por outra sessão.' } }
        : { json: { id: 7, motorista_id: 5, veiculo_id: 2, status: 'EM_DESLOCAMENTO' } });
    }
    if (path === '/api/svo/ordens-coleta/7/iniciar') {
      estado.executada = true;
      return r.fulfill({ json: { id: '7', status: 'EM_DESLOCAMENTO', kmInicial: 100, kmFinal: null, dataInicio: '2026-11-11T12:00:00', dataFim: null } });
    }
    const execucao = { id: '7', codigo: '#OC-7', solicitacaoCodigo: '#SVO-71', status: 'EM_DESLOCAMENTO',
      quantidadeCorpos: 1, veiculoId: '2', kmInicial: estado.executada ? 100 : null, kmFinal: null,
      enderecoRemocao: 'Endereço da fixture', dataInicio: estado.executada ? '2026-11-11T12:00:00' : null, dataFim: null };
    if (path === '/api/svo/ordens-coleta/minhas/7') return r.fulfill({ json: execucao });
    if (path === '/api/svo/ordens-coleta/minhas') return r.fulfill({ status: 503, json: { erro: 'Lista não consultada durante a execução.' } });
    if (path === '/api/svo/ordens-coleta/7') return r.fulfill({ json: { ...execucao,
      status: estado.despachada ? 'EM_DESLOCAMENTO' : 'PENDENTE_ALOCACAO', solicitacaoId: '71', statusTriagem: 'CONFIRMADA_SVO', motoristaId: estado.despachada ? '5' : null } });
    if (path === '/api/svo/recursos-disponiveis') return r.fulfill({ json: {
      motoristas: [{ id: '5', nome: 'Motorista da fixture' }],
      veiculos: [{ id: '2', placa: 'TST0001', modelo: 'S10 da fixture', ocupacao: estado.despachada ? 1 : 0, capacidade: 4, disponivel: true }],
    } });
    if (path === '/api/svo/veiculos/2/ocupacao') return r.fulfill({ json: { id: '2', placa: 'TST0001', ocupacao: estado.despachada ? 1 : 0, capacidade: 4, disponivel: true } });
    if (path.includes('/historico') || path === '/api/svo/solicitacoes/paginadas') return r.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
    if (path === '/api/svo/dashboard') return r.fulfill({ json: { periodo: 'hoje', inicio: '2026-11-11', fim: '2026-11-11',
      indicadores: { aguardandoTriagem: 0, confirmadasSvo: estado.atualizado ? 1 : 0, ordensColeta: estado.atualizado ? 1 : 0, encaminhadasIml: 0 },
      visaoGeral: { aguardandoTriagem: 0, confirmadasSvo: estado.atualizado ? 1 : 0, encaminhadasIml: 0, semClassificacao: 0 } } });
    if (path === '/api/svo/dashboard/filas') return r.fulfill({ json: { aguardandoTriagem: { total: 0, itens: [] },
      aguardandoDespacho: { total: estado.atualizado ? 1 : 0, itens: estado.atualizado ? [{ id: '7', codigo: '#OC-7', solicitacaoCodigo: '#SVO-71', quantidadeCorpos: 1 }] : [] } } });
    if (path === '/api/svo/dashboard/atividades') return r.fulfill({ json: { data: estado.atualizado ? [{ id: '1', descricao: 'Evento persistido da fixture', dataHora: '2026-11-11T12:00:00', usuarioId: '42', usuarioNome: 'Revisão' }] : [] } });
    if (path === '/api/svo/ordens-coleta') return r.fulfill({ json: estado.atualizado ? [{ id: '7', status: 'PENDENTE_ALOCACAO', solicitacao_obito_id: '71', solicitacao_codigo: '#SVO-71', nome_falecido: null, endereco_remocao: 'Endereço da fixture' }] : [] });
    if (path === '/api/svo/ordens-coleta/paginadas') return r.fulfill({ json: { data: estado.atualizado ? [{ id: '7', codigo: '#OC-7', status: 'PENDENTE_ALOCACAO', solicitacaoId: '71', solicitacaoCodigo: '#SVO-71', quantidadeCorpos: 1 }] : [], meta: { page: 1, limit: 20, total: estado.atualizado ? 1 : 0 } } });
    throw new Error('Endpoint inesperado no teste: ' + metodo + ' ' + path);
  });
  return estado;
}
async function abrir(page: Page) {
  await page.goto('/svo/ordens/7');
  await page.getByRole('button', { name: 'Preparar despacho', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Preparar despacho', exact: true });
  await selecionarRecurso(modal, 'Veículo', '2');
  await selecionarRecurso(modal, 'Motorista', '5');
  await expect(modal.getByRole('button', { name: 'Confirmar despacho', exact: true })).toBeEnabled();
  return modal;
}
for (const width of [390, 768, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const status of [403, 404]) test(`Triagem remove dados após ${status}`, async ({ page }) => {
      const estado = await preparar(page);
      await page.goto('/svo/solicitacoes/71/triagem');
      await expect(page.getByText('Pessoa identificada da fixture', { exact: true })).toBeVisible();
      await page.getByRole('radio', { name: 'SVO', exact: true }).check();
      await page.getByLabel('Quantidade de corpos (1 a 4)').fill('2');
      estado.negar = status;
      await page.getByRole('button', { name: 'Salvar andamento', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Consulta da ocorrência recusada.' })).toBeVisible();
      await expect(page.locator('main')).not.toContainText('Pessoa identificada da fixture');
      await expect(page.locator('main')).not.toContainText('Relato médico da fixture');
      await expect(page.locator('textarea')).toHaveCount(0);
      estado.negar = 0;
      await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
      await expect(page.getByLabel('Observações da triagem')).toHaveValue('Observação sensível da fixture');
      await expect(page.getByRole('radio', { name: 'SVO', exact: true })).not.toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
    for (const status of [404, 409]) test(`despacho concorrente ${status} atualiza detalhe e recursos`, async ({ page }) => {
      const estado = await preparar(page); const modal = await abrir(page);
      estado.conflito = status;
      const antes = estado.consultas.length;
      await modal.getByRole('button', { name: 'Confirmar despacho', exact: true }).click();
      await expect(modal.getByRole('alert').filter({ hasText: String(status) })).toBeVisible();
      await expect(modal.getByText('Status: Em deslocamento', { exact: true })).toBeVisible();
      await expect(modal.getByRole('button', { name: 'Confirmar despacho', exact: true })).toBeDisabled();
      await expect.poll(() => estado.consultas.slice(antes).filter(p => p === '/api/svo/ordens-coleta/7').length).toBeGreaterThanOrEqual(2);
      expect(estado.consultas.slice(antes)).toContain('/api/svo/recursos-disponiveis');
      expect(estado.consultas.slice(antes)).toContain('/api/svo/veiculos/2/ocupacao');
      await modal.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Preparar despacho', exact: true })).toHaveCount(0);
      await expect(page.locator('main')).toContainText('Em deslocamento');
      await page.reload();
      await expect(page.locator('main')).toContainText('Em deslocamento');
      expect(estado.envios).toBe(1);
    });
    test('foco fica no modal durante PATCH pendente', async ({ page }, info) => {
      const estado = await preparar(page); const modal = await abrir(page);
      let liberar!: () => void;
      estado.aguardar = new Promise<void>(resolve => { liberar = resolve; });
      try {
        await modal.getByRole('button', { name: 'Confirmar despacho', exact: true }).press('Enter');
        await expect.poll(() => estado.envios).toBe(1);
        for (const tecla of ['Tab', 'Shift+Tab', 'Tab', 'Escape']) {
          await page.keyboard.press(tecla);
          expect(await modal.evaluate(el => el.contains(document.activeElement))).toBe(true);
        }
        await page.locator('main > section a, main a').first().evaluate(el => (el as HTMLElement).focus());
        expect(await modal.evaluate(el => el.contains(document.activeElement))).toBe(true);
        await expect(modal.getByRole('button', { name: 'Confirmando...', exact: true })).toBeDisabled();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath('despacho-pendente.png'), fullPage: true });
      } finally { liberar(); }
      await expect(modal).toHaveCount(0);
      await expect(page.locator('main')).toContainText('Em deslocamento');
      await expect(page.locator('main')).toBeFocused();
      expect(estado.envios).toBe(1);
    });
    test('Atualizar dashboard renova todos os dados visíveis', async ({ page }) => {
      const estado = await preparar(page);
      await page.goto('/svo/dashboard');
      await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['0', '0', '0', '0']);
      await expect(page.getByText('Nenhuma ordem aguardando despacho.', { exact: false })).toBeVisible();
      estado.atualizado = true;
      await page.getByRole('button', { name: 'Atualizar dashboard', exact: true }).click();
      await expect(page.locator('.svo-dashboard__kpis strong')).toHaveText(['0', '1', '0', '1']);
      await expect(page.getByRole('heading', { name: 'Aguardando despacho: 1', exact: true })).toBeVisible();
      await expect(page.getByText('Evento persistido da fixture', { exact: true })).toBeVisible();
      await expect(page.locator('.svo-despacho__tabela')).toContainText('#OC-7');
      await expect(page.locator('.svo-recentes__item')).toContainText('#OC-7');
    });
    test('Limpar filtros descarta datas em edição e aplicadas', async ({ page }) => {
      const estado = await preparar(page);
      await page.goto('/svo/solicitacoes');
      for (const aplicar of [false, true]) {
        await page.getByLabel('Recebidas desde').fill('2026-11-01');
        await page.getByLabel('Recebidas até').fill('2026-11-11');
        if (aplicar) await page.getByRole('button', { name: 'Aplicar período', exact: true }).click();
        const antes = estado.consultas.length;
        await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
        await expect(page.getByLabel('Recebidas desde')).toHaveValue('');
        await expect(page.getByLabel('Recebidas até')).toHaveValue('');
        expect(new URL(page.url()).searchParams.has('inicio')).toBe(false);
        expect(new URL(page.url()).searchParams.has('fim')).toBe(false);
        await expect.poll(() => estado.consultas.slice(antes)).toContain('/api/svo/solicitacoes/paginadas?page=1&limit=20');
      }
    });
    test('Execução atualiza detalhe sem buscar lista descartada', async ({ page }) => {
      const estado = await preparar(page, 'MOTORISTA');
      await page.goto('/svo/equipe/ordens/7/execucao');
      await page.getByLabel('Quilometragem inicial').fill('100');
      await page.getByRole('button', { name: 'Iniciar execução', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Iniciar transporte', exact: true })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      expect(estado.consultas).not.toContain('/api/svo/ordens-coleta/minhas');
      await page.reload();
      await expect(page.getByRole('button', { name: 'Iniciar transporte', exact: true })).toBeVisible();
    });
  });
}
