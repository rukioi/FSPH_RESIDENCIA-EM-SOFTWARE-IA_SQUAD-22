import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import {
  listarOrdensPendentesController,
  criarSolicitacaoController,
  despacharOrdemController,
} from './svo.controller.js';

/** Preserva autenticação e despacho operacional do SVO. */
export async function svoRoute(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const usuario = await autenticarRequisicao(request, response);

  if (!usuario) {
    return;
  }

  if (!autorizarPerfis(usuario, ['ATENDENTE_SVO'], response)) {
    return;
  }
  
if (!/^[1-9]\d*$/.test(usuario.id)) {
  jsonCompartilhado(response, 401, {
    erro: 'Identificação do usuário inválida.',
  });
  return;
}

try {
  const usuarioId = BigInt(usuario.id);

  if (usuarioId > 9223372036854775807n) {
    jsonCompartilhado(response, 401, {
      erro: 'Identificação do usuário inválida.',
    });
    return;
  }
} catch {
  jsonCompartilhado(response, 401, {
    erro: 'Identificação do usuário inválida.',
  });
  return;
}


  const url = new URL(request.url ?? '/', 'http://localhost');
  const caminho = url.pathname;

  if (
    request.method === 'GET' &&
    caminho === '/api/svo/ordens-coleta'
  ) {
    const status = url.searchParams.get('status');

    if (status !== 'AGUARDANDO_DESPACHO') {
      jsonCompartilhado(response, 400, {
        erro: 'Status inválido. Use AGUARDANDO_DESPACHO.',
      });
      return;
    }

    await listarOrdensPendentesController(response);
    return;
  }

  if (
    request.method === 'POST' &&
    caminho === '/api/svo/solicitacoes'
  ) {
    await criarSolicitacaoController(request, response, usuario.id);
    return;
  }

  
const rotaDespacho = caminho.match(
  /^\/api\/svo\/ordens-coleta\/([0-9]+)\/despachar$/
);

if (request.method === 'PATCH' && rotaDespacho) {
  const ordemId = Number(rotaDespacho[1]);

  if (!Number.isSafeInteger(ordemId) || ordemId <= 0) {
    jsonCompartilhado(response, 400, {
      erro: 'ID da ordem inválido.',
    });
    return;
  }

  await despacharOrdemController(request, response, ordemId);
  return;
}

jsonCompartilhado(response, 404, {
  erro: 'Rota não encontrada.',
});
}

