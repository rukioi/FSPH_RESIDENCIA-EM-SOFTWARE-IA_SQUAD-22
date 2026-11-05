import { sql } from '../../database/connection.js';
import type { z } from 'zod';
import { periodoDashboardSvo } from './svo.dashboard.schemas.js';

type Periodo = z.infer<typeof periodoDashboardSvo>;
function quantidade(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Contagem do dashboard fora do intervalo seguro.');
  return n;
}
/** Datas civis já vêm formatadas pelo SQL: sem Z, UTC ou deslocamento artificial. */
function instante(valor: unknown): string | null {
  if (valor == null) return null;
  if (typeof valor !== 'string') throw new Error('Timestamp civil não retornado como texto.');
  return valor;
}
function texto(valor: unknown): string | null { return valor == null ? null : String(valor); }

/** IND-10 é fila atual; IND-11/13 são decisões por triado_em; IND-12 usa
 * triado_em da mesma transação que gerou a ordem em SCRUM-131, não timestamp inventado.
 * IND-14 usa coorte de solicitações criadas no período, incluindo status NULL legado.
 */
export async function consultarDashboardSvo(periodo: Periodo) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const [r] = await tx`
      WITH hoje AS (
        SELECT timezone('America/Maceio', CURRENT_TIMESTAMP)::date AS dia
      ), intervalo AS (
        SELECT (dia - CASE ${periodo}::text WHEN '7d' THEN 6 WHEN '30d' THEN 29 ELSE 0 END)::timestamp AS inicio,
               (dia + interval '1 day')::timestamp AS fim
        FROM hoje
      ),
      triagens AS (
        SELECT count(*) FILTER (WHERE so.status_triagem='CONFIRMADA_SVO')::text AS confirmadas_svo,
               count(*) FILTER (WHERE so.status_triagem='ENCAMINHADA_IML')::text AS encaminhadas_iml
        FROM public.solicitacao_obito so CROSS JOIN intervalo p
        WHERE so.triado_em >= p.inicio AND so.triado_em < p.fim
      ),
      ordens AS (
        SELECT count(*)::text AS ordens_coleta
        FROM public.ordem_coleta oc JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
        CROSS JOIN intervalo p
        WHERE so.status_triagem='CONFIRMADA_SVO' AND so.triado_em >= p.inicio AND so.triado_em < p.fim
      ),
      geral AS (
        SELECT count(*) FILTER (WHERE so.status_triagem='AGUARDANDO_TRIAGEM')::text AS aguardando,
               count(*) FILTER (WHERE so.status_triagem='CONFIRMADA_SVO')::text AS confirmadas,
               count(*) FILTER (WHERE so.status_triagem='ENCAMINHADA_IML')::text AS iml,
               count(*) FILTER (WHERE so.status_triagem IS NULL)::text AS sem_classificacao
        FROM public.solicitacao_obito so CROSS JOIN intervalo p
        WHERE so.criado_em >= p.inicio AND so.criado_em < p.fim
      ),
      fila AS (
        SELECT count(*)::text AS aguardando_triagem FROM public.solicitacao_obito
        WHERE status_triagem='AGUARDANDO_TRIAGEM'
      )
      SELECT to_char(p.inicio,'YYYY-MM-DD') AS inicio,
             to_char(p.fim - interval '1 day','YYYY-MM-DD') AS fim,
             t.confirmadas_svo, t.encaminhadas_iml, o.ordens_coleta,
             g.aguardando, g.confirmadas, g.iml, g.sem_classificacao,
             f.aguardando_triagem
      FROM intervalo p CROSS JOIN triagens t CROSS JOIN ordens o CROSS JOIN geral g CROSS JOIN fila f
    `;
    if (!r) throw new Error('Agregação SVO sem resultado.');
    return {
      periodo, inicio: String(r.inicio), fim: String(r.fim),
      indicadores: {
        aguardandoTriagem: quantidade(r.aguardando_triagem),
        confirmadasSvo: quantidade(r.confirmadas_svo),
        ordensColeta: quantidade(r.ordens_coleta),
        encaminhadasIml: quantidade(r.encaminhadas_iml),
      },
      visaoGeral: {
        aguardandoTriagem: quantidade(r.aguardando),
        confirmadasSvo: quantidade(r.confirmadas),
        encaminhadasIml: quantidade(r.iml),
        semClassificacao: quantidade(r.sem_classificacao),
      },
    };
  });
}

