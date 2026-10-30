import { validarDadosUsuario, validarStatusUsuario } from './usuarios.service.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import bcrypt from 'bcrypt';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { criarUsuarioComAtividade, editarUsuarioComAtividade, alterarStatusComAtividade } from './usuarios.repository.js';

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
    const { email } = dados;
    const senha = dados.senha!;

    const existente = await sql`SELECT id FROM public.usuario WHERE email = ${email}`;
    if (existente.length > 0) {
      jsonCompartilhado(res, 400, { error: 'Já existe um utilizador registado com este e-mail.' });
      return;
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const novo = await criarUsuarioComAtividade(dados, senha_hash, admin.id);
    jsonCompartilhado(res, 201, novo);
    return;
  }

  const putMatch = url.pathname.match(/^\/api\/admin\/usuarios\/([0-9]+)\/?$/);
  if (req.method === 'PUT' && putMatch) {
    const usuarioId = putMatch[1];
    if (BigInt(usuarioId) > 9223372036854775807n) { jsonCompartilhado(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Identificador inválido.' } }); return; }
    const dados = validarDadosUsuario(await lerCorpoJson(req), false);
    if (!dados) { jsonCompartilhado(res, 400, { error: { code: 'ENTRADA_INVALIDA', message: 'Confira os campos informados.' } }); return; }
    const atualizado = await editarUsuarioComAtividade(usuarioId, dados,
      dados.senha ? await bcrypt.hash(dados.senha, 10) : undefined, admin.id);
    if (!atualizado) {
      jsonCompartilhado(res, 404, { error: 'Utilizador não encontrado.' });
      return;
    }

    jsonCompartilhado(res, 200, atualizado);
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
    const atualizado = await alterarStatusComAtividade(usuarioId, body.ativo, admin.id);
    if (!atualizado) { jsonCompartilhado(res, 404, { error: 'Utilizador não encontrado.' }); return; }

    jsonCompartilhado(res, 200, atualizado);
    return;
  }

  jsonCompartilhado(res, 404, { error: 'Rota não encontrada em administradores.' });
}
