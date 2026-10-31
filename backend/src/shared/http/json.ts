import type { ServerResponse } from 'node:http';

const objeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Normaliza todos os 4xx na fronteira HTTP; preserva os códigos/campos conhecidos e remove detalhes extras. */
export function normalizarErroCliente(status: number, corpo: unknown): unknown {
  if (status < 400 || status >= 500) return corpo;
  const original = objeto(corpo) ? corpo.error : undefined;
  const mensagem = objeto(original) && typeof original.message === 'string' ? original.message
    : typeof original === 'string' ? original : objeto(corpo) && typeof corpo.erro === 'string' ? corpo.erro
    : 'Não foi possível realizar esta ação. Confira a solicitação e tente novamente.';
  const code = objeto(original) && typeof original.code === 'string' ? original.code : `HTTP_${status}`;
  const fields = objeto(original) && objeto(original.fields) && Object.values(original.fields).every(valor => typeof valor === 'string')
    ? original.fields : undefined;
  return { error: { code, message: mensagem.replace(/Utilizador/g, 'Usuário').replace(/utilizador/g, 'usuário').replace(/registado/g, 'cadastrado'), ...(fields ? { fields } : {}) } };
}

/** Serializa JSON, normaliza erros 4xx e evita escrita em resposta encerrada. */
export function enviarJson(res: ServerResponse, status: number, corpo: unknown, aoEnviar?: () => void): void {
  if (res.writableEnded || res.destroyed) return;
  if (res.headersSent) { res.destroy(); return; }
  const json = JSON.stringify(normalizarErroCliente(status, corpo));
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
