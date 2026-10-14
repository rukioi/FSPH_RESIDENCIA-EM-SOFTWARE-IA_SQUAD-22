import type { ServerResponse } from 'node:http';
import { sql } from '../../config/db.js';

export function dashboardController(response: ServerResponse): void {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  response.end(
    JSON.stringify({
      data: {},
    }),
  );
}

export async function dashboardGraficosController(response: ServerResponse): Promise<void> {
  try {
    const [veiculosPorStatus, solicitacoesPorStatus] = await Promise.all([
      sql`SELECT status, COUNT(*)::int as total FROM veiculo GROUP BY status`,
      sql`SELECT status, COUNT(*)::int as total FROM solicitacao_viagem GROUP BY status`
    ]);

    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(
      JSON.stringify({
        data: {
          veiculosPorStatus,
          solicitacoesPorStatus,
        },
      }),
    );
  } catch (error) {
    console.error('Erro ao buscar dados dos gráficos do dashboard:', error);
    response.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(
      JSON.stringify({
        error: {
          code: 'FALHA_INTERNA',
          message: 'Erro inesperado ao processar os dados dos gráficos.',
        },
      }),
    );
  }
}