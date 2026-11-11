import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1280]) {
  test(`gestor consulta e edita solicitação em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture'));
    await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: { id: '1', nome: 'Gestor', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA' } } }));
    let pedido = { id: '1', codigo: 'TRP-1', codigoExibicao: '#TRP-1', solicitante: { id: '2', nome: 'Solicitante' }, origem: 'Sede', destino: 'Unidade', finalidade: null as string | null, qtdPassageiros: null as number | null, dataHoraSaida: '2026-11-10T08:00:00-03:00', status: 'APROVADA' };
    await page.route('**/api/solicitacoes-viagem**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/historico')) return route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0 } } });
      if (route.request().method() === 'PATCH') {
        expect(route.request().postDataJSON()).toEqual({ destino: 'Hospital' });
        pedido = { ...pedido, destino: 'Hospital', status: 'PENDENTE' };
        return route.fulfill({ json: { data: pedido } });
      }
      if (url.pathname.endsWith('/1')) return route.fulfill({ json: { data: { ...pedido, motivoRejeicao: null, dataHoraRetornoPrevisto: null, motorista: null, veiculo: null } } });
      return route.fulfill({ json: { data: [pedido], meta: { page: 1, limit: 100, total: 1 } } });
    });
    await page.goto('/gestor/solicitacoes');
    await expect(page.getByText('#TRP-1')).toBeVisible();
    await page.getByLabel('Buscar').fill('Unidade');
    await page.getByRole('button', { name: 'Ver detalhes de #TRP-1' }).click();
    await expect(page.getByRole('heading', { name: 'Chamado #TRP-1' })).toBeVisible();
    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await page.getByLabel('Destino').fill('Hospital');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(page.getByRole('status')).toContainText('Alterações salvas');
    await expect(page.getByRole('status')).toContainText('pendente de análise');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`solicitacoes-edicao-${width}.png`), fullPage: true });
  });
}

test('gestor aprova e navega pelo histórico confirmado', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('token', 'fixture'));
  await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: { id: '1', nome: 'Gestor', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA' } } }));
  let status = 'PENDENTE';
  const pedido = () => ({ id: '1', codigo: 'TRP-1', codigoExibicao: '#TRP-1', solicitante: { id: '2', nome: 'Solicitante' }, origem: 'Sede', destino: 'Unidade', finalidade: 'Visita', qtdPassageiros: 2, dataHoraSaida: '2026-11-10T08:00:00-03:00', status });
  await page.route('**/api/solicitacoes-viagem**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/aprovar')) {
      status = 'APROVADA';
      return route.fulfill({ json: { data: { id: '1', status, motivoRejeicao: null } } });
    }
    if (url.pathname.endsWith('/historico')) {
      const pagina = Number(url.searchParams.get('page') || 1);
      return route.fulfill({ json: { data: [{ id: String(pagina), descricao: `Evento ${pagina}`, dataHora: '2026-11-04T10:00:00.000000', responsavel: null }], meta: { page: pagina, limit: 20, total: 21 } } });
    }
    if (url.pathname.endsWith('/1')) return route.fulfill({ json: { data: { ...pedido(), motivoRejeicao: null, dataHoraRetornoPrevisto: null, motorista: null, veiculo: null } } });
    return route.fulfill({ json: { data: [pedido()], meta: { page: 1, limit: 100, total: 1 } } });
  });
  await page.goto('/gestor/solicitacoes');
  await page.getByRole('button', { name: 'Aprovar #TRP-1' }).click();
  await expect(page.getByRole('status')).toContainText('aprovada');
  await page.getByRole('button', { name: 'Ver detalhes de #TRP-1' }).click();
  await expect(page.getByText('Evento 1')).toBeVisible();
  await expect(page.getByText('04/11/2026 10:00')).toBeVisible();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('Evento 2')).toBeVisible();
});
