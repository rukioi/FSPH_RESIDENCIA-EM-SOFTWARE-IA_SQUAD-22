import { database, type Database } from '../../database/connection.js';

export interface DashboardDependencies {
  database?: Database;
  now?: () => Date;
}

export type Periodo = 'hoje' | '7dias' | '30dias';

export async function consultarKpis(
  periodo: Periodo,
  dependencies: DashboardDependencies = {},
) {
  const dias = { hoje: 1, '7dias': 7, '30dias': 30 }[periodo];
  const result = await (dependencies.database ?? database).query(`
    WITH referencia AS (
      SELECT ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date AS hoje
    ), limites AS (
      SELECT
        (hoje::timestamp AT TIME ZONE 'America/Sao_Paulo') AS inicio_hoje,
        ((hoje + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') AS fim_hoje,
        ((hoje - ($2::integer - 1))::timestamp AT TIME ZONE 'America/Sao_Paulo') AS inicio_periodo
      FROM referencia
    )
    SELECT
      (SELECT count(*)::integer FROM chamados
        WHERE status = 'PENDENTE'
          AND criado_em >= inicio_periodo AND criado_em < fim_hoje) AS "chamadosPendentes",
      (SELECT count(*)::integer FROM viagens
        WHERE agendada_em >= inicio_hoje AND agendada_em < fim_hoje) AS "viagensHoje",
      (SELECT count(*)::integer FROM veiculos
        WHERE status = 'DISPONIVEL') AS "veiculosDisponiveis",
      (SELECT count(*)::integer FROM motoristas
        WHERE status = 'DISPONIVEL') AS "motoristasDisponiveis"
    FROM limites
  `, [(dependencies.now?.() ?? new Date()).toISOString(), dias]);

  return result.rows[0];
}
