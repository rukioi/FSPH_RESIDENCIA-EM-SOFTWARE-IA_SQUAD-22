import type postgres from 'postgres';

type Executor = postgres.Sql | postgres.TransactionSql;
export type AlertaManutencao = 'ATRASO' | 'PREVENTIVA_PROXIMA';
export const alertasManutencao = ['ATRASO', 'PREVENTIVA_PROXIMA'] as const;

export function hojeManutencao(tx: Executor) {
  return tx`(statement_timestamp() AT TIME ZONE 'America/Maceio')::date`;
}

/** Estados terminais não têm referência de atraso. A ocorrência usa o alias m. */
export function dataResponsavelPeloAtraso(tx: Executor) {
  return tx`CASE m.status
    WHEN 'AGENDADA' THEN (m.entrada_em AT TIME ZONE 'America/Maceio')::date
    WHEN 'EM_ANDAMENTO' THEN (m.conclusao_prevista_em AT TIME ZONE 'America/Maceio')::date
  END`;
}

/** Predicados únicos para indicadores, mutações e processamento periódico. */
export function elegibilidadeManutencao(tx: Executor, hoje: postgres.Fragment) {
  const entrada = tx`(m.entrada_em AT TIME ZONE 'America/Maceio')::date`;
  return {
    ATRASO: tx`COALESCE(${dataResponsavelPeloAtraso(tx)} < ${hoje}, false)`,
    PREVENTIVA_PROXIMA: tx`(m.tipo = 'PREVENTIVA' AND m.status = 'AGENDADA'
      AND ${entrada} >= ${hoje} AND ${entrada} < ${hoje} + 7)`,
  };
}
