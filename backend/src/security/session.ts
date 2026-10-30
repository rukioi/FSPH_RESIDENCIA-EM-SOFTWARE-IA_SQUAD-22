import type { IncomingMessage, ServerResponse } from 'node:http';
import { consultarIdentidade } from '../modules/usuarios/usuarios.repository.js';
import { validarJwt, perfilPersistidoValido, type UsuarioAutenticado } from './jwt.js';
import { enviarErro } from '../shared/http/json.js';

/** Consulta identidade mínima atual, sem hash, em toda requisição protegida. */
export async function buscarSessao(authorization: string | undefined): Promise<UsuarioAutenticado | null> {
  const token = await validarJwt(authorization);
  if (!token || !/^-?[0-9]+$/.test(token.id) || token.id.length > 20) return null;
  const id = BigInt(token.id);
  if (id < -9223372036854775808n || id > 9223372036854775807n) return null;
  const usuario = await consultarIdentidade(token.id);
  if (!usuario || usuario.ativo !== true || !perfilPersistidoValido(usuario.perfil)) return null;
  return { id: String(usuario.id), nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
}

/** Autentica pelo JWT e pelo usuário ativo atual; falha de banco propaga como 500. */
export async function autenticarRequisicao(request: IncomingMessage, response: ServerResponse): Promise<UsuarioAutenticado | null> {
  const usuario = await buscarSessao(request.headers.authorization);
  if (!usuario) enviarErro(response, 401, 'NAO_AUTENTICADO', 'Autenticação necessária.');
  return usuario;
}
