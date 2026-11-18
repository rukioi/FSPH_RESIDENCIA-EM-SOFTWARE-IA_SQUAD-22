import { vencimentosRf46 } from '../documentos/documentos.rf46.js';
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

/** Insere atribuição tipada com destinatário ativo e chave única da viagem e motorista. */
export async function inserirAtribuicaoViagem(tx:postgres.TransactionSql,viagemId:string):Promise<boolean> {
  const rows=await tx`INSERT INTO public.notificacao (usuario_id,chave,titulo,descricao,categoria,tipo,viagem_id)
    SELECT u.id,'viagem:'||v.id::text||':atribuicao:'||m.id::text,'Nova viagem atribuída a você',
      'Solicitação #'||s.codigo,'sucesso','ATRIBUICAO',v.id
    FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id
      JOIN public.motorista m ON m.id=v.motorista_id JOIN public.usuario u ON u.id=m.usuario_id
    WHERE v.id=${viagemId} AND u.ativo=true AND v.status='AGENDADA' AND s.status='AGENDADA'
      AND s.motorista_id=v.motorista_id AND s.veiculo_id=v.veiculo_id
    ON CONFLICT (usuario_id,chave) DO UPDATE SET titulo=EXCLUDED.titulo,lida_em=NULL
      WHERE public.notificacao.titulo='Atribui\u00e7\u00e3o encerrada' RETURNING id`;
  return rows.length>0;
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
    const rows = await tx`
      INSERT INTO public.notificacao (usuario_id, chave, titulo, descricao, categoria)
      SELECT ${usuarioId},
        CASE WHEN tipo = 'CNH_MOTORISTA' THEN 'cnh:' ELSE 'documento:' END
          || id || ':' || validade || ':' ||
          CASE WHEN fase = 'VENCIDO' THEN
            CASE WHEN tipo = 'CNH_MOTORISTA' THEN 'vencida' ELSE 'vencido' END
          ELSE lower(fase) END,
        left(CASE WHEN tipo = 'CNH_MOTORISTA' THEN 'CNH' ELSE 'Documento ' || descricao END ||
          CASE fase WHEN 'VENCIDO' THEN ' — validade expirada'
            WHEN 'HOJE' THEN ' — vence hoje'
            WHEN 'SEMANA' THEN ' — última semana'
            ELSE ' — último mês' END ||
          coalesce(' — ' || responsavel, ''), 200),
        'Validade em ' || to_char(validade,'DD/MM/YYYY'),
        CASE WHEN fase IN ('VENCIDO', 'HOJE') THEN 'urgente' ELSE 'atencao' END
      FROM (${vencimentosRf46(tx)}) alertas
      ORDER BY tipo, id
      ON CONFLICT (usuario_id, chave) DO NOTHING
      RETURNING id`;
    return rows.length;
  });
}
