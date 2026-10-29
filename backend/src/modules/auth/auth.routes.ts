import { type IncomingMessage, type ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function authRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const { email, senha } = JSON.parse(body);

      if (!email || !senha) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'E-mail e senha são obrigatórios.' }));
        return;
      }

      const usuarios = await sql`
        SELECT * FROM public.usuario WHERE email = ${email} LIMIT 1
      `;
      const usuario = usuarios[0];

      if (!usuario || !usuario.ativo) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Credenciais inválidas ou utilizador inativo.' }));
        return;
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
      if (!senhaValida) {
        res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Credenciais inválidas.' }));
        return;
      }

      const token = jwt.sign(
        { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
        process.env.JWT_SECRET || 'secret_key',
        { expiresIn: '8h' }
      );

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil
        }
      }));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Erro interno ao realizar login.' }));
    }
  }
}