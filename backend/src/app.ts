import { createServer, type ServerResponse } from 'node:http';
import { dashboardRoute } from './modules/dashboard/dashboard.routes.js';
import { svoRoute } from './modules/svo/svo.routes.js';
import { veiculosRoute } from './modules/veiculos/veiculos.routes.js';
import { motoristasRoute } from './modules/motoristas/motoristas.routes.js';
import { abastecimentosRoute } from './modules/abastecimentos/abastecimentos.routes.js';
import { documentosRoute } from './modules/documentos/documentos.routes.js';
import { authRoute } from './modules/auth/auth.routes.js';
import { usuariosRoute } from './modules/usuarios/usuarios.routes.js';
import { auditoriaRoute } from './modules/auditoria/auditoria.routes.js';

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
    const caminho = new URL(request.url ?? '', 'http://localhost').pathname;

    if (caminho.startsWith('/api/auth')) {
      isolarFalhaDaRequisicao(response, authRoute(request, response));
      return;
    }

    if (caminho.startsWith('/api/admin/usuarios')) {
      isolarFalhaDaRequisicao(response, usuariosRoute(request, response));
      return;
    }

    if (caminho.startsWith('/api/admin/auditoria')) {
      isolarFalhaDaRequisicao(response, auditoriaRoute(request, response));
      return;
    }

    if (
      caminho === '/api/dashboard' ||
      caminho === '/api/dashboard/pendencias' ||
      caminho === '/api/dashboard/graficos' ||
      caminho === '/api/dashboard/gestor'
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
    
    if (caminho.startsWith('/api/veiculos')) {
      isolarFalhaDaRequisicao(response, veiculosRoute(request, response));
      return;
    }

    if (caminho.startsWith('/api/motoristas')) {
      isolarFalhaDaRequisicao(response, motoristasRoute(request, response));
      return;
    }

    if (caminho.startsWith('/api/abastecimentos')) {
      isolarFalhaDaRequisicao(response, abastecimentosRoute(request, response));
      return;
    }

    if (caminho.startsWith('/api/documentos')) {
      isolarFalhaDaRequisicao(response, documentosRoute(request, response));
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