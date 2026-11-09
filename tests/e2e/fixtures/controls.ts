import { expect, type Locator } from '@playwright/test';

/** Escolhe pela interface pública do dropdown, conservando os valores enviados à API. */
export async function selecionarOpcao(controle: Locator, valor: string): Promise<void> {
  await controle.click();
  const lista = controle.page().getByRole('listbox').filter({ visible: true });
  await expect(lista).toBeVisible();
  const opcoes = lista.getByRole('option');
  const indice = await opcoes.evaluateAll((elementos, procurado) =>
    elementos.findIndex(elemento => elemento.getAttribute('data-value') === procurado), valor);
  expect(indice, `Opção disponível no dropdown: ${valor}`).toBeGreaterThanOrEqual(0);
  await opcoes.nth(indice).click();
  await expect(lista).toBeHidden();
}
