import { validarJwt } from '../../security/jwt.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  buscarPendenciasDocumentos,
  criarDocumento,
} from './documentos.controller.js';

/** Gerencia as rotas de documentos e suas pendências. */
export async function documentosRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
    const usuario = await validarJwt(req.headers.authorization);

  if (!usuario) {
    res.writeHead(401, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify({
      error: {
        code: 'NAO_AUTENTICADO',
        message: 'Autenticação necessária.',
      },
    }));
    return;
  }

  if (
    usuario.perfil !== 'ADMINISTRADOR' &&
    usuario.perfil !== 'GESTOR_FROTA'
  ) {
    res.writeHead(403, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify({
      error: {
        code: 'ACESSO_NEGADO',
        message: 'Acesso não permitido.',
      },
    }));
    return;
  }
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

  // Preserva as rotas GET implementadas pelo Gabriel.
  if (
    method === 'GET' &&
    (
      pathname === '/api/documentos/pendencias' ||
      pathname === '/api/documentos'
    )
  ) {
    await buscarPendenciasDocumentos(res);
    return;
  }

  res.writeHead(404, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(
    JSON.stringify({
      error: {
        code: 'NAO_ENCONTRADO',
        message: 'Rota de documentos não encontrada.',
      },
    }),
  );
}
