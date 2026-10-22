import type { IncomingMessage, ServerResponse } from 'node:http';
import { validarJwt } from '../../security/jwt.js';

/** Protege as rotas do Portal do Motorista. */
export async function motoristaRoute(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const usuario = await validarJwt(request.headers.authorization);

  if (!usuario) {
    response.writeHead(401, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({
      error: {
        code: 'NAO_AUTENTICADO',
        message: 'Autenticação necessária.',
      },
    }));
    return;
  }

  if (usuario.perfil !== 'MOTORISTA') {
    response.writeHead(403, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({
      error: {
        code: 'ACESSO_NEGADO',
        message: 'Você não tem permissão para realizar esta ação.',
      },
    }));
    return;
  }

  response.writeHead(501, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify({
    error: {
      code: 'NAO_IMPLEMENTADO',
      message: 'Consulta de viagens ainda não implementada.',
    },
  }));
}