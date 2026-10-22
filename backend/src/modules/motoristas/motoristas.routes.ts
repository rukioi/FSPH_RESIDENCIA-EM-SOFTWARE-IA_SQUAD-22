import type { IncomingMessage, ServerResponse } from 'node:http';
import { listarMotoristas, criarMotorista, atualizarMotorista, deletarMotorista } from './motoristas.controller.js';

export async function motoristasRoute(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  if (method === 'GET' && pathname === '/api/motoristas') return listarMotoristas(req, res);
  if (method === 'POST' && pathname === '/api/motoristas') return criarMotorista(req, res);

  const matchId = pathname.match(/^\/api\/motoristas\/([0-9]+)$/);
  if (matchId) {
    const id = matchId[1];
    if (method === 'PUT' || method === 'PATCH') return atualizarMotorista(req, res, id);
    if (method === 'DELETE') return deletarMotorista(req, res, id);
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code: 'NAO_ENCONTRADO', message: 'Rota de motoristas não encontrada.' } }));
}