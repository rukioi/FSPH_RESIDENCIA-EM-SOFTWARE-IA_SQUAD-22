import { autenticarRequisicao, autorizarPerfis } from '../../security/jwt.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  buscarPendenciasDocumentos,
  criarDocumento,
  listarDocumentos,
} from './documentos.controller.js';

/** Gerencia as rotas de documentos e suas pendências. */
export async function documentosRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const usuario = await autenticarRequisicao(req, res);

  if (!usuario) {
    return;
  }

  if (!autorizarPerfis(usuario, ['ADM', 'GESTOR_FROTA'], res)) return;

  const url = new URL(
    req.url ?? '',
    `http://${req.headers.host ?? 'localhost'}`,
  );

  const pathname = url.pathname;
  const method = req.method;

  // Cadastro de documentos de veículos.
  if (method === 'POST' && pathname === '/api/documentos') {
    await criarDocumento(req, res);
    return;
  }

  // Listagem completa, incluindo documentos regulares.
  if (method === 'GET' && pathname === '/api/documentos') {
    await listarDocumentos(res);
    return;
  }

  // Preserva a consulta original de pendências.
  if (
    method === 'GET' &&
    pathname === '/api/documentos/pendencias'
  ) {
    await buscarPendenciasDocumentos(res);
    return;
  }

  res.writeHead(404, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify({
    error: {
      code: 'NAO_ENCONTRADO',
      message: 'Rota de documentos não encontrada.',
    },
  }));
}