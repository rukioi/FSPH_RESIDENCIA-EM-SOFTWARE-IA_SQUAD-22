import { lerCorpoJson } from '../../shared/http/body.js';
import { responderErroCorpo } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarJson } from '../../shared/http/json.js';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import bcrypt from 'bcrypt';
import { autenticarRequisicao, criarJwt } from '../../security/jwt.js';

/** Mantém login e sessão existentes sobre a infraestrutura HTTP compartilhada. */
export async function authRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/auth/sessao') {
    const usuario = await autenticarRequisicao(req, res);

    if (!usuario) return;

    enviarJson(res, 200, { data: usuario });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    try {
      const body = await lerCorpoJson(req);
      const { email, senha } = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;

      if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) {
        enviarJson(res, 400, {
          error: {
            code: 'ENTRADA_INVALIDA',
            message: 'E-mail e senha são obrigatórios.',
          },
        });
        return;
      }

      const usuarios = await sql`
        SELECT * FROM public.usuario WHERE email = ${email} LIMIT 1
      `;
      const usuario = usuarios[0];

      if (!usuario || !usuario.ativo) {
        enviarJson(res, 401, {
          error: {
            code: 'CREDENCIAIS_INVALIDAS',
            message: 'E-mail ou senha inválidos.',
          },
        });
        return;
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
      if (!senhaValida) {
        enviarJson(res, 401, {
          error: {
            code: 'CREDENCIAIS_INVALIDAS',
            message: 'E-mail ou senha inválidos.',
          },
        });
        return;
      }

      const token = await criarJwt({
        id: String(usuario.id),
        email: usuario.email,
        nome: usuario.nome,
        perfil: usuario.perfil,
      });

      enviarJson(res, 200, {
        token,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          perfil: usuario.perfil
        }
      });
    } catch (err) {
      if (responderErroCorpo(res, err)) return;
      registrarFalha(err);
      enviarJson(res, 500, {
        error: {
          code: 'ERRO_INTERNO',
          message: 'Não foi possível realizar o login.',
        },
      });
    }
    return;
  }

  enviarJson(res, 404, {
    error: {
      code: 'NAO_ENCONTRADO',
      message: 'Rota de autenticação não encontrada.',
    },
  });
}