import { validarDadosUsuario, validarStatusUsuario } from './usuarios.service.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import bcrypt from 'bcrypt';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';

/** Restringe operações ao ADM atual, valida entradas e aplica status explícito idempotente. */
export async function usuariosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', 'http://localhost');
  const admin = await autenticarRequisicao(req, res);

  if (!admin) {
    return;
  }

  if (!autorizarPerfis(admin, ['ADM'], res)) return;

  if (req.method === 'GET' && url.pathname === '/api/admin/usuarios') {
    const usuarios = await sql`SELECT id, nome, email, perfil, ativo, criado_em FROM public.usuario ORDER BY id ASC`;
    jsonCompartilhado(res, 200, usuarios);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/usuarios') {
    const dados = validarDadosUsuario(await lerCorpoJson(req), true);
    if (!dados) { jsonCompartilhado(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Confira os campos informados.' } }); return; }
    const { nome, email, perfil } = dados;
    const senha = dados.senha!;

    const existente = await sql`SELECT id FROM public.usuario WHERE email = ${email}`;
    if (existente.length > 0) {
      jsonCompartilhado(res, 400, { error: 'Já existe um utilizador registado com este e-mail.' });
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

    jsonCompartilhado(res, 201, novo[0]);
    return;
  }

  const putMatch = url.pathname.match(/^\/api\/admin\/usuarios\/([0-9]+)\/?$/);
  if (req.method === 'PUT' && putMatch) {
    const usuarioId = putMatch[1];
    if (BigInt(usuarioId) > 9223372036854775807n) { jsonCompartilhado(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Identificador inválido.' } }); return; }
    const dados = validarDadosUsuario(await lerCorpoJson(req), false);
    if (!dados) { jsonCompartilhado(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Confira os campos informados.' } }); return; }
    const { nome, email, perfil, senha } = dados;

    const usuarioAtual = await sql`SELECT id FROM public.usuario WHERE id = ${usuarioId}`;
    if (usuarioAtual.length === 0) {
      jsonCompartilhado(res, 404, { error: 'Utilizador não encontrado.' });
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

    jsonCompartilhado(res, 200, atualizado[0]);
    return;
  }

  const patchMatch = url.pathname.match(/^\/api\/admin\/usuarios\/([0-9]+)\/status\/?$/);
  if (req.method === 'PATCH' && patchMatch) {
    const usuarioId = patchMatch[1];

    if (BigInt(usuarioId) > 9223372036854775807n) { jsonCompartilhado(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Identificador inválido.' } }); return; }
    const body = await lerCorpoJson(req);
    if (!validarStatusUsuario(body)) {
      jsonCompartilhado(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Informe somente ativo como booleano.' } });
      return;
    }
    const atualizado = await sql.begin(async tx => {
      const [atual] = await tx`SELECT id, nome, email, perfil, ativo FROM public.usuario WHERE id = ${usuarioId} FOR UPDATE`;
      if (!atual || atual.ativo === body.ativo) return atual;
      const [alterado] = await tx`UPDATE public.usuario SET ativo = ${body.ativo} WHERE id = ${usuarioId}
        RETURNING id, nome, email, perfil, ativo`;
      await tx`INSERT INTO public.log_atividade (usuario_id, descricao, data_hora)
        VALUES (${admin.id}, ${`Alterou o status do utilizador ID ${usuarioId} para ${body.ativo ? 'Ativo' : 'Inativo'}`}, NOW())`;
      return alterado;
    });
    if (!atualizado) { jsonCompartilhado(res, 404, { error: 'Utilizador não encontrado.' }); return; }

    jsonCompartilhado(res, 200, atualizado);
    return;
  }

  jsonCompartilhado(res, 404, { error: 'Rota não encontrada em administradores.' });
}