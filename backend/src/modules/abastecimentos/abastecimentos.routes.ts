import type { IncomingMessage, ServerResponse } from 'node:http';
import { listarAbastecimentos, criarAbastecimento } from './abastecimentos.controller.js';

export async function abastecimentosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

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