
import { createServer } from 'node:http';
import { dashboardRoute } from './modules/dashboard/dashboard.routes.js';
import type { DashboardDependencies } from './modules/dashboard/dashboard.service.js';

export function createApp(dependencies: DashboardDependencies = {}) {
  return createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.method === 'GET' && ['/api/dashboard', '/api/dashboard/kpis'].includes(pathname)) {
      void dashboardRoute(request, response, dependencies);
      return;
    }

    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
    });
    response.end('Não encontrado.');
  });
}
