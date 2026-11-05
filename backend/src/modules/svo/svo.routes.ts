import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import {
  listarOrdensPendentesController,
  criarSolicitacaoController,
  listarSolicitacoesController,
  despacharOrdemController,
  salvarTriagemParcialController,
  finalizarTriagemController,
} from './svo.controller.js';
import {
  listarSolicitacoesPaginadasController, listarOrdensPaginadasController,
  detalharSvoController, historicoSvoController,
} from './svo.consultas.controller.js';
import { dashboardSvoController, filasSvoController, atividadesSvoController } from './svo.dashboard.controller.js';
import { recursosSvoController, ocupacaoSvoController, minhasOrdensController,
  minhaOrdemController, executarOrdemController, cancelarOrdemController } from './svo.operacional.controller.js';

/** A rota aceita somente BIGINT positivo existente no intervalo do PostgreSQL. */
function idSvoValido(raw:string):boolean {
  return /^[1-9]\d{0,18}$/.test(raw) && BigInt(raw)<=9223372036854775807n;
}

/** Preserva autenticação e despacho operacional do SVO. */
export async function svoRoute(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const usuario = await autenticarRequisicao(request, response);

  if (!usuario) {
    return;
  }

  // Perfis externos ao SVO recebem 403 antes da verificação do ID interno.
  // Preserva a precedência de RBAC do contrato legado.
  if (usuario.perfil !== 'ATENDENTE_SVO' && usuario.perfil !== 'MOTORISTA') {
    autorizarPerfis(usuario, ['ATENDENTE_SVO'], response);
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

  // SCRUM-145/148: MOTORISTA só acessa ordem própria, vinculada via motorista.usuario_id.
  const propria = caminho.match(/^\/api\/svo\/ordens-coleta\/minhas\/([0-9]+)$/);
  const executar = caminho.match(/^\/api\/svo\/ordens-coleta\/([0-9]+)\/(iniciar|etapa|concluir)$/);
  if ((request.method==='GET' && (caminho==='/api/svo/ordens-coleta/minhas' || propria)) ||
      (request.method==='PATCH' && executar)) {
    if (!autorizarPerfis(usuario,['MOTORISTA'],response)) return;
    if (propria && !idSvoValido(propria[1])) {
      jsonCompartilhado(response,400,{erro:'ID SVO inválido.'});return;
    }
    if (executar && !idSvoValido(executar[1])) {
      jsonCompartilhado(response,400,{erro:'ID SVO inválido.'});return;
    }
    if (request.method==='GET') {
      if (propria) await minhaOrdemController(response,usuario.id,propria[1],url.searchParams);
      else await minhasOrdensController(response,usuario.id,url.searchParams);
    } else if (executar) {
      await executarOrdemController(request,response,usuario.id,executar[1],
        executar[2] as 'iniciar'|'etapa'|'concluir',url.searchParams);
    }
    return;
  }
  // Demais rotas continuam exclusivas do ATENDENTE_SVO; nunca ampliar o dashboard.
  if (!autorizarPerfis(usuario,['ATENDENTE_SVO'],response)) return;
  if (request.method==='GET' && caminho==='/api/svo/recursos-disponiveis') {
    await recursosSvoController(response,url.searchParams);return;
  }
  const ocupacao = caminho.match(/^\/api\/svo\/veiculos\/([0-9]+)\/ocupacao$/);
  if (request.method==='GET' && ocupacao) {
    if(!idSvoValido(ocupacao[1])) {jsonCompartilhado(response,400,{erro:'ID SVO inválido.'});return;}
    await ocupacaoSvoController(response,ocupacao[1],url.searchParams);return;
  }
  const cancelar = caminho.match(/^\/api\/svo\/ordens-coleta\/([0-9]+)\/cancelar$/);
  if (request.method==='PATCH' && cancelar) {
    if(!idSvoValido(cancelar[1])) {jsonCompartilhado(response,400,{erro:'ID SVO inválido.'});return;}
    await cancelarOrdemController(request,response,usuario.id,cancelar[1],url.searchParams);return;
  }

  // SCRUM-146: consultas ampliadas independentes, sem modificar os dois GETs legados.
  if (request.method === 'GET' && caminho === '/api/svo/solicitacoes/paginadas') {
    await listarSolicitacoesPaginadasController(response, url.searchParams);
    return;
  }
  if (request.method === 'GET' && caminho === '/api/svo/ordens-coleta/paginadas') {
    await listarOrdensPaginadasController(response, url.searchParams);
    return;
  }
  const rotaConsultaSvo = caminho.match(/^\/api\/svo\/(solicitacoes|ordens-coleta)\/([0-9]+)(\/historico)?$/);
  if (request.method === 'GET' && rotaConsultaSvo) {
    const id = rotaConsultaSvo[2];
    if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
      jsonCompartilhado(response, 400, { erro: 'ID SVO inválido.' });
      return;
    }
    const tipo = rotaConsultaSvo[1] === 'solicitacoes' ? 'solicitacao' : 'ordem';
    if (rotaConsultaSvo[3]) {
      await historicoSvoController(response, id, tipo, url.searchParams);
    } else {
      await detalharSvoController(response, id, tipo, url.searchParams);
    }
    return;
  }
  // SCRUM-149: indicadores SVO não compartilham contrato com dashboard institucional.
  if (request.method === 'GET' && caminho === '/api/svo/dashboard') {
    await dashboardSvoController(response, url.searchParams);
    return;
  }
  if (request.method === 'GET' && caminho === '/api/svo/dashboard/filas') {
    await filasSvoController(response, url.searchParams);
    return;
  }
  if (request.method === 'GET' && caminho === '/api/svo/dashboard/atividades') {
    await atividadesSvoController(response, url.searchParams);
    return;
  }


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

  if (request.method === 'GET' && caminho === '/api/svo/solicitacoes') {
    await listarSolicitacoesController(response, url.searchParams);
    return;
  }

  if (
    request.method === 'POST' &&
    caminho === '/api/svo/solicitacoes'
  ) {
    await criarSolicitacaoController(request, response, usuario.id);
    return;
  }

  
const rotaTriagem = caminho.match(/^\/api\/svo\/solicitacoes\/([0-9]+)\/triagem$/);
if (rotaTriagem && (request.method === 'PATCH' || request.method === 'POST')) {
  const id = rotaTriagem[1];
  if (!/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
    jsonCompartilhado(response, 400, { erro: 'ID da solicitação inválido.' });
    return;
  }
  if (request.method === 'PATCH') {
    await salvarTriagemParcialController(request, response, id, usuario.id);
  } else {
    await finalizarTriagemController(request, response, id, usuario.id);
  }
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

  await despacharOrdemController(request, response, ordemId, usuario.id);
  return;
}

jsonCompartilhado(response, 404, {
  erro: 'Rota não encontrada.',
});
}

