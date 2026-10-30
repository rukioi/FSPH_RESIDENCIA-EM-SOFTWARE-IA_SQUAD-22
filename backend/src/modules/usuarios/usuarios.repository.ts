import { sql } from '../../database/connection.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import type { DadosUsuario } from './usuarios.service.js';

/** Busca somente a identidade necessária à sessão, nunca senha ou campos internos. */
export async function consultarIdentidade(id: string) {
  const [usuario] = await sql`SELECT id, nome, email, perfil, ativo FROM public.usuario WHERE id = ${id} LIMIT 1`;
  return usuario;
}

/** Cria usuário e atividade juntos; falha de qualquer INSERT reverte a operação. */
export async function criarUsuarioComAtividade(dados: DadosUsuario, senhaHash: string, adminId: string) {
  return sql.begin(async tx => {
    const [usuario] = await tx`INSERT INTO public.usuario (nome, email, senha_hash, perfil, ativo, criado_em)
      VALUES (${dados.nome}, ${dados.email}, ${senhaHash}, ${dados.perfil}, TRUE, NOW())
      RETURNING id, nome, email, perfil, ativo, criado_em`;
    await registrarAtividades(tx, adminId, [{ operacao: 'usuario_criado', recursoId: String(usuario.id) }]);
    return usuario;
  });
}

/** Bloqueia o alvo e confirma edição e atividade na mesma transação, sem expor hash. */
export async function editarUsuarioComAtividade(id: string, dados: DadosUsuario, senhaHash: string | undefined, adminId: string) {
  return sql.begin(async tx => {
    const [atual] = await tx`SELECT id FROM public.usuario WHERE id=${id} FOR UPDATE`;
    if (!atual) return undefined;
    const [usuario] = senhaHash
      ? await tx`UPDATE public.usuario SET nome=${dados.nome}, email=${dados.email}, perfil=${dados.perfil}, senha_hash=${senhaHash}
          WHERE id=${id} RETURNING id, nome, email, perfil, ativo, criado_em`
      : await tx`UPDATE public.usuario SET nome=${dados.nome}, email=${dados.email}, perfil=${dados.perfil}
          WHERE id=${id} RETURNING id, nome, email, perfil, ativo, criado_em`;
    await registrarAtividades(tx, adminId, [{ operacao: 'usuario_editado', recursoId: id }]);
    return usuario;
  });
}

/** Preserva status explícito idempotente: só uma mudança efetiva produz atividade atômica. */
export async function alterarStatusComAtividade(id: string, ativo: boolean, adminId: string) {
  return sql.begin(async tx => {
    const [atual] = await tx`SELECT id, nome, email, perfil, ativo FROM public.usuario WHERE id=${id} FOR UPDATE`;
    if (!atual || atual.ativo === ativo) return atual;
    const [usuario] = await tx`UPDATE public.usuario SET ativo=${ativo} WHERE id=${id}
      RETURNING id, nome, email, perfil, ativo`;
    await registrarAtividades(tx, adminId, [{ operacao: 'usuario_status', recursoId: id, ativo }]);
    return usuario;
  });
}
