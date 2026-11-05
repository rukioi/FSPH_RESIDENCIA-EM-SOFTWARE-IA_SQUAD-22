import { sql } from '../../database/connection.js';

export interface ConsultaPagina { page: number; limit: number; offset: number }
export interface FiltroSolicitacoes extends ConsultaPagina {
  status?: 'AGUARDANDO_TRIAGEM' | 'CONFIRMADA_SVO' | 'ENCAMINHADA_IML';
  inicio?: string; fim?: string;
}
export interface FiltroOrdens extends ConsultaPagina {
  status?: 'PENDENTE_ALOCACAO' | 'EM_DESLOCAMENTO' | 'EM_TRANSPORTE' | 'CONCLUIDA' | 'CANCELADA';
}

/** Recebe a string civil selecionada pelo SQL, nunca converte timestamp sem fuso em UTC. */
function instante(valor: unknown): string | null {
  if (valor == null) return null;
  if (typeof valor !== 'string') throw new Error('Timestamp civil não retornado como texto.');
  return valor;
}
function optTexto(valor: unknown): string | null { return valor == null ? null : String(valor); }
function optNumero(valor: unknown): number | null { return valor == null ? null : Number(valor); }
function totalSeguro(valor: unknown): number {
  const total = Number(valor);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('Contagem de consulta fora do intervalo seguro.');
  return total;
}

/** Consulta e total dentro do mesmo snapshot; resultados ordenados por data e ID. */
export async function consultarSolicitacoesPaginadas(f: FiltroSolicitacoes) {
  const status = f.status ?? null, inicio = f.inicio ?? null, fim = f.fim ?? null;
  return sql.begin('isolation level repeatable read read only', async tx => {
    const data = await tx`
      SELECT id::text AS id, codigo, status_triagem::text AS status_triagem,
             to_char(criado_em, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS criado_em_civil
      FROM public.solicitacao_obito
      WHERE (${status}::text IS NULL OR status_triagem::text = ${status})
        AND (${inicio}::date IS NULL OR criado_em >= ${inicio}::date)
        AND (${fim}::date IS NULL OR criado_em < (${fim}::date + interval '1 day'))
      ORDER BY criado_em DESC NULLS LAST, id DESC
      LIMIT ${f.limit} OFFSET ${f.offset}
    `;
    const [contagem] = await tx`
      SELECT count(*)::text AS total FROM public.solicitacao_obito
      WHERE (${status}::text IS NULL OR status_triagem::text = ${status})
        AND (${inicio}::date IS NULL OR criado_em >= ${inicio}::date)
        AND (${fim}::date IS NULL OR criado_em < (${fim}::date + interval '1 day'))
    `;
    return {
      data: data.map(r => ({ id: String(r.id), codigo: String(r.codigo),
        statusTriagem: optTexto(r.status_triagem), criadoEm: instante(r.criado_em_civil) })),
      meta: { page: f.page, limit: f.limit, total: totalSeguro(contagem.total) },
    };
  });
}

/** Pagina ordens reais, inclusive concluídas, sem expor dados pessoais nas listas. */
export async function consultarOrdensPaginadas(f: FiltroOrdens) {
  const status = f.status ?? null;
  return sql.begin('isolation level repeatable read read only', async tx => {
    const data = await tx`
      SELECT oc.id::text AS id, oc.status::text AS status,
             oc.solicitacao_obito_id::text AS solicitacao_id,
             so.codigo AS solicitacao_codigo, oc.quantidade_corpos
      FROM public.ordem_coleta oc JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
      WHERE (${status}::text IS NULL OR oc.status::text = ${status})
      ORDER BY oc.id DESC LIMIT ${f.limit} OFFSET ${f.offset}
    `;
    const [contagem] = await tx`
      SELECT count(*)::text AS total FROM public.ordem_coleta oc
      JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
      WHERE (${status}::text IS NULL OR oc.status::text = ${status})
    `;
    return {
      data: data.map(r => ({ id: String(r.id), codigo: `#OC-${String(r.id)}`,
        status: optTexto(r.status), solicitacaoId: String(r.solicitacao_id),
        solicitacaoCodigo: String(r.solicitacao_codigo), quantidadeCorpos: optNumero(r.quantidade_corpos) })),
      meta: { page: f.page, limit: f.limit, total: totalSeguro(contagem.total) },
    };
  });
}

