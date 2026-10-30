import { z } from 'zod';
import { id, date, timestamp, decimal, dados } from '../../shared/contract/schemas.js';
const abastecimento = z.object({ id, veiculo_id: id, motorista_id: id, litragem: decimal, valor_total: decimal,
  quilometragem: z.number().int(), data_abastecimento: date, criado_em: timestamp.nullable(), posto: z.string().nullable() });
export const abastecimentosSchemas = {
  Abastecimento: abastecimento, RespostaAbastecimento: dados(abastecimento),
  Abastecimentos: dados(z.array(abastecimento.extend({ veiculo_placa: z.string().nullable(), motorista_nome: z.string().nullable() }))),
  CriarAbastecimento: z.object({ veiculo_id: z.union([z.number(),z.string()]), motorista_id: z.union([z.number(),z.string()]).nullish(),
    posto: z.string().nullish(), litragem: z.union([z.number(),z.string()]), valor_total: z.union([z.number(),z.string()]),
    quilometragem: z.number().nullish(), data_abastecimento: z.string() })
    .describe('Legado valida somente truthiness de veículo/litragem/valor/data; tipos/coerções/constraints são do banco. Ausência de motorista/km passa pelo controller mas falha NOT NULL (500). Schema documenta a forma usual, não endurece entrada.'),
};
