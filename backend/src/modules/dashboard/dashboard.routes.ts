
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validarJwt } from '../../security/jwt.js';
import { dashboardController } from './dashboard.controller.js';
import { consultarKpis, type DashboardDependencies, type Periodo } from './dashboard.service.js';

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
  response: ServerResponse,
  dependencies: DashboardDependencies = {},
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

  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/dashboard/kpis') {
    const periodos = url.searchParams.getAll('periodo');
    const periodo = periodos[0] ?? 'hoje';
    if (
      periodos.length > 1 ||
      !['hoje', '7dias', '30dias'].includes(periodo) ||
      [...url.searchParams.keys()].some((key) => key !== 'periodo')
    ) {
      enviarErro(response, 400, 'ENTRADA_INVALIDA', 'Informe um único período: hoje, 7dias ou 30dias.');
      return;
    }

    try {
      const data = await consultarKpis(periodo as Periodo, dependencies);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ data }));
    } catch {
      enviarErro(response, 500, 'ERRO_INTERNO', 'Não foi possível consultar os indicadores. Tente novamente.');
    }
    return;
  }

  dashboardController(response);
}
