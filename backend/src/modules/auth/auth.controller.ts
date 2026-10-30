import { registrarFalha } from '../../shared/logging/logger.js';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { sql } from '../../config/db.js';
import { criarJwt } from '../../security/jwt.js';

/** Mantém o controller Express legado com log técnico seguro. */
export const login = async (req: Request, res: Response) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const usuarios = await sql`
      SELECT * FROM public.usuario WHERE email = ${email} LIMIT 1
    `;

    const usuario = usuarios[0];

    if (!usuario) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Conta de utilizador inativa.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = await criarJwt({
      id: String(usuario.id),
      email: usuario.email,
      nome: usuario.nome,
      perfil: usuario.perfil,
    });

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil
      }
    });
  } catch (error) {
    registrarFalha(error);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
};