import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sql } from '../../config/db.js';

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

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '8h' }
    );

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
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
};