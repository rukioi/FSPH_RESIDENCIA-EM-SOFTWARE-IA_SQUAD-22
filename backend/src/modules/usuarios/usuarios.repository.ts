import { sql } from '../../database/connection.js';

/** Busca somente a identidade necessária à sessão, nunca senha ou campos internos. */
export async function consultarIdentidade(id: string) {
  const [usuario] = await sql`SELECT id, nome, email, perfil, ativo FROM public.usuario WHERE id = ${id} LIMIT 1`;
  return usuario;
}
