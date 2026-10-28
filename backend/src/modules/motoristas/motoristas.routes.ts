
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validarJwt } from '../../security/jwt.js';

import {
  listarMotoristas,
  criarMotorista,
  atualizarMotorista,
  deletarMotorista,
} from './motoristas.controller.js';

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

  const rotaConhecida =
    (pathname === '/api/motoristas' &&
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
      'Rota de motoristas não encontrada.',
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
    enviarErro(res, 403, 'ACESSO_NEGADO', 'Acesso não permitido.');
    return;
  }

  if (method !== 'GET' && !podeGerenciar) {
    enviarErro(res, 403, 'ACESSO_NEGADO', 'Acesso não permitido.');
    return;
  }

  if (method === 'GET') {
    await listarMotoristas(req, res);
    return;
  }

  if (method === 'POST') {
    await criarMotorista(req, res);
    return;
  }

  if (matchId) {
    const id = matchId[1];

    if (method === 'PUT' || method === 'PATCH') {
      await atualizarMotorista(req, res, id);
      return;
    }

    if (method === 'DELETE') {
      await deletarMotorista(req, res, id);
      return;
    }
  }
}
