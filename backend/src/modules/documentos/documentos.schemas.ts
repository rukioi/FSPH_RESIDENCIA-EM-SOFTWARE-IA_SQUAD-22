import { z } from 'zod';
import { id, date, dados } from '../../shared/contract/schemas.js';
const tipo = z.enum(['DOCUMENTO_VEICULO','CNH_MOTORISTA']);
const item = z.object({ id, tipo, descricao: z.string(), relacionado_id: id.nullable(), data_validade: date,
  status: z.enum(['SEM_VALIDADE','VENCIDA','PROXIMA_DO_VENCIMENTO','REGULAR']) });
export const documentosSchemas = {
  Documentos: dados(z.array(item)),
  PendenciasDocumentos: dados(z.array(item.omit({ relacionado_id: true }).extend({ dias_restantes: z.number().int() }))),
  CriarDocumento: z.object({ veiculo_id: z.number().int().positive(), tipo_documento: z.string().min(1), data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .describe('JSON até 1 MiB. Multipart converte veiculo_id para Number; campo arquivo PDF/JPEG/PNG até 5 MiB, assinatura verificada; até dez campos de 4 KiB. Data exige calendário válido.'),
  RespostaDocumento: dados(z.object({ id, veiculo_id: id.nullable(), tipo_documento: z.string(), data_vencimento: date,
    status_regular: z.boolean().nullable(), arquivo_nome: z.string().nullable(), arquivo_tipo: z.string().nullable() })),
};
