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

import { enviarErro } from './shared/http/json.js';
import { tratarErroTecnico } from './shared/http/errors.js';
import { comRequestId } from './shared/http/request-id.js';
import { criarLimiteLogin } from './shared/http/rate-limit.js';
import { operations, routePattern } from './shared/contract/registry.js';

/** Contém rejeições da rota e encerra respostas parcialmente enviadas. */
export function isolarFalhaDaRequisicao(response: ServerResponse, operacao: Promise<void>): void {
  void operacao.catch((erro: unknown) => tratarErroTecnico(response, erro));
}

const handlers = { auth: authRoute, usuarios: usuariosRoute, auditoria: auditoriaRoute,
  dashboard: dashboardRoute, svo: svoRoute, veiculos: veiculosRoute, motoristas: motoristasRoute,
  abastecimentos: abastecimentosRoute, documentos: documentosRoute };
const rotas = operations.map(operation => ({ path: routePattern(operation),
  methods: operations.filter(item => item.path === operation.path).map(item => item.method.toUpperCase()),
  handler: handlers[operation.modulo] }));

/** Despacha somente caminhos/métodos conhecidos; regras de acesso continuam nos módulos. */
export function createApp() {
  const permitirLogin = criarLimiteLogin();
  return createServer((request, response) => {
    comRequestId(response, () => {
      isolarFalhaDaRequisicao(response, (async () => {
        const caminho = new URL(request.url ?? '', 'http://localhost').pathname;
        const rota = rotas.find(item => item.path.test(caminho));
        if (!rota) {
          request.resume();
          enviarErro(response, 404, 'NAO_ENCONTRADO', 'Rota não encontrada.');
          return;
        }
        if (!rota.methods.includes(request.method ?? '')) {
          request.resume();
          response.setHeader('Allow', rota.methods.join(', '));
          enviarErro(response, 405, 'METODO_NAO_PERMITIDO', 'Método não permitido.');
          return;
        }
        if (caminho === '/api/auth/login' && !permitirLogin(request, response)) return;
        await rota.handler(request, response);
      })());
    });
  });
}
