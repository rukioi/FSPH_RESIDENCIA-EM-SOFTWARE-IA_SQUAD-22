import { z } from 'zod';
import { id, perfil, timestamp } from '../../shared/contract/schemas.js';
const usuario = z.object({ id, nome: z.string(), email: z.string(), perfil, ativo: z.boolean().nullable(), criado_em: timestamp.nullable() });
const entrada = z.strictObject({ nome: z.string().min(3).max(150), email: z.string().max(150).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/), perfil,
  senha: z.string().min(8).describe('Máximo 72 bytes UTF-8; não caracteres. Nome/email são trimados pelo serviço atual.') });
export const usuariosSchemas = { Usuario: usuario, UsuarioStatus: usuario.omit({criado_em:true}), Usuarios: z.array(usuario), CriarUsuario: entrada,
  EditarUsuario: entrada.extend({senha:entrada.shape.senha.optional()}), StatusUsuario: z.strictObject({ ativo: z.boolean() }) };
