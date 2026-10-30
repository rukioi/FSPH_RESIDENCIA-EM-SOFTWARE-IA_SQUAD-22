import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao, autorizarPerfis } from '../../security/jwt.js';
import { listarAbastecimentos, criarAbastecimento } from './abastecimentos.controller.js';

export async function abastecimentosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  if (
    pathname !== '/api/abastecimentos' ||
    (method !== 'GET' && method !== 'POST')
  ) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: {
        code: 'NAO_ENCONTRADO',
        message: 'Rota de abastecimentos não encontrada.',
      },
    }));
    return;
  }

  const usuario = await autenticarRequisicao(req, res);
  if (!usuario) return;
  if (!autorizarPerfis(usuario, ['ADM', 'GESTOR_FROTA'], res)) return;

  if (method === 'GET' && pathname === '/api/abastecimentos') {
    return listarAbastecimentos(req, res);
  }

  if (method === 'POST' && pathname === '/api/abastecimentos') {
    return criarAbastecimento(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      error: { code: 'NAO_ENCONTRADO', message: 'Rota de abastecimentos não encontrada.' },
    })
  );
}