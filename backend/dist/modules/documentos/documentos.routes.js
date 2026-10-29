import { buscarPendenciasDocumentos } from './documentos.controller.js';
export async function documentosRoute(req, res) {
    const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method;
    if (method === 'GET' && (pathname === '/api/documentos/pendencias' || pathname === '/api/documentos')) {
        return buscarPendenciasDocumentos(res);
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: { code: 'NAO_ENCONTRADO', message: 'Rota de documentos não encontrada.' } }));
}
