import { z } from 'zod';
import { meta } from '../../shared/contract/schemas.js';
import { dataHoraInstitucionalSchema } from '../solicitacoes/solicitacoes.datas.js';

export const manutencaoId = z.string().max(20).regex(/^-?[0-9]+$/)
  .refine(id => {
    if (!/^-?[0-9]{1,19}$/.test(id)) return false;
    const n = BigInt(id);
    return n >= -9223372036854775808n && n <= 9223372036854775807n;
  }, 'Identificador fora da faixa BIGINT.');
export const tipoManutencao = z.enum(['PREVENTIVA', 'CORRETIVA']);
export const statusManutencao = z.enum(['AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']);
export const eventoManutencao = z.enum(['CONCLUSAO', 'CORRECAO_DATAS', 'REABERTURA', 'CANCELAMENTO', 'REATIVACAO']);
const dataCivil = z.iso.date().refine(date => !date.startsWith('0000-'), 'Ano inválido.');
const instante = dataHoraInstitucionalSchema;
const decimal = z.string().regex(/^[0-9]{1,131072}(?:\.[0-9]{1,16383})?$/);
const descricao = z.string().trim().min(1).max(2000);
const prestador = z.string().trim().min(1).max(255).nullable();
const observacoes = z.string().trim().min(1).max(2000).nullable();
const quilometragem = z.number().int().min(0).max(2147483647);
const campos = z.strictObject({
  tipo: tipoManutencao, descricao, entrada: dataCivil, conclusaoPrevista: dataCivil,
  quilometragem, prestador: prestador.optional(), custo: decimal.nullable().optional(), observacoes: observacoes.optional(),
});

export const cadastrarManutencao = campos.extend({
  veiculoId: manutencaoId, iniciarImediatamente: z.boolean().optional(),
}).refine(v => v.entrada <= v.conclusaoPrevista, { path: ['conclusaoPrevista'], message: 'Previsão anterior à entrada.' })
  .refine(v => !v.iniciarImediatamente || v.tipo === 'CORRETIVA', {
    path: ['iniciarImediatamente'], message: 'Somente manutenção corretiva pode iniciar imediatamente.',
  });
const camposEditaveis = campos.partial();
export const editarManutencao = camposEditaveis.extend({
  iniciadaEm: instante.optional(), concluidaEm: instante.optional(),
}).refine(v => Object.keys(v).length > 0, 'Informe ao menos um campo.');
const alteracoes = camposEditaveis.optional();
const destino = z.enum(['AGENDADA', 'EM_ANDAMENTO']);
export const transicaoManutencao = z.discriminatedUnion('acao', [
  z.strictObject({ acao: z.literal('INICIAR'), alteracoes }),
  z.strictObject({ acao: z.literal('CONCLUIR'), alteracoes }),
  z.strictObject({ acao: z.literal('CANCELAR'), alteracoes }),
  z.strictObject({ acao: z.literal('REABRIR'), destino, alteracoes }),
  z.strictObject({ acao: z.literal('REATIVAR'), destino, alteracoes }),
]);

const natural = z.string().regex(/^[1-9][0-9]*$/).refine(s => Number.isSafeInteger(Number(s)));
const pagina = z.strictObject({ page: natural.optional(), limit: natural.refine(s => Number(s) <= 100).optional() });
export const consultaHistoricoManutencao = pagina;
export const consultaManutencaoVeiculo = pagina.extend({
  tipo: tipoManutencao.optional(), status: statusManutencao.optional(), inicio: dataCivil.optional(),
  fim: dataCivil.optional(), q: z.string().trim().min(1).max(255).optional(),
});
export const consultaManutencao = consultaManutencaoVeiculo.extend({ veiculoId: manutencaoId.optional() });

