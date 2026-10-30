import type { IncomingMessage } from 'node:http';

export type CodigoErroCorpo = 'CORPO_MUITO_GRANDE' | 'CONEXAO_INTERROMPIDA' | 'JSON_INVALIDO' | 'ERRO_LEITURA' | 'TIPO_NAO_SUPORTADO';
/** Falha técnica classificada antes de acessar regras ou banco. */
export class ErroCorpoRequisicao extends Error {
  constructor(readonly codigo: CodigoErroCorpo) { super(codigo); this.name = 'ErroCorpoRequisicao'; }
}

/** Lê bytes com memória limitada. Não destrói o socket antes de o 413 ser enviado. */
export async function lerStream(request: IncomingMessage, limite = 64 * 1024): Promise<Buffer> {
  const partes: Buffer[] = [];
  let total = 0;
  request.on('error', () => {});
  try {
    // destroyOnReturn=false preserva a resposta quando o limite é excedido.
    const stream = typeof request.iterator === 'function'
      ? request.iterator({ destroyOnReturn: false }) : request;
    for await (const parte of stream) {
      if (request.aborted) throw new ErroCorpoRequisicao('CONEXAO_INTERROMPIDA');
      if (!Buffer.isBuffer(parte) && !(parte instanceof Uint8Array) && typeof parte !== 'string') {
        throw new ErroCorpoRequisicao('ERRO_LEITURA');
      }
      const buffer = Buffer.from(parte);
      if (buffer.length > limite - total) {
        request.resume?.();
        throw new ErroCorpoRequisicao('CORPO_MUITO_GRANDE');
      }
      total += buffer.length;
      partes.push(buffer);
    }
    if (request.aborted) throw new ErroCorpoRequisicao('CONEXAO_INTERROMPIDA');
  } catch (erro) {
    if (erro instanceof ErroCorpoRequisicao) throw erro;
    const code = typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
    throw new ErroCorpoRequisicao(request.aborted || ['ECONNRESET', 'EPIPE', 'ERR_STREAM_PREMATURE_CLOSE'].includes(String(code))
      ? 'CONEXAO_INTERROMPIDA' : 'ERRO_LEITURA');
  }
  return Buffer.concat(partes);
}

/** Aceita JSON; ausência de Content-Type é tolerada por compatibilidade com clientes antigos. */
export async function lerCorpoJson(request: IncomingMessage, limite = 64 * 1024): Promise<unknown> {
  const tipo = request.headers?.['content-type']?.split(';')[0].trim().toLowerCase();
  if (tipo && tipo !== 'application/json') {
    request.resume?.();
    throw new ErroCorpoRequisicao('TIPO_NAO_SUPORTADO');
  }
  const buffer = await lerStream(request, limite);
  try { return JSON.parse(buffer.toString('utf8')); }
  catch { throw new ErroCorpoRequisicao('JSON_INVALIDO'); }
}
