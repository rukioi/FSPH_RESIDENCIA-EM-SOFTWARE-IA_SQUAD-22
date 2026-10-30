import { Request, Response, NextFunction } from 'express';
import { sql } from '../config/db.js';
import { validarJwt } from '../security/jwt.js';

export interface PayloadJWT {
  id: string;
  email?: string;
  nome?: string;
  perfil: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: PayloadJWT;
  }
}

export const autenticarJWT = async (req: Request, res: Response, next: NextFunction) => {
  const usuario = await validarJwt(req.headers.authorization);

  if (!usuario) {
    return res.status(401).json({
      error: {
        code: 'NAO_AUTENTICADO',
        message: 'Autenticação necessária.',
      },
    });
  }

  req.user = usuario;
  return next();
};

export const autorizarPerfis = (...perfisPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !perfisPermitidos.includes(req.user.perfil)) {
      return res.status(403).json({
        error: {
          code: 'ACESSO_NEGADO',
          message: 'Acesso não permitido.',
        },
      });
    }
    next();
  };
};

export const registrarLogAtividade = async (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const descricao = `Ação ${req.method} executada na rota ${req.originalUrl} pelo utilizador ID ${req.user.id}`;
        
        try {
          await sql`
            INSERT INTO public.log_atividade (usuario_id, descricao, data_hora)
            VALUES (${req.user.id}, ${descricao}, NOW())
          `;
        } catch (err) {
          console.error('Erro ao registrar log de atividade:', err);
        }
      }
    });
  }
  next();
};