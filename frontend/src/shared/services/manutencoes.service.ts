import { z } from 'zod';
import { executeApi, requestApi } from '../api/client';
import { apiOperations } from '../api/generated/operations';
import type { ApiSchemas } from '../api/generated/schema';
import { parseResponse } from '../api/validation';
import { dataHoraInstitucionalSchema as instante } from '../../../../backend/src/modules/solicitacoes/solicitacoes.datas';

export type Detalhe = ApiSchemas['RespostaManutencao']['data'];
export type Resumo = ApiSchemas['ListaManutencoes']['data'][number];
export type Evento = ApiSchemas['HistoricoManutencao']['data'][number];
export type Cadastro = ApiSchemas['CadastroManutencao'];
export type Edicao = ApiSchemas['EditarManutencao'];
export type Transicao = ApiSchemas['TransicaoManutencao'];
export type Tipo = Resumo['tipo'];
export type Status = Resumo['status'];
export type Filtros = { veiculoId: string; tipo: Tipo | ''; status: Status | ''; inicio: string; fim: string; q: string };
export const filtrosIniciais: Filtros = { veiculoId: '', tipo: '', status: '', inicio: '', fim: '', q: '' };

import { idValido } from '../api/bigint';
export { idValido } from '../api/bigint';
const id = z.string().refine(idValido);
export const dataCivil = z.iso.date().refine(value => !value.startsWith('0000-'));
export const decimal = z.string().regex(/^[0-9]{1,131072}(?:\.[0-9]{1,16383})?$/);
const tipo = z.enum(['PREVENTIVA', 'CORRETIVA']);
const status = z.enum(['AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']);
const snapshot = z.strictObject({
  entrada: dataCivil, conclusaoPrevista: dataCivil,
  iniciadaEm: instante.nullable(), concluidaEm: instante.nullable(), canceladaEm: instante.nullable(),
});
const resumo = snapshot.pick({entrada: true, conclusaoPrevista: true}).extend({
  id, veiculo: z.strictObject({id, placa: z.string(), vinculo: z.enum(['PROPRIO', 'LOCADO'])}),
  tipo, descricao: z.string(), status, prestador: z.string().trim().min(1).max(255).nullable(),
  custo: decimal.nullable(), atrasada: z.boolean(),
});
const detalhe = resumo.extend({
  ...snapshot.shape, criadoEm: instante, atualizadoEm: instante,
  observacoes: z.string().trim().min(1).max(2000).nullable(),
  quilometragem: z.number().int().min(0).max(2147483647),
  versao: z.string().regex(/^"[A-Za-z0-9_-]{36}"$/),
});
const evento = z.strictObject({
  id, manutencaoId: id, autorId: id, registradoEm: instante,
  evento: z.enum(['CONCLUSAO', 'CORRECAO_DATAS', 'REABERTURA', 'CANCELAMENTO', 'REATIVACAO']),
  statusAnterior: status, statusPosterior: status, anterior: snapshot, posterior: snapshot,
});
const meta = z.strictObject({page: z.number().int().positive(), limit: z.number().int().min(1).max(100), total: z.number().int().nonnegative()});
const listaSchema = z.strictObject({data: z.array(resumo), meta});
const detalheSchema = z.strictObject({data: detalhe});
const historicoSchema = z.strictObject({data: z.array(evento), meta});

export function consultaManutencoes(page: number, filtros: Partial<Filtros> = {}) {
  const query = new URLSearchParams({page: String(page), limit: '20'});
  for (const chave of ['veiculoId', 'tipo', 'status', 'inicio', 'fim', 'q'] as const) {
    const valor = filtros[chave]?.trim();
    if (valor) query.set(chave, valor);
  }
  return query;
}

export function listarManutencoes(page: number, filtros: Filtros, signal?: AbortSignal) {
  return executeApi('manutencoes_get__api_manutencoes', {
    query: consultaManutencoes(page, filtros), signal, parse: value => parseResponse(listaSchema, value),
  });
}

export function listarManutencoesVeiculo(id: string, page: number, signal?: AbortSignal) {
  return executeApi('manutencoes_get__api_veiculos_id_manutencoes', {
    id, query: consultaManutencoes(page), signal, parse: value => parseResponse(listaSchema, value),
  });
}

