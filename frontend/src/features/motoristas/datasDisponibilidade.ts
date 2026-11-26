/** Campos locais da instituição; não dependem do fuso configurado no computador. */
export const FUSO_MOTORISTAS = 'America/Maceio';

export function instanteDoFormulario(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) {
    throw new Error('Informe a data e o horário completos.');
  }
  const iso = `${valor}:00-03:00`;
  const instante = new Date(iso);
  if (!Number.isFinite(instante.getTime()) || new Date(instante.getTime() - 3 * 3600000).toISOString().slice(0, 16) !== valor) {
    throw new Error('Informe uma data e um horário válidos.');
  }
  return iso;
}

export function validarPeriodo(inicio: string, fim: string, permiteSemFim = false) {
  const de = instanteDoFormulario(inicio);
  if (!fim && permiteSemFim) return { inicio: de, fim: null };
  const ate = instanteDoFormulario(fim);
  if (Date.parse(ate) <= Date.parse(de)) throw new Error('O término deve ser posterior ao início, considerando também a data.');
  return { inicio: de, fim: ate };
}

export function exibirInstante(valor: string | null) {
  if (valor === null) return 'Término não informado';
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_MOTORISTAS, dateStyle: 'short', timeStyle: 'short' }).format(data);
}
