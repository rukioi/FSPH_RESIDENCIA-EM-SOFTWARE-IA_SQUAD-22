import { z } from 'zod';
import { id, date, timestamp, dados } from '../../shared/contract/schemas.js';
const status = z.enum(['DISPONIVEL','EM_VIAGEM','FOLGA','AFASTADO']);
const entrada = z.object({ nome: z.string().min(1), cnh: z.string().min(1), categoria_cnh: z.enum(['A','B','C','D','E']),
  validade_cnh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: status.nullish(), cpf: z.string().nullish(), telefone: z.string().nullish() })
  .describe('Legado não aplicado como validador HTTP: controller valida data de calendário, dígitos CPF/telefone, normaliza CPF/telefone e trim da CNH; não há validação uniforme de campos extras.');
const motorista = z.object({ id, usuario_id: id.nullable(), nome: z.string(), cnh: z.string(), categoria_cnh: z.string(), validade_cnh: date,
  status: status.nullable(), criado_em: timestamp.nullable(), cpf: z.string().nullable().optional(), telefone: z.string().nullable().optional() })
  .describe('CPF/telefone ausentes na consulta de ATENDENTE_SVO; demais perfis recebem esses campos.');
export const motoristasSchemas = { Motorista: motorista, Motoristas: dados(z.array(motorista)), RespostaMotorista: dados(motorista),
  CriarMotorista: entrada, EditarMotorista: entrada.partial().extend({status:status.optional()}) };
