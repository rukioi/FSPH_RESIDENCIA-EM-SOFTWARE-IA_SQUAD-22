import { createServer } from 'node:http';
import { dashboardRoute } from './modules/dashboard/dashboard.routes.js';
import { svoRoute } from './modules/svo/svo.routes.js';
// 1. IMPORTAR OS NOVOS MÓDULOS
import { veiculosRoute } from './modules/veiculos/veiculos.routes.js';
import { motoristasRoute } from './modules/motoristas/motoristas.routes.js';
import { abastecimentosRoute } from './modules/abastecimentos/abastecimentos.routes.js';
import { documentosRoute } from './modules/documentos/documentos.routes.js';
export function isolarFalhaDaRequisicao(response, operacao) {
    operacao.catch((erro) => {
        console.error('Falha isolada na requisição:', erro);
        if (response.headersSent || response.writableEnded || response.destroyed) {
            return;
        }
        response.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
            error: {
                code: 'ERRO_INTERNO',
                message: 'Não foi possível concluir a requisição.',
            },
        }));
    });
}
export function createApp() {
    return createServer((request, response) => {
        const caminho = new URL(request.url ?? '', 'http://localhost').pathname;
        if (caminho === '/api/dashboard' ||
            caminho === '/api/dashboard/pendencias' ||
            caminho === '/api/dashboard/graficos' ||
            caminho === '/api/dashboard/gestor') {
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
        if (request.method === 'PATCH' &&
            /^\/api\/svo\/ordens-coleta\/[0-9]+\/despachar$/.test(caminho)) {
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
        response.end(JSON.stringify({
            error: {
                code: 'NAO_ENCONTRADO',
                message: 'Rota não encontrada.',
            },
        }));
    });
}
