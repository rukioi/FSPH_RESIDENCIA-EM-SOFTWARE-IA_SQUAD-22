import { enviarErro } from '../../shared/http/json.js';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';

import {
  listarVeiculos,
  criarVeiculo,
  atualizarVeiculo,
  deletarVeiculo,
} from './veiculos.controller.js';



/** Aplica autenticação e permissões às rotas de veículos. */
export async function veiculosRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(
    req.url ?? '',
    `http://${req.headers.host ?? 'localhost'}`,
  );

  const pathname = url.pathname;
  const method = req.method;

  const matchId = pathname.match(/^\/api\/veiculos\/([0-9]+)$/);

  const rotaConhecida =
    (pathname === '/api/veiculos' &&
      (method === 'GET' || method === 'POST')) ||
    (matchId !== null &&
      (method === 'PUT' ||
        method === 'PATCH' ||
        method === 'DELETE'));

  if (!rotaConhecida) {
    enviarErro(
      res,
      404,
      'NAO_ENCONTRADO',
      'Rota de veículos não encontrada.',
    );
    return;
  }

  const usuario = await autenticarRequisicao(req, res);

  if (!usuario) {
    return;
  }

  const perfisPermitidos = method === 'GET'
    ? ['ADM', 'GESTOR_FROTA', 'ATENDENTE_SVO']
    : ['ADM', 'GESTOR_FROTA'];

  if (!autorizarPerfis(usuario, perfisPermitidos, res)) {
    return;
  }

  if (method === 'GET') {
    await listarVeiculos(req, res);
    return;
  }

  if (method === 'POST') {
    await criarVeiculo(req, res);
    return;
  }

  if (matchId) {
    const id = matchId[1];

    if (method === 'PUT' || method === 'PATCH') {
      await atualizarVeiculo(req, res, id);
      return;
    }

    if (method === 'DELETE') {
      await deletarVeiculo(req, res, id);
      return;
    }
  }
}
