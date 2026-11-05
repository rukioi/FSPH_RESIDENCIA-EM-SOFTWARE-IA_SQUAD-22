import { z } from 'zod';
import { id } from '../../shared/contract/schemas.js';

export const periodoDashboardSvo = z.enum(['hoje', '7d', '30d']);
export const filtroDashboardSvo = z.strictObject({ periodo: periodoDashboardSvo.default('hoje') });
export const filtroAtividadesSvo = z.strictObject({ limite: z.string().regex(/^[1-9]\d*$/).default('10') });

const quantidade = z.number().int().nonnegative();
const resumoFila = z.object({ id, codigo: z.string(), criadoEm: z.string().nullable() });
const resumoOrdemFila = z.object({ id, codigo: z.string(), solicitacaoCodigo: z.string(), quantidadeCorpos: quantidade.nullable() });

export const svoDashboardSchemas = {
  DashboardOperacionalSvo: z.object({
    periodo: periodoDashboardSvo,
    inicio: z.string(), fim: z.string(),
    indicadores: z.object({
      aguardandoTriagem: quantidade, confirmadasSvo: quantidade,
      ordensColeta: quantidade, encaminhadasIml: quantidade,
    }),
    visaoGeral: z.object({
      aguardandoTriagem: quantidade, confirmadasSvo: quantidade,
      encaminhadasIml: quantidade, semClassificacao: quantidade,
    }),
  }),
  FilasOperacionaisSvo: z.object({
    aguardandoTriagem: z.object({ total: quantidade, itens: z.array(resumoFila) }),
    aguardandoDespacho: z.object({ total: quantidade, itens: z.array(resumoOrdemFila) }),
  }),
  AtividadesRecentesSvo: z.object({
    data: z.array(z.object({
      id, descricao: z.string(), dataHora: z.string().nullable(),
      usuarioId: id.nullable(), usuarioNome: z.string().nullable(),
    })),
  }),
};

export function parseLimiteAtividades(valor: string): number | null {
  const n = Number(valor);
  return Number.isSafeInteger(n) && n >= 1 && n <= 50 ? n : null;
}
