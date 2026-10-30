import type { ServerResponse } from 'node:http';

/** Envia o envelope fornecido sem alterá-lo e evita escrita em resposta encerrada. */
export function enviarJson(res: ServerResponse, status: number, corpo: unknown, aoEnviar?: () => void): void {
  if (res.writableEnded || res.destroyed) return;
  if (res.headersSent) { res.destroy(); return; }
  const json = JSON.stringify(corpo);
  if (status === 413 || status === 415) {
    res.shouldKeepAlive = false;
    res.once?.('finish', () => { res.req?.destroy(); });
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  if (aoEnviar) res.end(json, aoEnviar);
  else res.end(json);
}

/** Adaptador dos módulos que já respondem com data. */
export function enviarDados(res: ServerResponse, status: number, data: unknown): void {
  enviarJson(res, status, { data });
}

/** Envia o envelope técnico comum. */
export function enviarErro(res: ServerResponse, status: number, code: string, message: string): void {
  enviarJson(res, status, { error: { code, message } });
}
