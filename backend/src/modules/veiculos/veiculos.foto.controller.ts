import type { IncomingMessage, ServerResponse } from 'node:http';
import { lerCorpoJson } from '../../shared/http/body.js';
import { ErroHttp, responderErroCorpo, responderErroHttp } from '../../shared/http/errors.js';
import { enviarDados, enviarErro } from '../../shared/http/json.js';
import { veiculoExiste } from './veiculos.repository.js';
import { fotoVeiculoEntrada } from './veiculos.schemas.js';

const MAXIMO = 1024 * 1024;
function configuracao(id: string) {
  const raw = process.env.SUPABASE_STORAGE_URL;
  const chave = process.env.SUPABASE_STORAGE_SERVICE_KEY;
  let url: URL;
  try {
    url = new URL(raw ?? '');
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || !chave) throw new Error();
  } catch { throw new ErroHttp(503, 'FOTOS_INDISPONIVEIS', 'O armazenamento de fotos não está disponível.'); }
  return { url: `${url.origin}/storage/v1/object/veiculos-fotos/${id}`, headers: { apikey: chave!, Authorization: `Bearer ${chave!}` } };
}
function validarImagem(tipo: string, base64: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new ErroHttp(400, 'FOTO_INVALIDA', 'Envie uma imagem JPEG ou PNG válida de até 1 MB.');
  const bytes = Buffer.from(base64, 'base64');
  const jpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (!bytes.length || bytes.length > MAXIMO || !(tipo === 'image/jpeg' ? jpeg : tipo === 'image/png' && png)) throw new ErroHttp(400, 'FOTO_INVALIDA', 'Envie uma imagem JPEG ou PNG válida de até 1 MB.');
  return bytes;
}
function erro(res: ServerResponse, e: unknown) {
  if (responderErroCorpo(res, e) || responderErroHttp(res, e)) return;
  enviarErro(res, 503, 'FOTOS_INDISPONIVEIS', 'Não foi possível acessar as fotos. Tente novamente.');
}
async function verificar(id: string) {
  if (!await veiculoExiste(id)) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Veículo não encontrado.');
}
/** Recupera a foto privada após autenticação e verificação do veículo. */
export async function consultarFoto(res: ServerResponse, id: string) {
  try {
    await verificar(id);
    const { url, headers } = configuracao(id);
    const resposta = await fetch(url.replace('/object/', '/object/authenticated/'), { headers, redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (resposta.status === 404) { enviarDados(res, 200, { foto: null }); return; }
    if (!resposta.ok || Number(resposta.headers.get('content-length')) > MAXIMO) throw new Error();
    const tipo = resposta.headers.get('content-type')?.split(';')[0];
    if (!resposta.body) throw new Error();
    const leitor = resposta.body.getReader();
    const partes: Buffer[] = [];
    let tamanho = 0;
    try {
      while (true) {
        const { done, value } = await leitor.read();
        if (done) break;
        tamanho += value.byteLength;
        if (tamanho > MAXIMO) throw new Error();
        partes.push(Buffer.from(value));
      }
    } finally { await leitor.cancel().catch(() => {}); }
    const bytes = Buffer.concat(partes);
    const dadosBase64 = bytes.toString('base64');
    validarImagem(tipo ?? '', dadosBase64);
    enviarDados(res, 200, { foto: { tipo, dadosBase64 } });
  } catch (e) { erro(res, e); }
}
/** Valida e substitui a foto por meio da API privada do Storage. */
export async function salvarFoto(req: IncomingMessage, res: ServerResponse, id: string) {
  try {
    const parsed = fotoVeiculoEntrada.safeParse(await lerCorpoJson(req, 1450000));
    if (!parsed.success) throw new ErroHttp(400, 'FOTO_INVALIDA', 'Envie uma imagem JPEG ou PNG válida de até 1 MB.');
    const bytes = validarImagem(parsed.data.tipo, parsed.data.dadosBase64);
    await verificar(id);
    const { url, headers } = configuracao(id);
    const resposta = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': parsed.data.tipo, 'x-upsert': 'true', 'Cache-Control': 'no-cache' }, body: new Uint8Array(bytes), redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!resposta.ok) throw new Error();
    enviarDados(res, 200, { foto: parsed.data });
  } catch (e) { erro(res, e); }
}
