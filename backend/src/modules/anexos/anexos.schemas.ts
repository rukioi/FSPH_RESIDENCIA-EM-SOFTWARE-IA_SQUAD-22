import { z } from 'zod';
import { dados, id, meta } from '../../shared/contract/schemas.js';

export const tipoRegistro = z.enum(['SOLICITACAO_VIAGEM', 'SOLICITACAO_SVO', 'VIAGEM', 'ORDEM_SVO',
  'ABASTECIMENTO', 'VEICULO', 'MOTORISTA', 'DOCUMENTO_VEICULO']);
export const registroId = z.string().regex(/^[1-9]\d{0,18}$/)
  .refine(v => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n);
export const vinculoAnexo = z.object({ tipoRegistro, registroId }).strict();
export type VinculoRegistro = z.infer<typeof vinculoAnexo>;
export const paginacaoAnexo = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const consultaAnexos = vinculoAnexo.extend(paginacaoAnexo.shape);
const metadados = vinculoAnexo.extend({ id, nome: z.string().min(1).max(255),
  tipo: z.enum(['application/pdf', 'image/jpeg', 'image/png']), tamanho: z.number().int().min(1).max(5242880),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), autorId: id, criadoEm: z.iso.datetime() });
export const anexosSchemas = {
  CriarAnexo: vinculoAnexo,
  CriarComprovante: z.object({}).strict(),
  MetadadosAnexo: metadados,
  RespostaAnexo: dados(metadados),
  ListaAnexos: dados(z.array(metadados)).extend({ meta }),
  ArquivoAnexo: z.string().describe('Bytes PDF/JPEG/PNG somente após autenticação e autorização por registro.'),
};
