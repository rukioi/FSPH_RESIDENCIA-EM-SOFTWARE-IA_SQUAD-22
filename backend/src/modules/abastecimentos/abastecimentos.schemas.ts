import { z } from 'zod';
import { id, date, timestamp, decimal, dados } from '../../shared/contract/schemas.js';
const abastecimento = z.object({ id, veiculo_id: id, motorista_id: id.nullable(), litragem: decimal, valor_total: decimal,
  quilometragem: z.number().int().nullable(), data_abastecimento: date, criado_em: timestamp.nullable(), posto: z.string().nullable(), tanque_completo: z.boolean(), comprovante_nome: z.string().nullable() });
export const identificadorAbastecimento = z.union([z.number().int().safe(), z.string().regex(/^-?\d+$/)])
  .refine(v => (typeof v==='number' ? Number.isSafeInteger(v) : /^-?\d{1,19}$/.test(v)) &&
    BigInt(v) !== 0n && BigInt(v) >= -9223372036854775808n && BigInt(v) <= 9223372036854775807n);
export const dataCivilAbastecimento = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v =>
  v >= '0001-01-01' && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
const positivoDecimal = z.union([z.number().positive().max(99999999.99), z.string().regex(/^\d{1,8}(\.\d{1,2})?$/)])
  .refine(v => Number(v) > 0 && /^\d{1,8}(\.\d{1,2})?$/.test(String(v)), 'Use valor positivo com até duas casas decimais.');
const comprovante = z.object({nome:z.string().min(1).max(255),tipo:z.enum(['image/jpeg','image/png']),dadosBase64:z.string().max(1398104)}).nullish();

export const criarAbastecimentoSchema = z.object({
  veiculo_id: identificadorAbastecimento, motorista_id: identificadorAbastecimento.nullish(),
  posto:z.string().max(255).nullish(), litragem:positivoDecimal, valor_total:positivoDecimal,
  quilometragem:z.number().int().min(0).max(2147483647).nullish(), data_abastecimento:dataCivilAbastecimento,
  tanque_completo:z.boolean().optional(), comprovante,
}).describe('RF40/SCRUM-186: motorista, km e posto opcionais. Litros/valor positivos numeric(10,2); km inteiro não negativo. Autoria sempre da sessão; campos extras ignorados. Comprovante legado JPEG/PNG mantém validação de assinatura no service.');


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

export const indicadoresAbastecimentosAntesDeConsumo = dados(z.object({
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

const consumoMedido = z.object({
  estado: z.literal('DISPONIVEL'), valor: decimal, motivo: z.null(),
  trechosValidos: quantidade,
});
const consumoInsuficiente = z.object({
  estado: z.literal('DADOS_INSUFICIENTES'), valor: z.null(), motivo: z.literal('SEM_TRECHO_VALIDO'),
  trechosValidos: z.literal(0),
});
const porVeiculo = z.array(z.discriminatedUnion('estado', [
  consumoMedido.extend({ veiculoId: id }),
  consumoInsuficiente.extend({ veiculoId: id }),
]));
const consumoPorDistancia = z.discriminatedUnion('estado', [
  consumoMedido.extend({ unidade: z.literal('km/L'), porVeiculo }),
  consumoInsuficiente.extend({ unidade: z.literal('km/L'), porVeiculo }),
]);

export const indicadoresAbastecimentos = indicadoresAbastecimentosAntesDeConsumo.extend({
  data: indicadoresAbastecimentosAntesDeConsumo.shape.data.extend({ consumoPorDistancia }),
});

export const notaIndicadoresAntesDeConsumo = 'SCRUM-188: agregação de registros reais no período civil inclusivo, com filtro por veículo. Consumo por distância indisponível até definição da regra.';
export const notaIndicadoresAbastecimentos = 'SCRUM-188: agregação de registros reais no período civil inclusivo, com filtro por veículo. Consumo cheio a cheio em km/L, com insuficiência explícita.';

export const abastecimentosSchemas = {
  IndicadoresAbastecimentos: indicadoresAbastecimentos,
  ComprovanteAbastecimento: z.string(), Abastecimento: abastecimento, RespostaAbastecimento: dados(abastecimento),
  Abastecimentos: dados(z.array(abastecimento.extend({ veiculo_placa: z.string().nullable(), motorista_nome: z.string().nullable() }))),
  CriarAbastecimento: z.object({ veiculo_id: z.union([z.number(),z.string()]), motorista_id: z.union([z.number(),z.string()]).nullish(),
    posto: z.string().nullish(), litragem: z.union([z.number(),z.string()]), valor_total: z.union([z.number(),z.string()]),
    quilometragem: z.number().nullish(), data_abastecimento: z.string(), tanque_completo: z.boolean().optional(),
    comprovante: z.object({ nome: z.string().min(1).max(255), tipo: z.enum(['image/jpeg','image/png']), dadosBase64: z.string().max(1398104) }).nullish() })
    .describe('Forma usual de transporte. Motorista e quilometragem são opcionais; litros e valor devem ser positivos, quilometragem não negativa e data válida. A autoria é registrada a partir da sessão.'),
};
