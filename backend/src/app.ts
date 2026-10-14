
import { createServer } from 'node:http';
import { dashboardRoute } from './modules/dashboard/dashboard.routes.js';

export function createApp() {
  return createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/api/dashboard') {
      void dashboardRoute(request, response);
      return;
    }

    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end('Não encontrado.');
  });
}
