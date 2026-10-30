import { z } from 'zod';

export const id = z.string().regex(/^-?\d+$/).describe('BIGINT serializado pelo postgres como string; não converter para Number.');
export const date = z.string().describe('Representação atual do driver; DATE é serializado como ISO com hora, sem conversão histórica.');
export const timestamp = z.string().describe('Timestamp sem fuso no banco, serializado pelo driver como ISO; não redefine seu significado histórico.');
export const decimal = z.string().describe('NUMERIC serializado pelo driver como string, preservando precisão.');
export const perfil = z.enum(['ADM', 'GESTOR_FROTA', 'SOLICITANTE_INTERNO', 'MOTORISTA', 'ATENDENTE_SVO']);
export const erro = z.object({ error: z.object({ code: z.string(), message: z.string(), fields: z.record(z.string(), z.string()).optional() }) });
export const erroString = z.object({ error: z.string() });
export const erroSvo = z.object({ erro: z.string() });
export const sucessoExclusao = z.object({ data: z.object({ success: z.literal(true) }) });
export const meta = z.object({ page: z.number().int(), limit: z.number().int(), total: z.number().int() });
export const gestor = ['ADM', 'GESTOR_FROTA'];
export const consultaFrota = [...gestor, 'ATENDENTE_SVO'];
/** Envolve o schema sem normalizar nomes, números ou datas do transporte atual. */
export const dados = <T extends z.ZodType>(schema: T) => z.object({ data: schema });
