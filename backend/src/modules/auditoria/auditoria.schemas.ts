import { z } from 'zod';
import { id, timestamp, meta } from '../../shared/contract/schemas.js';
const legado = z.object({ id, usuario_id: id.nullable(), descricao: z.string(), data_hora: timestamp.nullable(),
  usuario_nome: z.string().nullable(), usuario_email: z.string().nullable() });
const atividade = z.object({ id, usuarioId: id.nullable(), descricao: z.string(), dataHora: timestamp.nullable(), usuarioNome: z.string().nullable() });
export const auditoriaSchemas = { Atividade: atividade, Auditoria: z.union([z.array(legado), z.object({ data: z.array(atividade), meta })]) };
