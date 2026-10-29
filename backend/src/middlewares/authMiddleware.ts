import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sql } from '../config/db.js';

export interface PayloadJWT {
  id: number;
  email: string;
  perfil: 'ADM' | 'GESTOR_FROTA' | 'SOLICITANTE_INTERNO' | 'MOTORISTA' | 'ATENDENTE_SVO';
}

declare global {
  namespace Express {
    interface Request {
      user?: PayloadJWT;
    }
  }
}

export const autenticarJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso não fornecido ou inválido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key') as PayloadJWT;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expirado ou inválido.' });
  }
};

export const autorizarPerfis = (...perfisPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !perfisPermitidos.includes(req.user.perfil)) {
      return res.status(403).json({ error: 'Acesso negado. Perfil sem permissão para este recurso.' });
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