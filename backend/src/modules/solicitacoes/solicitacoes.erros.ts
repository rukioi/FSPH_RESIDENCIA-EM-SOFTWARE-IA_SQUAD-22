import { ErroHttp } from '../../shared/http/errors.js';

/** Traduz datas de entrada recusadas pelo PostgreSQL e preserva as demais falhas. */
export async function comValidacaoTemporal<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    const code = typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
    if (code === '22007' || code === '22008') {
      throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe uma data/hora suportada pelo PostgreSQL.');
    }
    throw erro;
  }
}
