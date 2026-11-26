import { enviarErro } from '../../shared/http/json.js';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';

import {
  listarMotoristas,
  criarMotorista,
  atualizarMotorista,
  deletarMotorista,
} from './motoristas.controller.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarJson } from '../../shared/http/json.js';
import { tratarErroTecnico } from '../../shared/http/errors.js';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import {
  cancelarPeriodo, listarPeriodos, listarTransicoes, registrarPeriodo, registrarTransicao,
} from './motoristas.disponibilidade.service.js';

const DISPONIBILIDADE = /^\/api\/motoristas\/([0-9]+)\/(escalas|impedimentos|transicoes|inativacao|reativacao)(?:\/([0-9]+)\/cancelamento)?$/;

/** SCRUM-239: escala, impedimento e transição profissional; somente ADM/GESTOR_FROTA. */
async function disponibilidadeRoute(req: IncomingMessage, res: ServerResponse, usuario: UsuarioAutenticado,
  partes: RegExpMatchArray): Promise<void> {
  const [, motoristaId, recurso, registroId] = partes;
  const params = new URL(req.url ?? '', 'http://localhost').searchParams;
  try {
    if (recurso === 'escalas' || recurso === 'impedimentos') {
      if (registroId) enviarJson(res, 200, await cancelarPeriodo(recurso, usuario, motoristaId, registroId, await lerCorpoJson(req)));
      else if (req.method === 'POST') enviarJson(res, 201, await registrarPeriodo(recurso, usuario, motoristaId, await lerCorpoJson(req)));
      else enviarJson(res, 200, await listarPeriodos(recurso, motoristaId, params));
      return;
    }
    if (recurso === 'transicoes') { enviarJson(res, 200, await listarTransicoes(motoristaId, params)); return; }
    enviarJson(res, 201, await registrarTransicao(recurso === 'inativacao' ? 'INATIVACAO' : 'REATIVACAO', usuario, motoristaId, await lerCorpoJson(req)));
  } catch (erro) {
    req.resume();
    tratarErroTecnico(res, erro);
  }
}



/** Aplica autenticação e permissões às rotas de motoristas. */
export async function motoristasRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(
    req.url ?? '',
    `http://${req.headers.host ?? 'localhost'}`,
  );

  const pathname = url.pathname;
  const method = req.method;

  const matchId = pathname.match(/^\/api\/motoristas\/([0-9]+)$/);
  const matchDisponibilidade = pathname.match(DISPONIBILIDADE);
  const metodoDisponibilidade = matchDisponibilidade === null ? null
    : matchDisponibilidade[3] !== undefined || ['inativacao', 'reativacao'].includes(matchDisponibilidade[2]) ? 'POST'
      : matchDisponibilidade[2] === 'transicoes' ? 'GET' : method === 'POST' ? 'POST' : 'GET';

  const rotaConhecida =
    (pathname === '/api/motoristas' &&
      (method === 'GET' || method === 'POST')) ||
    (matchId !== null &&
      (method === 'PUT' ||
        method === 'PATCH' ||
        method === 'DELETE')) ||
    (matchDisponibilidade !== null && method === metodoDisponibilidade &&
      (matchDisponibilidade[3] === undefined || ['escalas', 'impedimentos'].includes(matchDisponibilidade[2])));

  if (!rotaConhecida) {
    enviarErro(
      res,
      404,
      'NAO_ENCONTRADO',
      'Rota de motoristas não encontrada.',
    );
    return;
  }

  const usuario = await autenticarRequisicao(req, res);

  if (!usuario) {
    return;
  }

  const perfisPermitidos = matchDisponibilidade
    ? ['ADM', 'GESTOR_FROTA']
    : method === 'GET'
    ? ['ADM', 'GESTOR_FROTA', 'ATENDENTE_SVO']
    : ['ADM', 'GESTOR_FROTA'];

  if (!autorizarPerfis(usuario, perfisPermitidos, res)) {
    return;
  }

  if (matchDisponibilidade) {
    await disponibilidadeRoute(req, res, usuario, matchDisponibilidade);
    return;
  }

  if (method === 'GET') {
  await listarMotoristas(req, res, usuario.perfil);
  return;
}

  if (method === 'POST') {
    await criarMotorista(req, res, usuario.id);
    return;
  }

  if (matchId) {
    const id = matchId[1];

    if (method === 'PUT' || method === 'PATCH') {
      await atualizarMotorista(req, res, id, usuario.id);
      return;
    }

    if (method === 'DELETE') {
      await deletarMotorista(req, res, id);
      return;
    }
  }
}
