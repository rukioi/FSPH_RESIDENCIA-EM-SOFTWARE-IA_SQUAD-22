import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { enviarJson } from '../../shared/http/json.js';
import { tratarErroTecnico } from '../../shared/http/errors.js';
import { consultarAnexo, enviarArquivo, lerAnexo, listarAnexos, salvarAnexo } from './anexos.service.js';

/** Toda operação reutiliza sessão atual e autorização do registro no serviço. */
export async function anexosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const usuario = await autenticarRequisicao(req, res);
  if (!usuario) { req.resume(); return; }
  try {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (req.method === 'POST') {
      const { vinculo, arquivo } = await lerAnexo(req);
      enviarJson(res, 201, await salvarAnexo(usuario, vinculo, arquivo));
    } else if (url.pathname === '/api/anexos') enviarJson(res, 200, await listarAnexos(usuario, url.searchParams));
    else await enviarArquivo(res, await consultarAnexo(usuario, url.pathname.split('/').at(-1)!));
  } catch (error) { req.resume(); tratarErroTecnico(res, error); }
}
