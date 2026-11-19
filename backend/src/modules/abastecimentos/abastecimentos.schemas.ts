import { z } from 'zod';
import { id, date, timestamp, decimal, dados, meta } from '../../shared/contract/schemas.js';
const abastecimento = z.object({ id, veiculo_id: id, motorista_id: id, litragem: decimal, valor_total: decimal,
  quilometragem: z.number().int(), data_abastecimento: date, criado_em: timestamp.nullable(), posto: z.string().nullable(), tanque_completo: z.boolean(), comprovante_nome: z.string().nullable() });
const quantidade = z.number().int().nonnegative();
// NUMERIC(10,2) arredonda no PostgreSQL. Compare 0.005 exatamente, sem transformar
// strings decimais em float (0.004999… não pode virar 0.005 por perda de precisão).
const valorPositivo = z.union([z.number(), z.string()]).refine(valor => {
  const texto = String(valor).trim();
  if (!/^\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(texto)
    || !Number.isFinite(Number(texto))) return false;
  const [mantissa, expoente = '0'] = texto.replace(/^\+/, '').toLowerCase().split('e');
  const [inteiro, fracao = ''] = mantissa.split('.');
  const digitos = (inteiro + fracao).replace(/^0+/, '');
  if (!digitos) return false;
  const ordem = digitos.length - fracao.length + Number(expoente);
  return ordem > -2 || ordem === -2 && digitos[0] >= '5';
});
const dataCivilIndicadores = z.iso.date().refine(data => data >= '0001-01-01');
const veiculoIndicadores = z.string().regex(/^[1-9]\d{0,18}$/)
  .refine(valor => /^[1-9]\d{0,18}$/.test(valor) && BigInt(valor) <= 9223372036854775807n);

export const identificadorAbastecimento = veiculoIndicadores;
export const dataCivilAbastecimento = dataCivilIndicadores;
const detalheAbastecimento = abastecimento.extend({ veiculo_placa: z.string().nullable(), motorista_nome: z.string().nullable() });
export const parametrosAbastecimentos = [
  { name: 'veiculoId', required: false, schema: identificadorAbastecimento },
  { name: 'inicio', required: false, schema: dataCivilAbastecimento },
  { name: 'fim', required: false, schema: dataCivilAbastecimento },
  { name: 'pagina', required: false, schema: z.string().regex(/^[1-9]\d*$/) },
  { name: 'limit', required: false, schema: z.string().regex(/^[1-9]\d*$/).describe('Máximo 100.') },
];
export const notasListagemAbastecimentos = 'SCRUM-186: sem filtros preserva lista completa por id DESC; filtros reconhecidos ativam paginação por data DESC/id DESC. Período civil inclusivo. Parâmetros desconhecidos continuam ignorados.';

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
  DetalheAbastecimento: detalheAbastecimento,
  RespostaDetalheAbastecimento: dados(detalheAbastecimento),
  ListaAbastecimentos: dados(z.array(detalheAbastecimento)).extend({ meta: meta.optional() }),
  HistoricoAbastecimentos: dados(z.array(detalheAbastecimento)).extend({ meta }),
  IndicadoresAbastecimentos: indicadoresAbastecimentos,
  ComprovanteAbastecimento: z.string(), Abastecimento: abastecimento, RespostaAbastecimento: dados(abastecimento),
  Abastecimentos: dados(z.array(abastecimento.extend({ veiculo_placa: z.string().nullable(), motorista_nome: z.string().nullable() }))),
  CriarAbastecimento: z.object({ veiculo_id: z.union([z.number(),z.string()]), motorista_id: z.union([z.number(),z.string()]),
    posto: z.string().nullish(), litragem: valorPositivo, valor_total: valorPositivo,
    quilometragem: z.number().int().nonnegative(), data_abastecimento: z.string(), tanque_completo: z.boolean().optional(),
    comprovante: z.object({ nome: z.string().min(1).max(255), tipo: z.enum(['image/jpeg','image/png']), dadosBase64: z.string().max(1398104) }).nullish() })
    .describe('Caso B confirmado pelo responsável: quilometragem inteira obrigatória, nunca nula ou negativa. Ausência/null/valor negativo recebe 400; leitura inferior à anterior ou incompatível com viagem corrigida recebe 409. Igualdade não é regressão. Motorista obrigatório: ausência/null recebe 400 e ID inexistente recebe 404. Litros e valor devem ser decimais finitos e permanecer positivos após arredondamento NUMERIC(10,2): mínimo 0.005; inválidos recebem 400. O PostgreSQL mantém o arredondamento e o limite superior da coluna, sem conversão monetária no JavaScript. Cadastro e atividade do ator autenticado são atômicos; autoria enviada no corpo não é utilizada. Demais validações de calendário e tipos permanecem no controller.'),
};