export function historicoManutencao(id: string, page: number, signal?: AbortSignal) {
  return executeApi('manutencoes_get__api_manutencoes_id_historico', {
    id, query: consultaManutencoes(page), signal, parse: value => parseResponse(historicoSchema, value),
  });
}

export async function consultarManutencao(id: string, signal?: AbortSignal): Promise<Detalhe> {
  return (await executeApi('manutencoes_get__api_manutencoes_id_', {
    id, signal, parse: value => parseResponse(detalheSchema, value),
  })).data;
}

export async function cadastrarManutencao(body: Cadastro, signal?: AbortSignal): Promise<Detalhe> {
  return (await executeApi('manutencoes_post__api_manutencoes', {
    body, signal, parse: value => parseResponse(detalheSchema, value),
  })).data;
}

async function atualizar(id: string, versao: string, body: Edicao | Transicao, signal?: AbortSignal) {
  const binding = 'acao' in body ? apiOperations.manutencoes_patch__api_manutencoes_id_status
    : apiOperations.manutencoes_patch__api_manutencoes_id_;
  const resposta = await requestApi(binding.path.replace('{id}', encodeURIComponent(id)), {
    method: binding.method, signal,
    headers: {'Content-Type': 'application/json', 'If-Match': versao}, body: JSON.stringify(body),
  }, value => parseResponse(detalheSchema, value));
  return resposta.data;
}

export function editarManutencao(id: string, versao: string, body: Edicao, signal?: AbortSignal) {
  return atualizar(id, versao, body, signal);
}

export function transitarManutencao(id: string, versao: string, body: Transicao, signal?: AbortSignal) {
  return atualizar(id, versao, body, signal);
}

export type Indicadores = ApiSchemas['IndicadoresManutencao']['data'];
export type FiltrosIndicadores = Pick<Filtros,'veiculoId'|'tipo'|'inicio'|'fim'>;

const quantidade = z.number().int().nonnegative();
const itemAlerta = z.strictObject({
  id, veiculo:z.strictObject({id,placa:z.string()}), tipo,
  status:z.enum(['AGENDADA','EM_ANDAMENTO']), entrada:dataCivil, conclusaoPrevista:dataCivil,
});
const grupoAlerta = z.strictObject({total:quantidade, limite:z.literal(20), itens:z.array(itemAlerta).max(20)});
const indicadoresSchema = z.strictObject({data:z.strictObject({
  referencia:z.strictObject({instante,dataCivil,fuso:z.literal('America/Maceio')}),
  filtros:z.strictObject({veiculoId:id.nullable(),tipo:tipo.nullable()}),
  estoqueAtual:z.strictObject({veiculosEmManutencao:quantidade,agendadas:quantidade,emAndamento:quantidade,atrasadas:quantidade}),
  periodo:z.strictObject({
    inicio:dataCivil.nullable(),fim:dataCivil.nullable(),
    fimExclusivo:z.union([instante,z.string().regex(/^\+010000-01-01T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/)]).nullable(),
    criterioConcluidas:z.literal('CONCLUSAO_EFETIVA'),criterioCusto:z.literal('ENTRADA_PLANEJADA'),
    concluidas:quantidade,custo:z.strictObject({totalConhecido:decimal.nullable(),comCustoInformado:quantidade,comCustoDesconhecido:quantidade}),
  }),
  alertas:z.strictObject({preventivasProximos7Dias:grupoAlerta.extend({inicio:dataCivil,fimExclusivo:dataCivil}),atrasos:grupoAlerta}),
})});

export async function consultarIndicadoresManutencao(filtros: FiltrosIndicadores, signal: AbortSignal): Promise<Indicadores> {
  const query = new URLSearchParams();
  for (const chave of ['veiculoId','tipo','inicio','fim'] as const) if (filtros[chave]) query.set(chave,filtros[chave]);
  const resposta = await executeApi('manutencoes_get__api_manutencoes_indicadores',{
    query,signal,parse:value=>parseResponse(indicadoresSchema,value),
  });
  return resposta.data;
}
