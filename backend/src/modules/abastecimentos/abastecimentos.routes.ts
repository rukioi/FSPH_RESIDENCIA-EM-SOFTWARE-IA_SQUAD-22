import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { listarAbastecimentos, criarAbastecimento } from './abastecimentos.controller.js';

export async function abastecimentosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  if (
    pathname !== '/api/abastecimentos' ||
    (method !== 'GET' && method !== 'POST')
  ) {
    jsonCompartilhado(res, 404, {
      error: {
        code: 'NAO_ENCONTRADO',
        message: 'Rota de abastecimentos não encontrada.',
      },
    });
    return;
  }

  const usuario = await autenticarRequisicao(req, res);
  if (!usuario) return;
  if (!autorizarPerfis(usuario, ['ADM', 'GESTOR_FROTA'], res)) return;

  if (method === 'GET' && pathname === '/api/abastecimentos') {
    return listarAbastecimentos(req, res);
  }

  if (method === 'POST' && pathname === '/api/abastecimentos') {
    return criarAbastecimento(req, res);
  }

  jsonCompartilhado(res, 404, {
      error: { code: 'NAO_ENCONTRADO', message: 'Rota de abastecimentos não encontrada.' },
    });
}