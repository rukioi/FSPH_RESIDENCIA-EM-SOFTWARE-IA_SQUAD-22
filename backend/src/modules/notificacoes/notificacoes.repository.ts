import type postgres from 'postgres';
import { sql } from '../../database/connection.js';
import type { z } from 'zod';
import type { consultaNotificacoes, notificacao } from './notificacoes.schemas.js';

/** Grava na transação de origem, sem duplicar alertas estáveis de vencimento. */
export async function inserirNotificacao(tx: postgres.TransactionSql, usuarios: string[], chave: string,
  titulo: string, descricao: string, categoria: z.infer<typeof notificacao>['categoria']) {
  if (!usuarios.length) return;
  await tx`INSERT INTO public.notificacao (usuario_id,chave,titulo,descricao,categoria)
    SELECT u.id, ${chave}, ${titulo}, ${descricao}, ${categoria} FROM public.usuario u
    WHERE u.id=ANY(${usuarios}::bigint[]) AND u.ativo=true ON CONFLICT (usuario_id,chave) DO NOTHING`;
}

/** Lista e contadores compartilham snapshot; todo acesso é restrito ao destinatário atual. */
export async function consultarCaixa(usuarioId: string, consulta: z.infer<typeof consultaNotificacoes>) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const lida = consulta.filtro === 'todas' ? null : consulta.filtro === 'lidas';
    const data = await tx`SELECT id::text, titulo, descricao, categoria, criado_em AS "criadoEm", lida_em AS "lidaEm"
      FROM public.notificacao WHERE usuario_id=${usuarioId}
      AND (${lida}::boolean IS NULL OR (lida_em IS NOT NULL)=${lida})
      ORDER BY criado_em DESC,id DESC LIMIT ${consulta.limit} OFFSET ${(consulta.page-1)*consulta.limit}`;
    const [contagem] = await tx`SELECT count(*) FILTER (WHERE ${lida}::boolean IS NULL OR (lida_em IS NOT NULL)=${lida})::int AS total,
      count(*) FILTER (WHERE lida_em IS NULL)::int AS "naoLidas" FROM public.notificacao WHERE usuario_id=${usuarioId}`;
    return { data: JSON.parse(JSON.stringify(data)) as unknown, meta: { ...consulta, total: contagem.total, naoLidas: contagem.naoLidas } };
  });
}

/** Atualiza somente a caixa própria; repetir leitura preserva a primeira confirmação. */
export async function marcarLeitura(usuarioId: string, id?: string) {
  const rows = await sql`UPDATE public.notificacao SET lida_em=COALESCE(lida_em,clock_timestamp())
    WHERE usuario_id=${usuarioId} AND (${id ?? null}::bigint IS NULL OR id=${id ?? null}::bigint)
    AND (${id ?? null}::bigint IS NOT NULL OR lida_em IS NULL) RETURNING id`;
  return rows.length;
}

/** Materializa vencimentos ao abrir/atualizar a caixa; não altera estado em GET. */
export async function sincronizarVencimentos(usuarioId: string) {
  return sql.begin(async tx => {
    const [usuario] = await tx`SELECT perfil FROM public.usuario WHERE id=${usuarioId} AND ativo=true`;
    if (!usuario || !['ADM','GESTOR_FROTA'].includes(usuario.perfil)) return 0;
    const alertas = await tx`SELECT 'cnh:' || id || ':' || validade_cnh || ':' ||
        CASE WHEN validade_cnh < timezone('America/Maceio',CURRENT_TIMESTAMP)::date THEN 'vencida' ELSE 'proxima' END AS chave,
        CASE WHEN validade_cnh < timezone('America/Maceio',CURRENT_TIMESTAMP)::date THEN 'CNH vencida — ' ELSE 'CNH próxima do vencimento — ' END || nome AS titulo,
        'Validade em ' || to_char(validade_cnh,'DD/MM/YYYY') AS descricao,
        CASE WHEN validade_cnh < timezone('America/Maceio',CURRENT_TIMESTAMP)::date THEN 'urgente' ELSE 'atencao' END AS categoria
      FROM public.motorista WHERE validade_cnh <= timezone('America/Maceio',CURRENT_TIMESTAMP)::date + 30
      UNION ALL SELECT 'documento:' || d.id || ':' || d.data_vencimento || ':' ||
        CASE WHEN d.data_vencimento < timezone('America/Maceio',CURRENT_TIMESTAMP)::date THEN 'vencido' ELSE 'proximo' END,
        CASE WHEN d.data_vencimento < timezone('America/Maceio',CURRENT_TIMESTAMP)::date THEN 'Documento vencido: ' ELSE 'Documento próximo do vencimento: ' END || d.tipo_documento || ' — ' || v.placa,
        'Validade em ' || to_char(d.data_vencimento,'DD/MM/YYYY'),
        CASE WHEN d.data_vencimento < timezone('America/Maceio',CURRENT_TIMESTAMP)::date THEN 'urgente' ELSE 'atencao' END
      FROM public.documento_veiculo d JOIN public.veiculo v ON v.id=d.veiculo_id
      WHERE d.data_vencimento <= timezone('America/Maceio',CURRENT_TIMESTAMP)::date + 30`;
    let atualizadas = 0;
    for (const a of alertas) {
      const rows = await tx`INSERT INTO public.notificacao(usuario_id,chave,titulo,descricao,categoria)
        VALUES (${usuarioId},${a.chave},${a.titulo},${a.descricao},${a.categoria}) ON CONFLICT(usuario_id,chave) DO NOTHING RETURNING id`;
      atualizadas += rows.length;
    }
    return atualizadas;
  });
}
