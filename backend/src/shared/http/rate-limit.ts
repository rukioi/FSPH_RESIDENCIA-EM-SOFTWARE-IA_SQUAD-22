import type { IncomingMessage, ServerResponse } from 'node:http';
import { inteiroAmbiente } from '../../config/environment.js';
import { enviarErro } from './json.js';

/** Janela fixa por endereço de transporte; capacidade esgotada recusa origens novas até expiração. */
export function criarLimiteLogin(opcoes = {
  tentativas: inteiroAmbiente('LOGIN_RATE_LIMIT', 10, 10000),
  janelaMs: inteiroAmbiente('LOGIN_RATE_WINDOW_MS', 60000, 3600000),
  maxOrigens: inteiroAmbiente('LOGIN_RATE_MAX_ORIGINS', 10000, 100000),
}, agora = Date.now) {
  const origens = new Map<string, { quantidade: number; expira: number }>();
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const instante = agora();
    // Limpeza oportunista: nenhuma estrutura/timer cresce além de maxOrigens.
    for (const [key, item] of origens) if (item.expira <= instante) origens.delete(key);
    const origem = req.socket.remoteAddress ?? 'desconhecida';
    let item = origens.get(origem);
    if (!item && origens.size < opcoes.maxOrigens) {
      item = { quantidade: 0, expira: instante + opcoes.janelaMs };
      origens.set(origem, item);
    }
    if (!item || item.quantidade >= opcoes.tentativas) {
      let expira = item?.expira ?? instante + opcoes.janelaMs;
      if (!item) for (const entrada of origens.values()) expira = Math.min(expira, entrada.expira);
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((expira - instante) / 1000))));
      req.resume();
      enviarErro(res, 429, 'LIMITE_LOGIN', 'Muitas tentativas. Aguarde e tente novamente.');
      return false;
    }
    item.quantidade++;
    return true;
  };
}
