import { z } from 'zod';
import { id, date, timestamp, dados } from '../../shared/contract/schemas.js';
const contagens = z.array(z.object({ status: z.string().nullable(), total: z.number().int() }));
const viagem = z.object({ id, codigo: z.string(), solicitante_id: id.nullable(), origem: z.string(), destino: z.string(), data_hora_saida: timestamp,
  qtd_passageiros: z.number().int().nullable(), status: z.string().nullable(), motivo_rejeicao: z.string().nullable(), criado_em: timestamp.nullable(),
  veiculo_id: id.nullable(), motorista_id: id.nullable() });
export const dashboardSchemas = {
  Dashboard: dados(z.object({})), Graficos: dados(z.object({ veiculosPorStatus: contagens, solicitacoesPorStatus: contagens })),
  DashboardGestor: dados(z.object({ veiculosPorStatus: contagens, motoristasDisponiveis: z.number().int(), solicitacoesPorStatus: contagens, proximasViagens: z.array(viagem) }))
    .describe('motoristasDisponiveis é a contagem de TODOS os motoristas; cálculo legado preservado. Não há endpoint /kpis ou filtro por período.'),
  PendenciasDashboard: dados(z.object({ motoristas: z.array(z.object({ id, nome: z.string(), vencimento: date, situacao: z.string() })),
    documentos: z.array(z.object({ id, tipo_documento: z.string(), vencimento: date, placa: z.string(), modelo: z.string(), situacao: z.string() })) })),
};
