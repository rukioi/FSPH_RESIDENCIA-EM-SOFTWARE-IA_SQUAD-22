import type postgres from 'postgres';
import { sql } from '../../database/connection.js';

export interface LinhaAtividade {
  id: string;
  usuario_id: string | null;
  descricao: string;
  data_hora: Date | null;
  usuario_nome: string | null;
  usuario_email: string | null;
}
export interface PaginacaoAtividades { page: number; limit: number }

/** Insere somente descrições produzidas pelo serviço na transação do módulo chamador. */
export async function inserirAtividades(tx: postgres.TransactionSql, usuarioId: string, descricoes: string[]): Promise<void> {
  await tx`INSERT INTO public.log_atividade (usuario_id, descricao)
    SELECT ${usuarioId}, unnest(${descricoes}::text[])`;
}

/** Projeta campos conhecidos e lê página/total no mesmo snapshot, sem alterar histórico. */
export async function consultarAtividades(paginacao?: PaginacaoAtividades) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const rows = await tx<LinhaAtividade[]>`SELECT l.id::text, l.usuario_id::text, l.descricao, l.data_hora,
      u.nome AS usuario_nome, u.email AS usuario_email
      FROM public.log_atividade l LEFT JOIN public.usuario u ON u.id=l.usuario_id
      ORDER BY l.data_hora DESC NULLS LAST, l.id DESC
      LIMIT ${paginacao?.limit ?? null} OFFSET ${paginacao ? (paginacao.page - 1) * paginacao.limit : 0}`;
    const [count] = await tx`SELECT count(*)::text AS total FROM public.log_atividade`;
    const total = Number(count.total);
    if (!Number.isSafeInteger(total)) throw new Error('Contagem fora do intervalo suportado.');
    return { rows, total };
  });
}
