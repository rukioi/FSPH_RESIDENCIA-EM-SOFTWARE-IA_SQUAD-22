import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao, autorizarPerfis } from '../../security/jwt.js';
import {
  dashboardController,
  dashboardGraficosController,
  pendenciasController,
  dashboardGestorController,
} from './dashboard.controller.js';

/** Autoriza as consultas do dashboard; o dispatcher restringe os métodos. */
export async function dashboardRoute(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const usuario = await autenticarRequisicao(request, response);

  if (!usuario) {
    return;
  }

  if (!autorizarPerfis(usuario, ['ADM', 'GESTOR_FROTA'], response)) return;

  const caminho = new URL(
    request.url ?? '',
    `http://${request.headers.host ?? 'localhost'}`
  ).pathname;

  if (caminho === '/api/dashboard/graficos') {
    await dashboardGraficosController(response);
    return;
  }

  if (caminho === '/api/dashboard/pendencias') {
    await pendenciasController(response);
    return;
  }

  if (caminho === '/api/dashboard/gestor') {
    await dashboardGestorController(response);
    return;
  }

  dashboardController(response);
}