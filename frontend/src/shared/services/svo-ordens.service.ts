import { svoOperacionalSchemas as operacional } from '../../../../backend/src/modules/svo/svo.operacional.schemas';
import { svoConsultasSchemas as consultas } from '../../../../backend/src/modules/svo/svo.consultas.schemas';
import { executeApi } from '../api/client';
import { ApiError } from '../api/errors';
import { parseResponse } from '../api/validation';
import type { ApiSchemas } from '../api/generated/schema';

export type MinhaOrdem = ApiSchemas['MinhaOrdemSvo'];
export type AcaoColeta = { tipo: 'iniciar' | 'concluir'; km: number } | { tipo: 'etapa' | 'cancelar' };

// Estes contratos exigem um documento JSON inclusive após uma transição confirmada.
function exigirResposta<T>(valor: T | undefined): T {
  if (valor === undefined)
    throw new ApiError(
      204,
      'RESPOSTA_INVALIDA',
      'O servidor não retornou os dados esperados. Consulte a ordem novamente.',
    );
  return valor;
}

/** A seleção das ordens é feita pelo backend a partir do vínculo da sessão. */
export function minhasOrdens(signal?: AbortSignal) {
  return executeApi('svo_get__api_svo_ordens_coleta_minhas', {
    signal,
    parse: (value) => parseResponse(operacional.MinhasOrdensSvo, value),
  }).then(exigirResposta);
}

/** A rota da equipe nunca recorre ao detalhe administrativo para uma ordem alheia. */
export function minhaOrdem(id: string, signal?: AbortSignal) {
  return executeApi('svo_get__api_svo_ordens_coleta_minhas_id_', {
    id,
    signal,
    parse: (value) => {
      const ordem = parseResponse(operacional.MinhaOrdemSvo, value);
      if (ordem.id !== id) throw new Error('Ordem incompatível.');
      return ordem;
    },
  }).then(exigirResposta);
}

/** Consulta eventos persistidos na ordem cronológica e paginação do contrato. */
export function historicoSvo(tipo: 'ordem' | 'solicitacao', id: string, page: number, signal?: AbortSignal) {
  const operation =
    tipo === 'ordem'
      ? 'svo_get__api_svo_ordens_coleta_id_historico'
      : 'svo_get__api_svo_solicitacoes_id_historico';
  return executeApi(operation, {
    id,
    signal,
    query: new URLSearchParams({ page: String(page), limit: '20' }),
    parse: (value) => {
      const result = parseResponse(consultas.HistoricoSvo, value);
      if (result.meta.page !== page) throw new Error('Página incompatível.');
      return result;
    },
  }).then(exigirResposta);
}

/** Disponibiliza somente a próxima ação compatível com o estado persistido. */
export function proximaEtapa(ordem: MinhaOrdem) {
  if (ordem.status === 'EM_DESLOCAMENTO') return ordem.dataInicio === null ? 'iniciar' : 'etapa';
  if (ordem.status === 'EM_TRANSPORTE' && ordem.dataInicio && ordem.kmInicial !== null) return 'concluir';
  return null;
}

/** Envia uma única transição e confere ordem e resultado antes de confirmar. */
export function alterarColeta(id: string, acao: AcaoColeta) {
  const estados = {
    iniciar: 'EM_DESLOCAMENTO',
    etapa: 'EM_TRANSPORTE',
    concluir: 'CONCLUIDA',
    cancelar: 'CANCELADA',
  };
  const parse = (value: unknown) => {
    const result = parseResponse(operacional.OrdemExecucaoSvo, value);
    if (result.id !== id || result.status !== estados[acao.tipo]) throw new Error('Transição incompatível.');
    return result;
  };
  switch (acao.tipo) {
    case 'iniciar':
      return executeApi('svo_patch__api_svo_ordens_coleta_id_iniciar', {
        id,
        parse,
        body: { kmInicial: acao.km },
      }).then(exigirResposta);
    case 'etapa':
      return executeApi('svo_patch__api_svo_ordens_coleta_id_etapa', { id, parse }).then(exigirResposta);
    case 'concluir':
      return executeApi('svo_patch__api_svo_ordens_coleta_id_concluir', {
        id,
        parse,
        body: { kmFinal: acao.km },
      }).then(exigirResposta);
    case 'cancelar':
      return executeApi('svo_patch__api_svo_ordens_coleta_id_cancelar', { id, parse, body: {} }).then(
        exigirResposta,
      );
  }
}
