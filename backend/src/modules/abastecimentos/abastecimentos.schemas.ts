import { z } from 'zod';
import { id, date, timestamp, decimal, dados } from '../../shared/contract/schemas.js';
const abastecimento = z.object({ id, veiculo_id: id, motorista_id: id, litragem: decimal, valor_total: decimal,
  quilometragem: z.number().int(), data_abastecimento: date, criado_em: timestamp.nullable(), posto: z.string().nullable(), tanque_completo: z.boolean(), comprovante_nome: z.string().nullable() });
const quantidade = z.number().int().nonnegative();
const dataCivilIndicadores = z.iso.date().refine(data => data >= '0001-01-01');
const veiculoIndicadores = z.string().regex(/^[1-9]\d{0,18}$/)
  .refine(valor => /^[1-9]\d{0,18}$/.test(valor) && BigInt(valor) <= 9223372036854775807n);

export const filtroIndicadoresAbastecimentos = z.strictObject({
  veiculoId: veiculoIndicadores.optional(),
  inicio: dataCivilIndicadores.optional(),
  fim: dataCivilIndicadores.optional(),
}).refine(f => !f.inicio || !f.fim || f.inicio <= f.fim);

export const parametrosIndicadoresAbastecimentos = [
  { name: 'veiculoId', required: false, schema: veiculoIndicadores },
  { name: 'inicio', required: false, schema: dataCivilIndicadores },
  { name: 'fim', required: false, schema: dataCivilIndicadores },
];

export const indicadoresAbastecimentos = dados(z.object({
  estado: z.enum(['DISPONIVEL', 'SEM_ABASTECIMENTOS']),
  quantidade, totalLitros: decimal, totalCusto: decimal, custoPorLitro: decimal.nullable(),
  periodoObservado: z.object({ inicio: dataCivilIndicadores.nullable(), fim: dataCivilIndicadores.nullable() }),
  kmObservadosPorVeiculo: z.array(z.object({
    veiculoId: id, leiturasComKm: quantidade, leiturasSemKm: quantidade,
    menorKm: z.number().int().nullable(), maiorKm: z.number().int().nullable(),
  })),
  consumoPorDistancia: z.object({
    valor: z.null(), estado: z.literal('INDISPONIVEL'), motivo: z.literal('REGRA_DE_NEGOCIO_PENDENTE'),
  }),
}));

export const abastecimentosSchemas = {
  IndicadoresAbastecimentos: indicadoresAbastecimentos,
  ComprovanteAbastecimento: z.string(), Abastecimento: abastecimento, RespostaAbastecimento: dados(abastecimento),
  Abastecimentos: dados(z.array(abastecimento.extend({ veiculo_placa: z.string().nullable(), motorista_nome: z.string().nullable() }))),
  CriarAbastecimento: z.object({ veiculo_id: z.union([z.number(),z.string()]), motorista_id: z.union([z.number(),z.string()]).nullish(),
    posto: z.string().nullish(), litragem: z.union([z.number(),z.string()]), valor_total: z.union([z.number(),z.string()]),
    quilometragem: z.number().nullish(), data_abastecimento: z.string(), tanque_completo: z.boolean().optional(),
    comprovante: z.object({ nome: z.string().min(1).max(255), tipo: z.enum(['image/jpeg','image/png']), dadosBase64: z.string().max(1398104) }).nullish() })
    .describe('Forma usual de transporte. #30 classifica JSON/tipo/campo incompatível com o schema atual como 400 e FK inexistente como 404. Motorista/km omitidos ou nulos recebem 400 pelo NOT NULL atual; RF40 permanece adiado, sem migration para alterar obrigatoriedade. Validação técnica de calendário e tipos ocorre no controller.'),
};
