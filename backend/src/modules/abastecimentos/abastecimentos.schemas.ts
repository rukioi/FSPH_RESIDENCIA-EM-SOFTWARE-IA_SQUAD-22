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
    .describe('Forma usual de transporte. #30 classifica JSON/tipo/campo incompatível com o schema atual como 400 e FK inexistente como 404. Motorista/km omitidos ou nulos recebem 400 pelo NOT NULL atual; RF40 permanece adiado, sem migration. Validação técnica de calendário e tipos ocorre no controller.'),
};
