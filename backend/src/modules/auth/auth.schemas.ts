import { z } from 'zod';
import { id, perfil, dados } from '../../shared/contract/schemas.js';
const usuario = z.object({ id, nome: z.string(), email: z.string(), perfil });
export const authSchemas = {
  Credenciais: z.object({ email: z.string().min(1), senha: z.string().min(1) }),
  Login: z.object({ token: z.string(), usuario }), Sessao: dados(usuario),
};
