import { createServer } from 'node:http';
import { dashboardRoute } from './modules/dashboard/dashboard.routes.js';
import { svoRoute } from './modules/svo/svo.routes.js';

export function createApp() {
  return createServer((request, response) => {
    const caminho = new URL(request.url ?? '/', 'http://localhost').pathname;

    if (
      request.method === 'GET' &&
      (caminho === '/api/dashboard' || caminho === '/api/dashboard/pendencias')
    ) {
      void dashboardRoute(request, response);
      return;
    }

    if (request.method === 'GET' && caminho === '/api/svo/ordens-coleta') {
      void svoRoute(request, response);
      return;
    }

    if (request.method === 'POST' && caminho === '/api/svo/solicitacoes') {
      void svoRoute(request, response);
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/svo\/ordens-coleta\/[0-9]+\/despachar$/.test(caminho)
    ) {
      void svoRoute(request, response);
      return;
    }

    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end('Não encontrado.');
  });
}
