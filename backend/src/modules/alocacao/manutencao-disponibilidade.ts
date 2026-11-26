import type postgres from 'postgres';
import { ErroHttp } from '../../shared/http/errors.js';

type Intervalo = { inicio: string; fim: string };
type Consulta =
  | { tipo: 'RESERVA'; janela: Intervalo }
  | { tipo: 'INICIO_VIAGEM'; fim: postgres.Fragment }
  | { tipo: 'DESPACHO_SVO' };

/** Predicado comum aos fluxos de uso do veículo. Nas escritas, avaliar após o lock. */
export function existeManutencaoBloqueante(sql: postgres.Sql | postgres.TransactionSql,
  veiculo: string | postgres.Fragment, consulta: Consulta) {
  const agora = sql`statement_timestamp()`;
  const inicio = consulta.tipo === 'RESERVA'
    ? sql`(${consulta.janela.inicio}::text::timestamp AT TIME ZONE 'America/Maceio')` : agora;
  const fim = consulta.tipo === 'RESERVA'
    ? sql`(${consulta.janela.fim}::text::timestamp AT TIME ZONE 'America/Maceio')`
    : consulta.tipo === 'INICIO_VIAGEM' ? consulta.fim : sql`NULL::timestamptz`;
  const fimManutencao = sql`(((m.conclusao_prevista_em AT TIME ZONE 'America/Maceio')::date + 1)::timestamp AT TIME ZONE 'America/Maceio')`;
  const intercepta = consulta.tipo === 'DESPACHO_SVO'
    ? sql`m.entrada_em <= ${agora}`
    : sql`${fimManutencao} > ${inicio} AND (${fim} IS NULL OR m.entrada_em < ${fim})`;
  return sql`EXISTS (
    SELECT 1 FROM public.manutencao_veiculo m
    WHERE m.veiculo_id = ${veiculo}
      AND m.status IN ('AGENDADA', 'EM_ANDAMENTO')
      AND (m.status = 'EM_ANDAMENTO' OR ${fimManutencao} <= ${agora} OR (${intercepta}))
  )`;
}

/** Retorno ausente, inválido ou já vencido deixa o início efetivo sem limite superior. */
export async function manutencaoImpedeInicioViagem(tx: postgres.TransactionSql, veiculoId: string, solicitacaoId: string) {
  const fim = tx`CASE WHEN isfinite(s.data_hora_saida) AND isfinite(s.data_hora_retorno_previsto)
      AND s.data_hora_retorno_previsto > s.data_hora_saida
      AND (s.data_hora_retorno_previsto AT TIME ZONE 'America/Maceio') > statement_timestamp()
    THEN s.data_hora_retorno_previsto AT TIME ZONE 'America/Maceio' END`;
  const [linha] = await tx<{ bloqueado: boolean }[]>`
    SELECT ${existeManutencaoBloqueante(tx, veiculoId, {tipo: 'INICIO_VIAGEM', fim})} AS bloqueado
    FROM public.solicitacao_viagem s WHERE s.id = ${solicitacaoId}`;
  return linha.bloqueado;
}

type ContextoManutencao = {
  veiculo: { id: string };
  janela: Intervalo;
  status: 'AGENDADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
};

/** Valida o efeito da ocorrência resultante, sob o lock do veículo na transação chamadora. */
export async function guardarDisponibilidadeManutencao(tx: postgres.TransactionSql, contexto: ContextoManutencao) {
  const { veiculo, janela, status } = contexto;
  if (status !== 'AGENDADA' && status !== 'EM_ANDAMENTO') return;
  const [linha] = await tx<{ bloqueado: boolean }[]>`
    WITH proposta AS (
      SELECT statement_timestamp() AS agora, ${janela.inicio}::timestamptz AS entrada,
        ${janela.fim}::timestamptz AS fim, ${status === 'EM_ANDAMENTO'}::boolean AS em_andamento
    ), janela AS (
      SELECT *, NOT em_andamento AND entrada > agora AS futura,
        CASE WHEN em_andamento THEN agora ELSE entrada END AS inicio_efetivo,
        CASE WHEN NOT em_andamento AND fim > agora THEN fim END AS fim_efetivo
      FROM proposta
    )
    SELECT
      (NOT j.futura AND EXISTS (
        SELECT 1 FROM public.ordem_coleta o WHERE o.veiculo_id = ${veiculo.id}
          AND o.status IN ('EM_DESLOCAMENTO', 'EM_TRANSPORTE')
      )) OR EXISTS (
        SELECT 1 FROM public.solicitacao_viagem s WHERE s.veiculo_id = ${veiculo.id}
          AND s.status IN ('AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO')
          AND CASE
            WHEN j.em_andamento AND s.status = 'EM_ANDAMENTO' THEN TRUE
            WHEN isfinite(s.data_hora_saida) AND isfinite(s.data_hora_retorno_previsto)
              AND s.data_hora_retorno_previsto > s.data_hora_saida
              AND (s.status <> 'EM_ANDAMENTO' OR
                (s.data_hora_retorno_previsto AT TIME ZONE 'America/Maceio') > j.agora)
            THEN (s.data_hora_retorno_previsto AT TIME ZONE 'America/Maceio') > j.inicio_efetivo
              AND (j.fim_efetivo IS NULL OR
                (CASE WHEN s.status = 'EM_ANDAMENTO' THEN j.agora
                  ELSE s.data_hora_saida AT TIME ZONE 'America/Maceio' END) < j.fim_efetivo)
            ELSE NOT (j.futura AND s.status = 'EM_ANDAMENTO')
          END
      ) OR (NOT j.futura AND EXISTS (
        SELECT 1 FROM public.viagem v WHERE v.veiculo_id = ${veiculo.id} AND v.status = 'EM_TRANSPORTE'
      )) AS bloqueado FROM janela j`;
  if (linha.bloqueado) throw new ErroHttp(409, 'CONFLITO_ALOCACAO', 'Veículo comprometido com uma reserva ou operação existente.');
}
