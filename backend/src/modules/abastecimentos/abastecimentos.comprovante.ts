import { ErroHttp } from '../../shared/http/errors.js';

/** Preserva a validação legada JPEG/PNG; anexos compartilhados dependem da SCRUM-194. */
export function validarComprovanteLegado(comprovante: unknown) {
  let arquivo: { nome: string; tipo: string; dados: Buffer } | null = null;
  if (comprovante !== undefined && comprovante !== null) {
    const c = comprovante as Record<string, unknown>;
    if (typeof c !== 'object' || Array.isArray(c) || typeof c.nome !== 'string' || !c.nome.trim() ||
        c.nome.length > 255 || Array.from(c.nome).some(ch => ch === '/' || ch === '\\' || ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) ||
        (c.tipo !== 'image/png' && c.tipo !== 'image/jpeg') || typeof c.dadosBase64 !== 'string' ||
        c.dadosBase64.length > 1398104 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(c.dadosBase64)) {
      throw new ErroHttp(400, 'ARQUIVO_INVALIDO', 'Envie uma imagem JPEG ou PNG válida de até 1 MiB.');
    }
    const bytes = Buffer.from(c.dadosBase64, 'base64');
    const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (bytes.length > 1024 * 1024 || bytes.toString('base64') !== c.dadosBase64 ||
        !(c.tipo === 'image/png' ? png : jpg)) {
      throw new ErroHttp(400, 'ARQUIVO_INVALIDO', 'Envie uma imagem JPEG ou PNG válida de até 1 MiB.');
    }
    arquivo = { nome: c.nome.trim(), tipo: c.tipo, dados: bytes };
  }

  return arquivo;
}
