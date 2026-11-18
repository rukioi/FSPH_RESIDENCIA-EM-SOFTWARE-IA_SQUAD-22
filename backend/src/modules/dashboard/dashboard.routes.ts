import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
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


  const caminho = new URL(
    request.url ?? '',
    `http://${request.headers.host ?? 'localhost'}`
  ).pathname;
  const perfis = caminho === '/api/dashboard' ? ['ADM','GESTOR_FROTA','ATENDENTE_SVO'] : ['ADM','GESTOR_FROTA'];
  if (!autorizarPerfis(usuario, perfis, response)) return;

  if (caminho === '/api/dashboard/graficos') {
    await dashboardGraficosController(response,new URL(request.url??'', 'http://localhost').searchParams);
    return;
  }

  if (caminho === '/api/dashboard/pendencias') {
    await pendenciasController(response);
    return;
  }

  if (caminho === '/api/dashboard/gestor') {
    await dashboardGestorController(response,new URL(request.url??'', 'http://localhost').searchParams);
    return;
  }

  await dashboardController(response,usuario.perfil,new URL(request.url??'','http://localhost').searchParams);
}