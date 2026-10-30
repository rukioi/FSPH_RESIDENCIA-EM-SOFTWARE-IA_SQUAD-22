import { randomUUID } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { contextoRequisicao } from '../logging/logger.js';

/** Gera correlação local; cabeçalhos do cliente não entram em logs nem são refletidos. */
export function comRequestId(response: ServerResponse, operacao: () => void): void {
  const requestId = randomUUID();
  response.setHeader('X-Request-Id', requestId);
  contextoRequisicao.run({ requestId }, operacao);
}
