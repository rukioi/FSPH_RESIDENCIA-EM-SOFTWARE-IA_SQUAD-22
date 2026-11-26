
import { obterToken } from '../../shared/services/auth.service';
import { dataCivil, filtrosIniciais, idValido, type Filtros } from '../../shared/services/manutencoes.service';
import { estados, tipos } from './manutencoes.form';

const chaves = ['veiculoId','tipo','status','inicio','fim'] as const;

export function lerRecorte(search: string) {
  const query = new URLSearchParams(search);
  const unico = (chave: string) => query.getAll(chave).length === 1 ? query.get(chave) ?? '' : '';
  const veiculoId = unico('veiculoId'), tipo = unico('tipo'), status = unico('status');
  const inicio = unico('inicio'), fim = unico('fim'), page = unico('page');
  const filtros: Filtros = {...filtrosIniciais, veiculoId: idValido(veiculoId) ? veiculoId : '',
    tipo: Object.hasOwn(tipos,tipo) ? tipo as Filtros['tipo'] : '',
    status: Object.hasOwn(estados,status) ? status as Filtros['status'] : '',
    inicio: dataCivil.safeParse(inicio).success ? inicio : '', fim: dataCivil.safeParse(fim).success ? fim : ''};
  if (filtros.inicio && filtros.fim && filtros.inicio > filtros.fim) filtros.fim = '';
  return {filtros, pagina: /^[1-9]\d*$/.test(page) && Number.isSafeInteger(Number(page)) ? Number(page) : 1};
}

export function rotaComRecorte(path: string, filtros: Filtros, pagina: number) {
  const query = new URLSearchParams();
  for (const chave of chaves) if (filtros[chave]) query.set(chave,filtros[chave]);
  if (pagina > 1) query.set('page',String(pagina));
  return query.size ? path + '?' + query : path;
}

export type BuscaNavegacao = { manutencoes: { sessao: string; q: string } };

/** A impressão de mão única permite conferir a sessão no reload sem gravar o token no histórico. */
export async function identidadeBusca() {
  const token = obterToken();
  if (!token || !globalThis.crypto?.subtle) return null;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  if (obterToken() !== token) return null;
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
}

export function estadoBusca(sessao: string | null, q: string): BuscaNavegacao | null {
  return sessao && q.trim() ? {manutencoes:{sessao,q:q.trim().slice(0,255)}} : null;
}

export function lerBusca(state: unknown, sessao: string | null) {
  if (!sessao || !state || typeof state !== 'object' || !('manutencoes' in state)) return '';
  const m = state.manutencoes;
  return m && typeof m === 'object' && 'sessao' in m && m.sessao === sessao &&
    'q' in m && typeof m.q === 'string' && m.q.length <= 255 ? m.q.trim() : '';
}

export function sincronizarRecorte(path: string, state: BuscaNavegacao | null) {
  // Atualiza a entrada corrente sem remontar a lista a cada tecla.
  window.history.replaceState(state,'',path);
}
