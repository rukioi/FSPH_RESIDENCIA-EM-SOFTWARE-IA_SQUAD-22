import { z } from 'zod';

export const tipoRelatorio = z.enum(['viagens', 'solicitacoes', 'veiculos', 'motoristas', 'ocorrencias', 'abastecimentos', 'svo']);
export const statusPorRelatorio = {
  viagens: ['AGENDADA', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA'],
  motoristas: ['AGENDADA', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA'],
  solicitacoes: ['PENDENTE', 'APROVADA', 'AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO', 'CONCLUIDA', 'REPROVADA'],
  veiculos: ['PENDENTE', 'APROVADA', 'AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO', 'EM_TRANSPORTE', 'CONCLUIDA', 'REPROVADA', 'CANCELADA'],
  svo: ['PENDENTE_ALOCACAO', 'EM_DESLOCAMENTO', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA'],
  ocorrencias: [], abastecimentos: [],
} satisfies Record<z.infer<typeof tipoRelatorio>, string[]>;
const identificador = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n);
const dia = z.iso.date().refine(value => !value.startsWith('0000-'));
export const consultaRelatorioSchema = z.strictObject({
  tipo: tipoRelatorio,
  inicio: dia, fim: dia,
  veiculoId: identificador.optional(), motoristaId: identificador.optional(),
  status: z.string().min(1).max(30).optional(),
}).superRefine((value, ctx) => {
  const dias = (Date.parse(value.fim) - Date.parse(value.inicio)) / 86400000;
  if (!(dias >= 0 && dias < 366)) ctx.addIssue({code: 'custom', path: ['fim'], message: 'Informe um período de até 366 dias, com fim igual ou posterior ao início.'});
  if (value.status && !(statusPorRelatorio[value.tipo] as string[]).includes(value.status))
    ctx.addIssue({code: 'custom', path: ['status'], message: 'Status incompatível com o relatório.'});
});
export type ConsultaRelatorio = z.infer<typeof consultaRelatorioSchema>;
const coluna = z.object({ chave: z.string(), titulo: z.string(), tipo: z.enum(['texto', 'numero', 'data', 'dataHora']) });
export type ColunaRelatorio = z.infer<typeof coluna>;
export const respostaRelatorioSchema = z.object({data: z.object({
  tipo: tipoRelatorio, titulo: z.string(), inicio: z.iso.date(), fim: z.iso.date(),
  criterioPeriodo: z.string(), geradoEm: z.iso.datetime(), observacoes: z.array(z.string()),
  filtros: z.object({veiculoId: z.string().nullable(), motoristaId: z.string().nullable(), status: z.string().nullable()}),
  colunas: z.array(coluna),
  linhas: z.array(z.record(z.string(), z.union([z.string(), z.number().finite(), z.null()]))).max(5000),
  resumo: z.object({registros: z.number().int().nonnegative(), kmConcluidos: z.number().nonnegative().nullable(), semQuilometragem: z.number().int().nonnegative().nullable()}),
})});
export type Relatorio = z.infer<typeof respostaRelatorioSchema>['data'];
export const respostaRecursosRelatoriosSchema = z.object({data: z.object({
  veiculos: z.array(z.object({id: z.string(), placa: z.string(), modelo: z.string()})),
  motoristas: z.array(z.object({id: z.string(), nome: z.string()})),
})});
export const relatoriosSchemas = {RespostaRelatorio: respostaRelatorioSchema, RecursosRelatorios: respostaRecursosRelatoriosSchema};
