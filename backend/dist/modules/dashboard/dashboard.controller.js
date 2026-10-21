import { buscarPendencias } from './dashboard.pendencias.js';
export function dashboardController(response) {
    response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({
        data: {},
    }));
}
export async function pendenciasController(response) {
    try {
        const pendencias = await buscarPendencias();
        response.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
            data: pendencias,
        }));
    }
    catch (erro) {
        console.error('Erro ao buscar pendências:', erro);
        response.writeHead(500, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
            error: {
                code: 'ERRO_INTERNO',
                message: 'Não foi possível consultar as pendências.',
            },
        }));
    }
}
