import { z } from 'zod';

const inteiro = (max: number) => z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(max));
export const consultaNotificacoes = z.object({
  page: inteiro(1_000_000).default(1), limit: inteiro(100).default(20),
  filtro: z.enum(['todas','nao-lidas','lidas']).default('todas'),
}).strict();
export const notificacao = z.object({
  id: z.string().regex(/^\d+$/), titulo: z.string(), descricao: z.string(),
  categoria: z.enum(['informacao','atencao','urgente','sucesso']),
  criadoEm: z.iso.datetime({ offset: true }), lidaEm: z.iso.datetime({ offset: true }).nullable(),
});
export const notificacoesSchemas = {
  ListaNotificacoes: z.object({ data: z.array(notificacao), meta: z.object({
    page: z.number().int(), limit: z.number().int(), total: z.number().int().nonnegative(), naoLidas: z.number().int().nonnegative(),
  }) }),
  NotificacoesAtualizadas: z.object({ data: z.object({ atualizadas: z.number().int().nonnegative() }) }),
};
