import { validarJwt } from '../../security/jwt.js';
import { dashboardController, pendenciasController } from './dashboard.controller.js';
function enviarErro(response, status, code, message) {
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({
        error: { code, message },
    }));
}
export async function dashboardRoute(request, response) {
    const usuario = await validarJwt(request.headers.authorization);
    if (!usuario) {
        enviarErro(response, 401, 'NAO_AUTENTICADO', 'Autenticação necessária.');
        return;
    }
    if (usuario.perfil !== 'ADMINISTRADOR' &&
        usuario.perfil !== 'GESTOR_FROTA') {
        enviarErro(response, 403, 'ACESSO_NEGADO', 'Acesso não permitido.');
        return;
    }
    const caminho = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (caminho === '/api/dashboard/pendencias') {
        await pendenciasController(response);
        return;
    }
    dashboardController(response);
}
