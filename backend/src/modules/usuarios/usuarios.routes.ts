import { type IncomingMessage, type ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import bcrypt from 'bcrypt';
import { autenticarRequisicao, autorizarPerfis } from '../../security/jwt.js';

export async function usuariosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');
  const admin = await autenticarRequisicao(req, res);

  if (!admin) {
    return;
  }

  if (!autorizarPerfis(admin, ['ADM'], res)) return;

  if (req.method === 'GET' && url.pathname === '/api/admin/usuarios') {
    const usuarios = await sql`SELECT id, nome, email, perfil, ativo, criado_em FROM public.usuario ORDER BY id ASC`;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(usuarios));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/usuarios') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { nome, email, senha, perfil } = JSON.parse(body);

    const existente = await sql`SELECT id FROM public.usuario WHERE email = ${email}`;
    if (existente.length > 0) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Já existe um utilizador registado com este e-mail.' }));
      return;
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const novo = await sql`
      INSERT INTO public.usuario (nome, email, senha_hash, perfil, ativo, criado_em)
      VALUES (${nome}, ${email}, ${senha_hash}, ${perfil}, TRUE, NOW())
      RETURNING id, nome, email, perfil, ativo, criado_em
    `;

    await sql`
      INSERT INTO public.log_atividade (usuario_id, descricao, data_hora)
      VALUES (${admin.id}, ${`Criou o utilizador ${email}`}, NOW())
    `;

    res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(novo[0]));
    return;
  }

  const putMatch = url.pathname.match(/^\/api\/admin\/usuarios\/([0-9]+)\/?$/);
  if (req.method === 'PUT' && putMatch) {
    const usuarioId = Number(putMatch[1]);
    let body = '';
    for await (const chunk of req) body += chunk;
    const { nome, email, perfil, senha } = JSON.parse(body);

    const usuarioAtual = await sql`SELECT id FROM public.usuario WHERE id = ${usuarioId}`;
    if (usuarioAtual.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Utilizador não encontrado.' }));
      return;
    }

    let atualizado;
    if (senha) {
      const senha_hash = await bcrypt.hash(senha, 10);
      atualizado = await sql`
        UPDATE public.usuario
        SET nome = ${nome}, email = ${email}, perfil = ${perfil}, senha_hash = ${senha_hash}
        WHERE id = ${usuarioId}
        RETURNING id, nome, email, perfil, ativo, criado_em
      `;
    } else {
      atualizado = await sql`
        UPDATE public.usuario
        SET nome = ${nome}, email = ${email}, perfil = ${perfil}
        WHERE id = ${usuarioId}
        RETURNING id, nome, email, perfil, ativo, criado_em
      `;
    }

    await sql`
      INSERT INTO public.log_atividade (usuario_id, descricao, data_hora)
      VALUES (${admin.id}, ${`Atualizou os dados do utilizador ID ${usuarioId}`}, NOW())
    `;

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(atualizado[0]));
    return;
  }

  const patchMatch = url.pathname.match(/^\/api\/admin\/usuarios\/([0-9]+)\/status\/?$/);
  if (req.method === 'PATCH' && patchMatch) {
    const usuarioId = Number(patchMatch[1]);

    const usuarioAtual = await sql`SELECT ativo FROM public.usuario WHERE id = ${usuarioId}`;
    
    if (usuarioAtual.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Utilizador não encontrado.' }));
      return;
    }

    const novoStatus = !usuarioAtual[0].ativo;

    const atualizado = await sql`
      UPDATE public.usuario
      SET ativo = ${novoStatus}
      WHERE id = ${usuarioId}
      RETURNING id, nome, email, perfil, ativo
    `;

    await sql`
      INSERT INTO public.log_atividade (usuario_id, descricao, data_hora)
      VALUES (${admin.id}, ${`Alterou o status do utilizador ID ${usuarioId} para ${novoStatus ? 'Ativo' : 'Inativo'}`}, NOW())
    `;

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(atualizado[0]));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Rota não encontrada em administradores.' }));
}