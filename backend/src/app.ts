import { createServer } from 'node:http';
import { dashboardRoute } from './modules/dashboard/dashboard.routes.js';

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

    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end('Não encontrado.');
  });
}