/** IND-10 e fila de despacho são saldos atuais, não dependem do filtro de período. */
export async function consultarFilasSvo() {
  return sql.begin('isolation level repeatable read read only', async tx => {
    const [pendentes] = await tx`
      SELECT count(*)::text AS total FROM public.solicitacao_obito
      WHERE status_triagem='AGUARDANDO_TRIAGEM'
    `;
    const itensTriagem = await tx`
      SELECT id::text AS id, codigo,
             to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS criado_em_civil
      FROM public.solicitacao_obito
      WHERE status_triagem='AGUARDANDO_TRIAGEM'
      ORDER BY criado_em ASC NULLS LAST, id ASC LIMIT 10
    `;
    const [despacho] = await tx`
      SELECT count(*)::text AS total FROM public.ordem_coleta
      WHERE status='PENDENTE_ALOCACAO'
    `;
    const itensDespacho = await tx`
      SELECT oc.id::text AS id, so.codigo AS solicitacao_codigo, oc.quantidade_corpos
      FROM public.ordem_coleta oc JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
      WHERE oc.status='PENDENTE_ALOCACAO'
      ORDER BY oc.id ASC LIMIT 10
    `;
    return {
      aguardandoTriagem: {
        total: quantidade(pendentes.total),
        itens: itensTriagem.map(r => ({id:String(r.id),codigo:String(r.codigo),criadoEm:instante(r.criado_em_civil)})),
      },
      aguardandoDespacho: {
        total: quantidade(despacho.total),
        itens: itensDespacho.map(r => ({id:String(r.id),codigo:`#OC-${String(r.id)}`,
          solicitacaoCodigo:String(r.solicitacao_codigo),quantidadeCorpos:r.quantidade_corpos == null ? null : quantidade(r.quantidade_corpos)})),
      },
    };
  });
}

/** IND-07: eventos SVO gravados, reconhecidos pelas descrições fechadas existentes.
 * O esquema legado não tem FK SVO em log_atividade: não vincular texto livre.
 */
export async function consultarAtividadesSvo(limite: number) {
  const registros = await sql`
    SELECT l.id::text AS id, l.descricao,
           to_char(l.data_hora, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_hora,
           l.usuario_id::text AS usuario_id, u.nome AS usuario_nome
    FROM public.log_atividade l LEFT JOIN public.usuario u ON u.id=l.usuario_id
    WHERE l.descricao ~ '^Solicitação #SVO-[0-9]+ registrada por telefone$'
       OR l.descricao ~ '^Solicitação #SVO-[0-9]+ confirmada na ligação$'
       OR l.descricao ~ '^Rascunho da triagem de #SVO-[0-9]+ atualizado$'
       OR l.descricao ~ '^Triagem de #SVO-[0-9]+ confirmada como SVO$'
       OR l.descricao ~ '^Triagem de #SVO-[0-9]+ encaminhada ao IML$'
       OR l.descricao ~ '^Ordem de coleta #OC-[0-9]+ gerada para #SVO-[0-9]+$'
       OR l.descricao ~ '^Ordem de coleta #OC-[0-9]+ (despachada|iniciada|entrou em transporte|concluída|cancelada)$'
    ORDER BY l.data_hora DESC NULLS LAST, l.id DESC LIMIT ${limite}
  `;
  return {
    data: registros.map(r => ({id:String(r.id),descricao:String(r.descricao),
      dataHora:instante(r.data_hora),usuarioId:texto(r.usuario_id),usuarioNome:texto(r.usuario_nome)})),
  };
}
