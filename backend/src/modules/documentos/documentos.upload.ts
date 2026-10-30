import Busboy from 'busboy';
import type { IncomingMessage } from 'node:http';
import { ErroCorpoRequisicao, lerStream } from '../../shared/http/body.js';

const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];

export interface ArquivoDocumento { nome: string; tipo: string; conteudo: Buffer }
export interface DadosUpload { campos: Record<string, string>; arquivo: ArquivoDocumento }

/** Limita stream total, arquivo (5 MiB), partes (11), campos (10 × 4 KiB) e aborto antes do parser. */
export async function receberUpload(req: IncomingMessage): Promise<DadosUpload> {
  const corpo = await lerStream(req, TAMANHO_MAXIMO + 64 * 1024);
  return new Promise((resolve, reject) => {
    const campos: Record<string, string> = Object.create(null);
    const partes: Buffer[] = [];
    let nome = '';
    let tipo = '';
    let recebido = false;
    let invalido = false;
    let excedido = false;
    let tamanhoArquivo = 0;
    let parser: ReturnType<typeof Busboy>;
    try {
      parser = Busboy({ headers: req.headers, limits: {
        fileSize: TAMANHO_MAXIMO + 1, files: 1, fields: 10, parts: 12,
        fieldSize: 4097, fieldNameSize: 100,
      } });
    } catch { reject(new Error('UPLOAD_INVALIDO')); return; }
    parser.on('field', (chave, valor, info) => {
      if (info.valueTruncated || info.nameTruncated || chave.length > 100 || Buffer.byteLength(valor) > 4096) excedido = true;
      campos[chave] = valor;
    });
    parser.on('file', (_campo, arquivo, info) => {
      nome = info.filename ?? '';
      tipo = info.mimeType;
      if (!TIPOS_PERMITIDOS.includes(tipo)) invalido = true;
      arquivo.on('data', (parte: Buffer) => { tamanhoArquivo += parte.length; partes.push(parte); });
      arquivo.on('limit', () => { excedido = true; });
      arquivo.on('error', () => reject(new Error('UPLOAD_INVALIDO')));
      arquivo.on('end', () => { recebido = true; });
    });
    for (const evento of ['filesLimit', 'fieldsLimit', 'partsLimit'] as const) {
      parser.on(evento, () => { excedido = true; });
    }
    parser.on('error', () => reject(new Error('UPLOAD_INVALIDO')));
    parser.on('close', () => {
      if (excedido || tamanhoArquivo > TAMANHO_MAXIMO) { reject(new ErroCorpoRequisicao('CORPO_MUITO_GRANDE')); return; }
      if (!recebido || invalido || !nome) { reject(new Error('UPLOAD_INVALIDO')); return; }
      resolve({ campos, arquivo: { nome, tipo, conteudo: Buffer.concat(partes) } });
    });
    parser.end(corpo);
  });
}
