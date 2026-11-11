import { expect, type Locator, type Route } from '@playwright/test';

/** Opera o Select compartilhado pelo mesmo controle e opções usados no navegador. */
export async function selecionarRecurso(modal: Locator, rotulo: string, valor: string) {
  const controle = modal.getByRole('combobox', { name: rotulo, exact: true });
  await expect(controle).toBeEnabled();
  await controle.press('Enter');
  await expect(controle).toHaveAttribute('aria-expanded', 'true');
  await modal.locator(`[role="option"][data-value="${valor}"]`).click();
}

/** A caixa compartilhada veio da main; respostas controladas não são evidência de integração. */
export async function responderNotificacoesVazias(route: Route) {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/notificacoes') {
    await route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, naoLidas: 0 } } });
    return true;
  }
  if (path === '/api/notificacoes/sincronizar') {
    await route.fulfill({ json: { data: { atualizadas: 0 } } });
    return true;
  }
  return false;
}
