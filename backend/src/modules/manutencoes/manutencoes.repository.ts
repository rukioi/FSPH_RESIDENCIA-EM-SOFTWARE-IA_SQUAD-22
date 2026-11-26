import type { TransactionSql } from 'postgres';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { elegibilidadeManutencao, hojeManutencao } from './manutencoes.alertas-criterios.js';
import type { Evento, Filtros, LinhaManutencao, Paginacao } from './manutencoes.schemas.js';

type Executor = typeof sql | TransactionSql;
export type DadosManutencao = Pick<LinhaManutencao,
  'tipo' | 'descricao' | 'status' | 'entrada' | 'conclusaoPrevista' | 'prestador' | 'custo' |
  'quilometragem' | 'observacoes' | 'iniciadaEm' | 'concluidaEm' | 'canceladaEm'>;

function instante(tx: Executor, column: string) {
  return tx`to_char(${tx(column)} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

function civil(tx: Executor, column: string) {
  return tx`to_char(${tx(column)} AT TIME ZONE 'America/Maceio', 'YYYY-MM-DD')`;
}

function resumo(tx: Executor) {
  return tx`m.id::text, json_build_object('id', v.id::text, 'placa', v.placa, 'vinculo', v.vinculo) AS veiculo,
    m.tipo, m.descricao, m.status, ${civil(tx, 'm.entrada_em')} AS entrada,
    ${civil(tx, 'm.conclusao_prevista_em')} AS "conclusaoPrevista", m.prestador, m.custo::text,
    ${elegibilidadeManutencao(tx, hojeManutencao(tx)).ATRASO} AS atrasada`;
}

function detalhe(tx: Executor) {
  return tx`${resumo(tx)}, m.quilometragem, m.observacoes, ${instante(tx, 'm.iniciada_em')} AS "iniciadaEm",
    ${instante(tx, 'm.concluida_em')} AS "concluidaEm", ${instante(tx, 'm.cancelada_em')} AS "canceladaEm",
    ${instante(tx, 'm.criado_em')} AS "criadoEm", ${instante(tx, 'm.atualizado_em')} AS "atualizadoEm"`;
}

/** Lê o detalhe sem converter timestamps ou decimais pelo JavaScript. */
export async function buscarManutencao(id: string, tx: Executor = sql) {
  const [row] = await tx<LinhaManutencao[]>`SELECT ${detalhe(tx)}
    FROM public.manutencao_veiculo m JOIN public.veiculo v ON v.id=m.veiculo_id WHERE m.id=${id}`;
  return row;
}

function totalSeguro(count: string): number {
  const total = Number(count);
  if (!Number.isSafeInteger(total)) throw new Error('Contagem fora da faixa suportada.');
  return total;
}

/** Lê página, total e existência do veículo no mesmo snapshot. */
export async function listarManutencoes(f: Filtros, p: Paginacao, veiculoDaRota?: string) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    if (veiculoDaRota !== undefined && !(await tx`SELECT id FROM public.veiculo WHERE id=${veiculoDaRota}`).length) {
      throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Veículo não encontrado.');
    }
    const id = veiculoDaRota ?? f.veiculoId ?? null;
    const termo = f.q ?? null;
    const origem = tx`FROM public.manutencao_veiculo m JOIN public.veiculo v ON v.id=m.veiculo_id
      WHERE (${id}::bigint IS NULL OR m.veiculo_id=${id}::bigint)
        AND (${f.tipo ?? null}::public.tipo_manutencao_veiculo IS NULL OR m.tipo=${f.tipo ?? null})
        AND (${f.status ?? null}::public.status_manutencao_veiculo IS NULL OR m.status=${f.status ?? null})
        AND (${f.inicio ?? null}::date IS NULL OR m.entrada_em >= (${f.inicio ?? null}::date::timestamp AT TIME ZONE 'America/Maceio'))
        AND (${f.fim ?? null}::date IS NULL OR m.entrada_em < ((${f.fim ?? null}::date + 1)::timestamp AT TIME ZONE 'America/Maceio'))
        AND (${termo}::text IS NULL OR strpos(lower(v.placa), lower(${termo})) > 0
          OR strpos(lower(m.descricao), lower(${termo})) > 0 OR strpos(lower(m.prestador), lower(${termo})) > 0)`;
    const data = await tx`SELECT ${resumo(tx)} ${origem}
      ORDER BY m.entrada_em DESC,m.id DESC LIMIT ${p.limit} OFFSET ${(p.page - 1) * p.limit}`;
    const [count] = await tx`SELECT count(*)::text AS total ${origem}`;
    return { data, meta: { ...p, total: totalSeguro(count.total) } };
  });
}

function snapshot(tx: Executor, prefix: 'anterior' | 'posterior') {
  return tx`json_build_object('entrada', ${civil(tx, prefix + '_entrada_em')},
    'conclusaoPrevista', ${civil(tx, prefix + '_conclusao_prevista_em')},
    'iniciadaEm', ${instante(tx, prefix + '_iniciada_em')},
    'concluidaEm', ${instante(tx, prefix + '_concluida_em')}, 'canceladaEm', ${instante(tx, prefix + '_cancelada_em')})`;
}

/** Retorna apenas os eventos estruturados persistidos para a ocorrência. */
export async function listarHistorico(id: string, p: Paginacao) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    if (!(await tx`SELECT id FROM public.manutencao_veiculo WHERE id=${id}`).length) {
      throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Manutenção não encontrada.');
    }
    const data = await tx<Evento[]>`SELECT id::text, manutencao_id::text AS "manutencaoId", evento,
      status_anterior AS "statusAnterior", status_posterior AS "statusPosterior",
      ${snapshot(tx, 'anterior')} AS anterior, ${snapshot(tx, 'posterior')} AS posterior,
      autor_id::text AS "autorId", ${instante(tx, 'registrado_em')} AS "registradoEm"
      FROM public.manutencao_veiculo_historico WHERE manutencao_id=${id}
      ORDER BY registrado_em DESC, id DESC LIMIT ${p.limit} OFFSET ${(p.page - 1) * p.limit}`;
    const [count] = await tx`SELECT count(*)::text AS total FROM public.manutencao_veiculo_historico WHERE manutencao_id=${id}`;
    return { data, meta: { ...p, total: totalSeguro(count.total) } };
  });
}

/** Adquire o lock comum aos fluxos de disponibilidade antes de bloquear a manutenção. */
export async function bloquearVeiculo(tx: TransactionSql, id: string) {
  const [row] = await tx<{ id: string; status: string | null }[]>`SELECT id::text, status::text FROM public.veiculo WHERE id=${id} FOR UPDATE`;
  if (!row) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Veículo não encontrado.');
  return row;
}

/** Identifica o recurso antes do lock, sem alterar a ordem veículo → ocorrência. */
export async function identificarVeiculo(tx: TransactionSql, id: string) {
  const [row] = await tx<{ id: string }[]>`SELECT veiculo_id::text AS id FROM public.manutencao_veiculo WHERE id=${id}`;
  if (!row) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Manutenção não encontrada.');
  return row.id;
}

/** Bloqueia a ocorrência depois do veículo e relê sua versão. */
export async function bloquearManutencao(tx: TransactionSql, id: string) {
  await tx`SELECT id FROM public.manutencao_veiculo WHERE id=${id} FOR UPDATE`;
  const row = await buscarManutencao(id, tx);
  if (!row) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Manutenção não encontrada.');
  return row;
}

/** Converte a janela civil em instantes sem usar o fuso da sessão. */
export async function janelaManutencao(tx: TransactionSql, entrada: string, previsao: string) {
  const [row] = await tx<{ inicio: string; fim: string }[]>`SELECT
    to_char((${entrada}::date::timestamp AT TIME ZONE 'America/Maceio') AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS inicio,
    to_char(((${previsao}::date + 1)::timestamp AT TIME ZONE 'America/Maceio') AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS fim`;
  return row;
}

/** Usa o relógio do banco após a obtenção dos locks. */
export async function instanteMutacao(tx: TransactionSql) {
  const [row] = await tx<{ agora: string }[]>`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS agora`;
  return row.agora;
}

/** Persiste a ocorrência com o ator da sessão e devolve a projeção após gravar. */
export async function inserirManutencao(tx: TransactionSql, veiculoId: string, ator: string, d: DadosManutencao, agora: string) {
  const [row] = await tx<{ id: string }[]>`INSERT INTO public.manutencao_veiculo
    (veiculo_id, tipo, descricao, entrada_em, conclusao_prevista_em, iniciada_em, quilometragem, custo, prestador,
     observacoes, status, criado_por_id, atualizado_por_id, criado_em, atualizado_em)
    VALUES (${veiculoId}, ${d.tipo}, ${d.descricao}, ${d.entrada}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${d.conclusaoPrevista}::date::timestamp AT TIME ZONE 'America/Maceio', ${d.iniciadaEm}::text::timestamptz,
      ${d.quilometragem}, ${d.custo}::numeric, ${d.prestador}, ${d.observacoes}, ${d.status},
      ${ator}, ${ator}, ${agora}::text::timestamptz, ${agora}::text::timestamptz) RETURNING id::text`;
  return buscarManutencao(row.id, tx);
}

/** Atualiza os campos permitidos e garante avanço estrito na precisão PostgreSQL. */
export async function atualizarManutencao(tx: TransactionSql, id: string, ator: string, d: DadosManutencao, agora: string) {
  await tx`UPDATE public.manutencao_veiculo SET tipo=${d.tipo}, descricao=${d.descricao},
    entrada_em=${d.entrada}::date::timestamp AT TIME ZONE 'America/Maceio',
    conclusao_prevista_em=${d.conclusaoPrevista}::date::timestamp AT TIME ZONE 'America/Maceio',
    iniciada_em=${d.iniciadaEm}::text::timestamptz, concluida_em=${d.concluidaEm}::text::timestamptz,
    cancelada_em=${d.canceladaEm}::text::timestamptz, quilometragem=${d.quilometragem}, custo=${d.custo}::numeric,
    prestador=${d.prestador}, observacoes=${d.observacoes}, status=${d.status}, atualizado_por_id=${ator},
    atualizado_em=GREATEST(${agora}::text::timestamptz, atualizado_em + INTERVAL '1 microsecond') WHERE id=${id}`;
  return buscarManutencao(id, tx);
}

/** Registra os snapshots na mesma transação da ocorrência. */
export async function inserirHistorico(tx: TransactionSql, evento: Evento['evento'],
  a: LinhaManutencao, b: LinhaManutencao, ator: string, agora: string) {
  await tx`INSERT INTO public.manutencao_veiculo_historico
    (manutencao_id, evento, status_anterior, status_posterior,
     anterior_entrada_em, anterior_conclusao_prevista_em, anterior_iniciada_em, anterior_concluida_em, anterior_cancelada_em,
     posterior_entrada_em, posterior_conclusao_prevista_em, posterior_iniciada_em, posterior_concluida_em, posterior_cancelada_em,
     autor_id, registrado_em)
    VALUES (${a.id}, ${evento}, ${a.status}, ${b.status},
      ${a.entrada}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${a.conclusaoPrevista}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${a.iniciadaEm}::text::timestamptz, ${a.concluidaEm}::text::timestamptz, ${a.canceladaEm}::text::timestamptz,
      ${b.entrada}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${b.conclusaoPrevista}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${b.iniciadaEm}::text::timestamptz, ${b.concluidaEm}::text::timestamptz, ${b.canceladaEm}::text::timestamptz,
      ${ator}, ${agora}::text::timestamptz)`;
}
