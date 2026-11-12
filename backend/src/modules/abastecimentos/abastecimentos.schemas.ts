import { z } from 'zod';
import { id, date, timestamp, decimal, dados, meta } from '../../shared/contract/schemas.js';

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

const abastecimento = z.object({ id, veiculo_id:id, motorista_id:id.nullable(), litragem:decimal, valor_total:decimal,
  quilometragem:z.number().int().nullable(), data_abastecimento:date, criado_em:timestamp.nullable(), posto:z.string().nullable(),
  tanque_completo:z.boolean(), comprovante_nome:z.string().nullable(),
  criado_por_id:id.nullable().optional(),veiculo_placa:z.string().nullable().optional(),motorista_nome:z.string().nullable().optional() });
const detalhado = abastecimento.extend({veiculo_placa:z.string().nullable(),motorista_nome:z.string().nullable(),criado_por_id:id.nullable()});
const pagina = z.string().regex(/^[1-9]\d*$/);
export const parametrosAbastecimentos = [
  {name:'veiculoId',required:false,schema:z.string().regex(/^-?\d+$/)},
  {name:'inicio',required:false,schema:dataCivilAbastecimento}, {name:'fim',required:false,schema:dataCivilAbastecimento},
  {name:'pagina',required:false,schema:pagina}, {name:'limit',required:false,schema:pagina.describe('Máximo 100, padrão 20.')},
];
export const notasListagemAbastecimentos = 'Sem parâmetros reconhecidos: data[] completo por id DESC, compatível com legado. Com veículo/período/paginação: data[] por data_abastecimento DESC,id DESC e meta {page,limit,total}; pagina=1,limit=20,máximo100. Datas civis inclusivas; parâmetros reconhecidos duplicados/inválidos:400. Outros ignorados.';
export const notasCadastroAbastecimentos = 'RF40: motorista/km opcionais; positivo numeric(10,2). Autor da sessão, cadastro/comprovante legado/auditoria atômicos. 409 somente conflito transacional; não há chave de deduplicação definida.';
export const abastecimentosSchemas = {
  ComprovanteAbastecimento: z.string(), Abastecimento: abastecimento, RespostaAbastecimento: dados(abastecimento),
  Abastecimentos: dados(z.array(abastecimento.extend({ veiculo_placa: z.string().nullable(), motorista_nome: z.string().nullable() }))).extend({meta:meta.optional()}),
  // Mantém o DTO de transporte legado; as restrições RF40 estão no novo contrato de entrada.
  CriarAbastecimento: z.object({veiculo_id:z.union([z.number(),z.string()]),motorista_id:z.union([z.number(),z.string()]).nullish(),
    posto:z.string().nullish(),litragem:z.union([z.number(),z.string()]),valor_total:z.union([z.number(),z.string()]),
    quilometragem:z.number().nullish(),data_abastecimento:z.string(),tanque_completo:z.boolean().optional(),comprovante})
    .describe('DTO legado de transporte. A validação RF40 do servidor está em CriarAbastecimentoRF40; motorista/km podem ser omitidos ou nulos.'),
  CriarAbastecimentoRF40: criarAbastecimentoSchema,
  DetalheAbastecimento: detalhado,
  RespostaDetalheAbastecimento: dados(detalhado),
  ListaAbastecimentosRF40: dados(z.array(detalhado)).extend({meta:meta.optional()}),
  HistoricoAbastecimentos: dados(z.array(detalhado)).extend({meta}),
  IndicadoresAbastecimentos: dados(z.object({
    estado:z.enum(['DISPONIVEL','SEM_ABASTECIMENTOS']),quantidade:z.number().int().nonnegative(),
    totalLitros:decimal,totalCusto:decimal,custoPorLitro:decimal.nullable(),
    periodoObservado:z.object({inicio:dataCivilAbastecimento.nullable(),fim:dataCivilAbastecimento.nullable()}),
    kmObservadosPorVeiculo:z.array(z.object({veiculoId:id,leiturasComKm:z.number().int().nonnegative(),
      leiturasSemKm:z.number().int().nonnegative(),menorKm:z.number().int().nullable(),maiorKm:z.number().int().nullable()})),
    consumoPorDistancia:z.object({valor:z.null(),estado:z.literal('INDISPONIVEL'),motivo:z.literal('REGRA_DE_NEGOCIO_PENDENTE')}),
  })),
};
