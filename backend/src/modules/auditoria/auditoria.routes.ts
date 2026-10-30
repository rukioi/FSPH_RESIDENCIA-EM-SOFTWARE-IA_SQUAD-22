import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { enviarErro } from '../../shared/http/json.js';
import { lerPaginacaoAtividades, listarAtividades } from './auditoria.service.js';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';

/** Consulta auditoria administrativa com autorização existente. */
export async function auditoriaRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');
  if (url.pathname !== '/api/admin/auditoria/logs') {
    enviarErro(res, 404, 'NAO_ENCONTRADO', 'Rota não encontrada.');
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    enviarErro(res, 405, 'METODO_NAO_PERMITIDO', 'Método não permitido.');
    return;
  }
  const usuario = await autenticarRequisicao(req, res);

  if (!usuario) return;
  if (!autorizarPerfis(usuario, ['ADM'], res)) return;

  const paginacao = lerPaginacaoAtividades(url.searchParams);
  if (paginacao === null) {
    enviarErro(res, 400, 'ENTRADA_INVALIDA', 'Informe page e limit como inteiros positivos; limit deve ser no máximo 100.');
    return;
  }
  jsonCompartilhado(res, 200, await listarAtividades(paginacao));
}
