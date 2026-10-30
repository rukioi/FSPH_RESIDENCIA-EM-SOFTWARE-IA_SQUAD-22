import { type IncomingMessage, type ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import { autenticarRequisicao, autorizarPerfis } from '../../security/jwt.js';

export async function auditoriaRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');
  const usuario = await autenticarRequisicao(req, res);

  if (!usuario) return;
  if (!autorizarPerfis(usuario, ['ADM'], res)) return;

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
}