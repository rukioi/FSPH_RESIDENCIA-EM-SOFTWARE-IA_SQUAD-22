import type { IncomingMessage, ServerResponse } from 'node:http';
import { validarJwt } from '../../security/jwt.js';
import { dashboardController, dashboardGraficosController } from './dashboard.controller.js';

function enviarErro(
  response: ServerResponse,
  status: number,
  code: string,
  message: string
): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  response.end(JSON.stringify({
    error: { code, message },
  }));
}

export async function dashboardRoute(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const usuario = await validarJwt(request.headers.authorization);

  if (!usuario) {
    enviarErro(response, 401, 'NAO_AUTENTICADO', 'Autenticação necessária.');
    return;
  }

  if (
    usuario.perfil !== 'ADMINISTRADOR' &&
    usuario.perfil !== 'GESTOR_FROTA'
  ) {
    enviarErro(response, 403, 'ACESSO_NEGADO', 'Acesso não permitido.');
    return;
  }

  const parsedUrl = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`);

  if (parsedUrl.pathname === '/api/dashboard/graficos') {
    await dashboardGraficosController(response);
    return;
  }

  dashboardController(response);
}