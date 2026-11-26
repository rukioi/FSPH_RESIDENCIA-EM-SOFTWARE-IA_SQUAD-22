import type postgres from 'postgres';

/**
 * SCRUM-240: impedimentos CONHECIDOS do motorista. Decisão do responsável (25/11):
 * só fatos registrados bloqueiam (inativação profissional vigente, ausência VIGENTE ou
 * escala FORA_DE_ESCALA no período); ausência de escala ou de matriz CNH × classe é
 * indeterminada e não bloqueia nem aprova. Matriz não é avaliada: veículo não tem
 * classe veicular homologada.
 */

/** Período civil de Maceió `[inicio, fim)`, no formato dos intervalos de reserva. */
export interface PeriodoCivil { inicio: string; fim: string }

/**
 * Predicado único de impedimento, numa consulta própria. Na escrita, chame depois do
 * lock FOR UPDATE do motorista: uma subconsulta dentro do SELECT do lock usaria o
 * snapshot anterior à espera e não veria uma inativação recém-confirmada.
 * `ids = null` avalia todos os motoristas. Sem período, usa o instante da transação.
 */
export async function motoristasImpedidos(tx: postgres.TransactionSql, ids: string[] | null,
  periodo: PeriodoCivil | null): Promise<Set<string>> {
  if (ids !== null && ids.length === 0) return new Set();
  const rows = await tx<{ id: string }[]>`WITH faixa AS (SELECT CASE WHEN ${periodo?.inicio ?? null}::text IS NULL
        THEN tstzrange(transaction_timestamp(), transaction_timestamp(), '[]')
        ELSE tstzrange((${periodo?.inicio ?? null}::text::timestamp AT TIME ZONE 'America/Maceio'),
          (${periodo?.fim ?? null}::text::timestamp AT TIME ZONE 'America/Maceio'), '[)') END AS r)
    SELECT m.id::text AS id FROM public.motorista m, faixa f
    WHERE (${ids}::bigint[] IS NULL OR m.id = ANY(${ids}::bigint[])) AND (
      coalesce((SELECT t.acao = 'INATIVACAO' FROM public.motorista_transicao_profissional t
        WHERE t.motorista_id = m.id ORDER BY t.versao DESC LIMIT 1), false)
      OR EXISTS (SELECT 1 FROM public.indisponibilidade_motorista i WHERE i.motorista_id = m.id
        AND i.estado = 'VIGENTE' AND tstzrange(i.inicio, i.fim, '[)') && f.r)
      OR EXISTS (SELECT 1 FROM public.escala_motorista e WHERE e.motorista_id = m.id
        AND e.estado = 'VIGENTE' AND e.situacao = 'FORA_DE_ESCALA' AND tstzrange(e.inicio, e.fim, '[)') && f.r))`;
  return new Set(rows.map(r => r.id));
}
