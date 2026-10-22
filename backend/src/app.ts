import { createServer, type ServerResponse } from 'node:http';
import { dashboardRoute } from './modules/dashboard/dashboard.routes.js';
import { svoRoute } from './modules/svo/svo.routes.js';

export function isolarFalhaDaRequisicao(
  response: ServerResponse,
  operacao: Promise<void>
): void {
  operacao.catch((erro: unknown) => {
    console.error('Falha isolada na requisição:', erro);

    if (response.headersSent || response.writableEnded || response.destroyed) {
      return;
    }

    response.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(
      JSON.stringify({
        error: {
          code: 'ERRO_INTERNO',
          message: 'Não foi possível concluir a requisição.',
        },
      })
    );
  });
}

export function createApp() {
  return createServer((request, response) => {
    const caminho = new URL(request.url ?? '/', 'http://localhost').pathname;

    if (
      request.method === 'GET' &&
      (caminho === '/api/dashboard' ||
        caminho === '/api/dashboard/pendencias' ||
        caminho === '/api/dashboard/graficos')
    ) {
      isolarFalhaDaRequisicao(response, dashboardRoute(request, response));
      return;
    }

    if (request.method === 'GET' && caminho === '/api/svo/ordens-coleta') {
      isolarFalhaDaRequisicao(response, svoRoute(request, response));
      return;
    }

    if (request.method === 'POST' && caminho === '/api/svo/solicitacoes') {
      isolarFalhaDaRequisicao(response, svoRoute(request, response));
      return;
    }

    if (
      request.method === 'PATCH' &&
      /^\/api\/svo\/ordens-coleta\/[0-9]+\/despachar$/.test(caminho)
    ) {
      isolarFalhaDaRequisicao(response, svoRoute(request, response));
      return;
    }

    response.writeHead(404, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(
      JSON.stringify({
        error: {
          code: 'NAO_ENCONTRADO',
          message: 'Rota não encontrada.',
        },
      })
    );
  });
}