
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validarJwt } from '../../security/jwt.js';

import {
  listarVeiculos,
  criarVeiculo,
  atualizarVeiculo,
  deletarVeiculo,
} from './veiculos.controller.js';

function enviarErro(
  res: ServerResponse,
  status: number,
  code: string,
  message: string,
): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  res.end(JSON.stringify({
    error: { code, message },
  }));
}

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

  const usuario = await validarJwt(req.headers.authorization);

  if (!usuario) {
    enviarErro(
      res,
      401,
      'NAO_AUTENTICADO',
      'Autenticação necessária.',
    );
    return;
  }

  const podeGerenciar =
    usuario.perfil === 'ADMINISTRADOR' ||
    usuario.perfil === 'GESTOR_FROTA';

  const podeConsultar =
    podeGerenciar ||
    usuario.perfil === 'ATENDENTE_SVO';

  if (method === 'GET' && !podeConsultar) {
    enviarErro(
      res,
      403,
      'ACESSO_NEGADO',
      'Acesso não permitido.',
    );
    return;
  }

  if (method !== 'GET' && !podeGerenciar) {
    enviarErro(
      res,
      403,
      'ACESSO_NEGADO',
      'Acesso não permitido.',
    );
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
