import { type IncomingMessage, type ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import jwt from 'jsonwebtoken';

export async function auditoriaRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Token não fornecido.' }));
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    if (decoded.perfil !== 'ADM') {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Acesso negado.' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/admin/auditoria/logs') {
      const logs = await sql`
        SELECT l.*, u.nome as usuario_nome, u.email as usuario_email 
        FROM public.log_atividade l
        LEFT JOIN public.usuario u ON l.usuario_id = u.id
        ORDER BY l.data_hora DESC
      `;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(logs));
      return;
    }
  } catch {
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Token inválido.' }));
  }
}