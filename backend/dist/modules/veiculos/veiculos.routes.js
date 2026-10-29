import { listarVeiculos, criarVeiculo, atualizarVeiculo, deletarVeiculo } from './veiculos.controller.js';
export async function veiculosRoute(req, res) {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;
    if (method === 'GET' && pathname === '/api/veiculos')
        return listarVeiculos(req, res);
    if (method === 'POST' && pathname === '/api/veiculos')
        return criarVeiculo(req, res);
    const matchId = pathname.match(/^\/api\/veiculos\/([0-9]+)$/);
    if (matchId) {
        const id = matchId[1];
        if (method === 'PUT' || method === 'PATCH')
            return atualizarVeiculo(req, res, id);
        if (method === 'DELETE')
            return deletarVeiculo(req, res, id);
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code: 'NAO_ENCONTRADO', message: 'Rota de veículos não encontrada.' } }));
}
