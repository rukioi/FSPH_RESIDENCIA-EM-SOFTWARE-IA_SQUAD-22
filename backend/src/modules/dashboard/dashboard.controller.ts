import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import type { ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';
import { buscarPendencias } from './dashboard.pendencias.js';

/** Responde o painel base mantendo seu envelope atual. */
export function dashboardController(response: ServerResponse): void {
  jsonCompartilhado(response, 200, {
      data: {},
    });
}

/** Consulta pendências existentes com falhas técnicas seguras. */
export async function pendenciasController(
  response: ServerResponse
): Promise<void> {
  try {
    const pendencias = await buscarPendencias();

    jsonCompartilhado(response, 200, {
        data: pendencias,
      });
  } catch (erro) {
    registrarFalha(erro);

    jsonCompartilhado(response, 500, {
        error: {
          code: 'ERRO_INTERNO',
          message: 'Não foi possível consultar as pendências.',
        },
      });
  }
}

/** Mantém as contagens existentes e o envelope dos gráficos. */
export async function dashboardGraficosController(
  response: ServerResponse
): Promise<void> {
  try {
    const [veiculosPorStatus, solicitacoesPorStatus] = await Promise.all([
      sql`SELECT status, COUNT(*)::int as total FROM veiculo GROUP BY status`,
      sql`SELECT status, COUNT(*)::int as total FROM solicitacao_viagem GROUP BY status`,
    ]);

    jsonCompartilhado(response, 200, {
        data: {
          veiculosPorStatus,
          solicitacoesPorStatus,
        },
      });
  } catch (error) {
    registrarFalha(error);

    jsonCompartilhado(response, 500, {
        error: {
          code: 'FALHA_INTERNA',
          message: 'Erro inesperado ao processar os dados dos gráficos.',
        },
      });
  }
}

/** Mantém as consultas e o cálculo atuais do painel do gestor. */
export async function dashboardGestorController(
  response: ServerResponse
): Promise<void> {
  try {
    const [veiculosPorStatus, motoristasTotal, solicitacoesPorStatus, proximasViagens] = await Promise.all([
      sql`SELECT status, COUNT(*)::int as total FROM veiculo GROUP BY status`,
      sql`SELECT COUNT(*)::int as total FROM motorista`,
      sql`SELECT status, COUNT(*)::int as total FROM solicitacao_viagem GROUP BY status`,
      sql`SELECT * FROM solicitacao_viagem WHERE status IN ('AGENDADA', 'PRONTA_PARA_INICIAR') ORDER BY id ASC LIMIT 5`,
    ]);

    jsonCompartilhado(response, 200, {
        data: {
          veiculosPorStatus,
          motoristasDisponiveis: motoristasTotal[0]?.total || 0,
          solicitacoesPorStatus,
          proximasViagens,
        },
      });
  } catch (error) {
    registrarFalha(error);

    jsonCompartilhado(response, 500, {
        error: {
          code: 'ERRO_INTERNO',
          message: 'Erro inesperado ao processar os dados do dashboard.',
        },
      });
  }
}