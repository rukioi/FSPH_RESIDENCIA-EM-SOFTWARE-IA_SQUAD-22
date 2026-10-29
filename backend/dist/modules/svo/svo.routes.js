import { validarJwt } from '../../security/jwt.js';
import { listarOrdensPendentesController, criarSolicitacaoController, despacharOrdemController, } from './svo.controller.js';
export async function svoRoute(request, response) {
    const usuario = await validarJwt(request.headers.authorization);
    if (!usuario) {
        response.writeHead(401, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
            erro: 'Você precisa estar logado.',
        }));
        return;
    }
    if (usuario.perfil !== 'ATENDENTE_SVO') {
        response.writeHead(403, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
            erro: 'Você não tem permissão para realizar esta ação.',
        }));
        return;
    }
    if (!/^[1-9]\d*$/.test(usuario.id)) {
        response.writeHead(401, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
            erro: 'Identificação do usuário inválida.',
        }));
        return;
    }
    try {
        const usuarioId = BigInt(usuario.id);
        if (usuarioId > 9223372036854775807n) {
            response.writeHead(401, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(JSON.stringify({
                erro: 'Identificação do usuário inválida.',
            }));
            return;
        }
    }
    catch {
        response.writeHead(401, {
            'Content-Type': 'application/json; charset=utf-8',
        });
        response.end(JSON.stringify({
            erro: 'Identificação do usuário inválida.',
        }));
        return;
    }
    const url = new URL(request.url ?? '/', 'http://localhost');
    const caminho = url.pathname;
    if (request.method === 'GET' &&
        caminho === '/api/svo/ordens-coleta') {
        const status = url.searchParams.get('status');
        if (status !== 'AGUARDANDO_DESPACHO') {
            response.writeHead(400, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(JSON.stringify({
                erro: 'Status inválido. Use AGUARDANDO_DESPACHO.',
            }));
            return;
        }
        await listarOrdensPendentesController(response);
        return;
    }
    if (request.method === 'POST' &&
        caminho === '/api/svo/solicitacoes') {
        await criarSolicitacaoController(request, response, usuario.id);
        return;
    }
    const rotaDespacho = caminho.match(/^\/api\/svo\/ordens-coleta\/([0-9]+)\/despachar$/);
    if (request.method === 'PATCH' && rotaDespacho) {
        const ordemId = Number(rotaDespacho[1]);
        if (!Number.isSafeInteger(ordemId) || ordemId <= 0) {
            response.writeHead(400, {
                'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(JSON.stringify({
                erro: 'ID da ordem inválido.',
            }));
            return;
        }
        await despacharOrdemController(request, response, ordemId);
        return;
    }
    response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({
        erro: 'Rota não encontrada.',
    }));
}
