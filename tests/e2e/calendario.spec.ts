import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1280]) {
  test(`calendário alterna períodos e fins de semana em ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-06T12:00:00-03:00'));
    await page.route('**/api/auth/sessao', route => route.fulfill({ json: { data: { id: '1', nome: 'Gestor', email: 'gestor@example.invalid', perfil: 'GESTOR_FROTA' } } }));
    const compromisso = (id: string, dia: string, hora: string, destino: string) => ({
      id, codigo: `TRP-${id}`, codigoExibicao: `#TRP-${id}`, status: 'AGENDADA',
      origem: 'Sede', destino, finalidade: 'Visita institucional', qtdPassageiros: 2,
      motorista: { id: '1', nome: 'Ana Silva' }, veiculo: { id: '1', placa: 'ABC1234', modelo: 'Van' },
      dataHoraSaida: `2026-11-${dia}T${hora}:00-03:00`, dataHoraRetornoPrevisto: null,
    });
    await page.route('**/api/solicitacoes-viagem/agenda?*', route => route.fulfill({ json: {
      data: [compromisso('101', '06', '08:30', 'Unidade Centro'), compromisso('102', '06', '14:00', 'Hospital Regional'), compromisso('103', '10', '09:00', 'Unidade Norte')],
      meta: { page: 1, limit: 100, total: 3 },
    } }));
    await page.addInitScript(() => sessionStorage.setItem('token', 'fixture'));
    await page.goto('/gestor/calendario');
    await expect(page.getByRole('heading', { name: 'Calendário', exact: true })).toBeVisible();
    await expect(page.locator('.cal__painel')).toContainText('2 compromissos agendados');
    await expect(page.locator('.cal__painel')).toContainText('#TRP-101');
    await expect(page.locator('.cal__dia').filter({ hasText: 'Unidade Norte' })).toHaveCount(1);
    await page.getByLabel('Fins de semana').uncheck();
    await expect(page.locator('.cal__dia-semana')).toHaveCount(5);
    await page.getByRole('button', { name: 'Semana', exact: true }).click();
    await expect(page.locator('.cal__dia')).toHaveCount(5);
    await page.getByRole('button', { name: 'Dia', exact: true }).click();
    await expect(page.locator('.cal__grade')).toHaveCount(0);
    await page.getByRole('button', { name: 'Próximo dia' }).click();
    await expect(page.locator('.cal__navegacao h2')).toHaveText('09/11/2026');
    await expect(page.getByText('Nenhum compromisso agendado')).toBeVisible();
    await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await expect(page.locator('.cal__navegacao h2')).toHaveText('06/11/2026');
    await expect(page.getByLabel('Fins de semana')).toBeChecked();
    await page.getByRole('button', { name: 'Mês', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`calendario-${width}.png`), fullPage: true, animations: 'disabled' });
  });
}