/** Retoma os campos realmente persistidos; GET nunca cria ordem nem conclui triagem. */
export async function consultarSolicitacaoDetalhada(id: string) {
  const [r] = await sql`
    SELECT so.id::text AS id, so.codigo,
      to_char(so.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS criado_em,
      so.status_triagem::text AS status_triagem,
      so.triagem_observacoes, so.triado_por_id::text AS triado_por_id,
      to_char(so.triado_em, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS triado_em,
      so.local_falecimento, so.endereco_remocao, so.ponto_referencia, so.canal_atendimento,
      so.solicitante_nome, so.solicitante_parentesco, so.solicitante_telefone,
      so.nome_falecido, so.observacoes_medicas,
      oc.id::text AS ordem_id, oc.status::text AS ordem_status,
      oc.quantidade_corpos, oc.motorista_id::text AS motorista_id,
      oc.veiculo_id::text AS veiculo_id
    FROM public.solicitacao_obito so
    LEFT JOIN public.ordem_coleta oc ON oc.solicitacao_obito_id=so.id
    WHERE so.id=${id}::bigint
  `;
  if (!r) return null;
  return {
    id: String(r.id), codigo: String(r.codigo), criadoEm: instante(r.criado_em),
    statusTriagem: optTexto(r.status_triagem), triagemObservacoes: optTexto(r.triagem_observacoes),
    triadoPorId: optTexto(r.triado_por_id), triadoEm: instante(r.triado_em),
    localFalecimento: String(r.local_falecimento), enderecoRemocao: String(r.endereco_remocao),
    pontoReferencia: optTexto(r.ponto_referencia), canalAtendimento: optTexto(r.canal_atendimento),
    solicitanteNome: String(r.solicitante_nome), solicitanteParentesco: optTexto(r.solicitante_parentesco),
    solicitanteTelefone: optTexto(r.solicitante_telefone), nomeFalecido: optTexto(r.nome_falecido),
    observacoesMedicas: optTexto(r.observacoes_medicas),
    ordemColeta: r.ordem_id == null ? null : {
      id: String(r.ordem_id), codigo: `#OC-${String(r.ordem_id)}`,
      status: optTexto(r.ordem_status), quantidadeCorpos: optNumero(r.quantidade_corpos),
      motoristaId: optTexto(r.motorista_id), veiculoId: optTexto(r.veiculo_id),
    },
  };
}

/** Detalha somente dados operacionais da ordem para o atendente autorizado. */
export async function consultarOrdemDetalhada(id: string) {
  const [r] = await sql`
    SELECT oc.id::text AS id, oc.status::text AS status,
      oc.solicitacao_obito_id::text AS solicitacao_id, so.codigo AS solicitacao_codigo,
      so.status_triagem::text AS status_triagem, so.endereco_remocao,
      oc.quantidade_corpos, oc.motorista_id::text AS motorista_id, oc.veiculo_id::text AS veiculo_id,
      oc.km_inicial, oc.km_final,
      to_char(oc.data_inicio, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_inicio,
      to_char(oc.data_fim, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_fim
    FROM public.ordem_coleta oc
    JOIN public.solicitacao_obito so ON so.id=oc.solicitacao_obito_id
    WHERE oc.id=${id}::bigint
  `;
  if (!r) return null;
  return {
    id: String(r.id), codigo: `#OC-${String(r.id)}`, status: optTexto(r.status),
    solicitacaoId: String(r.solicitacao_id), solicitacaoCodigo: String(r.solicitacao_codigo),
    statusTriagem: optTexto(r.status_triagem), quantidadeCorpos: optNumero(r.quantidade_corpos),
    motoristaId: optTexto(r.motorista_id), veiculoId: optTexto(r.veiculo_id),
    kmInicial: optNumero(r.km_inicial), kmFinal: optNumero(r.km_final),
    dataInicio: instante(r.data_inicio), dataFim: instante(r.data_fim),
    enderecoRemocao: String(r.endereco_remocao),
  };
}

/** Relaciona SOMENTE descrições exatas geradas pelos eventos fechados atuais.
 * O banco legado não tem FK SVO no log; não inferimos despacho/execução não auditados.
 */
export async function consultarHistoricoSvo(id: string, tipo: 'solicitacao' | 'ordem', p: ConsultaPagina) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    let descricoes: string[];
    if (tipo === 'solicitacao') {
      const [solicitacao] = await tx`SELECT id::text FROM public.solicitacao_obito WHERE id=${id}::bigint`;
      if (!solicitacao) return null;
      const [ordem] = await tx`SELECT id::text FROM public.ordem_coleta WHERE solicitacao_obito_id=${id}::bigint`;
      descricoes = [
        `Solicitação #SVO-${id} registrada por telefone`,
        `Solicitação #SVO-${id} confirmada na ligação`,
        `Rascunho da triagem de #SVO-${id} atualizado`,
        `Triagem de #SVO-${id} confirmada como SVO`,
        `Triagem de #SVO-${id} encaminhada ao IML`,
      ];
      if (ordem) descricoes.push(`Ordem de coleta #OC-${String(ordem.id)} gerada para #SVO-${id}`);
    } else {
      const [ordem] = await tx`
        SELECT solicitacao_obito_id::text AS solicitacao_id FROM public.ordem_coleta WHERE id=${id}::bigint
      `;
      if (!ordem) return null;
      descricoes = [`Ordem de coleta #OC-${id} gerada para #SVO-${String(ordem.solicitacao_id)}`];
    }
    const data = await tx`
      SELECT l.id::text AS id, l.descricao,
             to_char(l.data_hora, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS data_hora,
             l.usuario_id::text AS usuario_id, u.nome AS usuario_nome
      FROM public.log_atividade l LEFT JOIN public.usuario u ON u.id=l.usuario_id
      WHERE l.descricao=ANY(${descricoes}::text[])
      ORDER BY l.data_hora ASC NULLS LAST, l.id ASC
      LIMIT ${p.limit} OFFSET ${p.offset}
    `;
    const [contagem] = await tx`
      SELECT count(*)::text AS total FROM public.log_atividade
      WHERE descricao=ANY(${descricoes}::text[])
    `;
    return {
      data: data.map(r => ({ id: String(r.id), descricao: String(r.descricao),
        dataHora: instante(r.data_hora), usuarioId: optTexto(r.usuario_id),
        usuarioNome: optTexto(r.usuario_nome) })),
      meta: { page: p.page, limit: p.limit, total: totalSeguro(contagem.total) },
    };
  });
}