const tokenVersao = z.string().regex(/^"[A-Za-z0-9_-]{36}"$/).refine(token => {
  const raw = token.slice(1, -1);
  const bytes = Buffer.from(raw, 'base64url');
  const instante = bytes.toString('utf8');
  return bytes.toString('base64url') === raw &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(instante) &&
    dataHoraInstitucionalSchema.safeParse(instante).success;
}, 'Versão inválida.');
export const ifMatchManutencao = tokenVersao;
const resumo = z.strictObject({
  id: manutencaoId, veiculo: z.strictObject({ id: manutencaoId, placa: z.string(), vinculo: z.enum(['PROPRIO', 'LOCADO']) }),
  tipo: tipoManutencao, descricao: z.string(), status: statusManutencao, entrada: dataCivil, conclusaoPrevista: dataCivil,
  prestador, custo: decimal.nullable(), atrasada: z.boolean(),
});
const detalhe = resumo.extend({
  quilometragem, observacoes, iniciadaEm: instante.nullable(), concluidaEm: instante.nullable(),
  canceladaEm: instante.nullable(), criadoEm: instante, atualizadoEm: instante, versao: tokenVersao,
});
const snapshot = z.strictObject({
  entrada: dataCivil, conclusaoPrevista: dataCivil, iniciadaEm: instante.nullable(),
  concluidaEm: instante.nullable(), canceladaEm: instante.nullable(),
});
const evento = z.strictObject({
  id: manutencaoId, manutencaoId, evento: eventoManutencao, statusAnterior: statusManutencao, statusPosterior: statusManutencao,
  anterior: snapshot, posterior: snapshot, autorId: manutencaoId, registradoEm: instante,
});
export const consultaIndicadoresManutencao = z.strictObject({
  inicio: dataCivil.optional(), fim: dataCivil.optional(),
  veiculoId: manutencaoId.optional(), tipo: tipoManutencao.optional(),
}).refine(f => !f.inicio || !f.fim || f.inicio <= f.fim, { path: ['fim'], message: 'Período invertido.' });
export type FiltrosIndicadores = z.infer<typeof consultaIndicadoresManutencao>;

const contagem = z.number().int().nonnegative();
const itemAlerta = z.strictObject({
  id: manutencaoId, veiculo: z.strictObject({ id: manutencaoId, placa: z.string() }),
  tipo: tipoManutencao, status: z.enum(['AGENDADA','EM_ANDAMENTO']),
  entrada: dataCivil, conclusaoPrevista: dataCivil,
});
const grupoAlertas = z.strictObject({
  total: contagem, limite: z.literal(20),
  itens: z.array(itemAlerta).refine(itens => itens.length <= 20).describe('No máximo 20 itens, em ordem determinística.'),
});
export const indicadoresManutencao = z.strictObject({ data: z.strictObject({
  referencia: z.strictObject({ instante, dataCivil, fuso: z.literal('America/Maceio') }),
  filtros: z.strictObject({ veiculoId: manutencaoId.nullable(), tipo: tipoManutencao.nullable() }),
  estoqueAtual: z.strictObject({
    veiculosEmManutencao: contagem, agendadas: contagem, emAndamento: contagem, atrasadas: contagem,
  }),
  periodo: z.strictObject({
    inicio: dataCivil.nullable(), fim: dataCivil.nullable(), fimExclusivo: z.union([instante, z.string().regex(/^\+010000-01-01T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/)]).nullable(),
    criterioConcluidas: z.literal('CONCLUSAO_EFETIVA'), criterioCusto: z.literal('ENTRADA_PLANEJADA'),
    concluidas: contagem,
    custo: z.strictObject({ totalConhecido: decimal.nullable(), comCustoInformado: contagem, comCustoDesconhecido: contagem }),
  }),
  alertas: z.strictObject({
    preventivasProximos7Dias: grupoAlertas.extend({ inicio: dataCivil, fimExclusivo: dataCivil }),
    atrasos: grupoAlertas,
  }),
}) });

export const manutencoesSchemas = {
  IndicadoresManutencao: indicadoresManutencao,
  CadastroManutencao: cadastrarManutencao,
  EditarManutencao: editarManutencao,
  TransicaoManutencao: transicaoManutencao,
  RespostaManutencao: z.strictObject({ data: detalhe }),
  ListaManutencoes: z.strictObject({ data: z.array(resumo), meta }),
  HistoricoManutencao: z.strictObject({ data: z.array(evento), meta }),
};

export type Cadastro = z.infer<typeof cadastrarManutencao>;
export type Edicao = z.infer<typeof editarManutencao>;
export type Transicao = z.infer<typeof transicaoManutencao>;
export type Filtros = z.infer<typeof consultaManutencao>;
export type Status = z.infer<typeof statusManutencao>;
export type Evento = z.infer<typeof evento>;
export type LinhaManutencao = Omit<z.infer<typeof detalhe>, 'versao'>;
export type Paginacao = { page: number; limit: number };
