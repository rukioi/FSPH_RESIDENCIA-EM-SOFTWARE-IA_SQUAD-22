import { registrarFalha } from '../../shared/logging/logger.js';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { sql } from '../../config/db.js';

/** Lista usuários sem expor hashes no retorno do controller legado. */
export const listarUsuarios = async (req: Request, res: Response) => {
  try {
    const usuarios = await sql`
      SELECT id, nome, email, perfil, ativo, criado_em 
      FROM public.usuario 
      ORDER BY id ASC
    `;
    return res.json(usuarios);
  } catch {
    return res.status(500).json({ error: 'Erro ao listar utilizadores.' });
  }
};

/** Preserva o cadastro legado e evita expor erros brutos no log. */
export const criarUsuario = async (req: Request, res: Response) => {
  const { nome, email, senha, perfil } = req.body;

  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  try {
    const existente = await sql`
      SELECT id FROM public.usuario WHERE email = ${email} LIMIT 1
    `;

    if (existente.length > 0) {
      return res.status(400).json({ error: 'E-mail já cadastrado no sistema.' });
    }

    const senha_hash = await bcrypt.hash(senha, 10);

    const novoUsuario = await sql`
      INSERT INTO public.usuario (nome, email, senha_hash, perfil, ativo, criado_em)
      VALUES (${nome}, ${email}, ${senha_hash}, ${perfil}, TRUE, NOW())
      RETURNING id, nome, email, perfil, ativo, criado_em
    `;

    return res.status(201).json(novoUsuario[0]);
  } catch (error) {
    registrarFalha(error);
    return res.status(500).json({ error: 'Erro ao cadastrar utilizador.' });
  }
};

/** Atualiza o estado ativo solicitado e informa quando o usuário não existe. */
export const alterarStatusUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { ativo } = req.body;

  if (typeof ativo !== 'boolean') {
    return res.status(400).json({ error: 'O campo "ativo" deve ser booleano.' });
  }

  try {
    const atualizado = await sql`
      UPDATE public.usuario 
      SET ativo = ${ativo} 
      WHERE id = ${id}
      RETURNING id, nome, email, ativo
    `;

    if (atualizado.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado.' });
    }

    return res.json(atualizado[0]);
  } catch {
    return res.status(500).json({ error: 'Erro ao atualizar status do utilizador.' });
  }
};
