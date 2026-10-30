import type { ServerResponse } from 'node:http';
import type { UsuarioAutenticado } from './jwt.js';
import { enviarErro } from '../shared/http/json.js';

/** Aplica a lista explícita existente ao perfil efetivo obtido do banco. */
export function autorizarPerfis(usuario: UsuarioAutenticado, perfisPermitidos: string[], response: ServerResponse): boolean {
  if (!perfisPermitidos.includes(usuario.perfil)) {
    enviarErro(response, 403, 'ACESSO_NEGADO', 'Acesso não permitido.');
    return false;
  }
  return true;
}
