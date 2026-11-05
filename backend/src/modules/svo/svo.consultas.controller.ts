import type { ServerResponse } from 'node:http';
import { enviarJson } from '../../shared/http/json.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import {
  consultaSvoFiltroSolicitacoes, consultaSvoFiltroOrdens,
  consultaSvoPaginacao, parsePaginacao,
} from './svo.consultas.schemas.js';
import {
  consultarSolicitacoesPaginadas, consultarOrdensPaginadas,
  consultarSolicitacaoDetalhada, consultarOrdemDetalhada, consultarHistoricoSvo,
} from './svo.consultas.repository.js';

/** Rejeita chaves repetidas e não declaradas para evitar filtros ambíguos. */
function parametros(params: URLSearchParams): Record<string, string> | null {
  const resultado: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [key, value] of params.entries()) {
    if (Object.hasOwn(resultado, key)) return null;
    resultado[key] = value;
  }
  return resultado;
}

function erroConsulta(response: ServerResponse, erro: unknown): void {
  registrarFalha(erro);
  enviarJson(response, 500, {
    error: { code: 'ERRO_INTERNO', message: 'Não foi possível consultar os registros SVO.' },
  });
}

/** Endpoint novo, preservando o GET legado que devolve array direto. */
export async function listarSolicitacoesPaginadasController(response: ServerResponse, params: URLSearchParams): Promise<void> {
  const raw = parametros(params);
  const parsed = raw === null ? null : consultaSvoFiltroSolicitacoes.safeParse(raw);
  if (!parsed?.success) {
    enviarJson(response, 400, { erro: 'Filtros da solicitação inválidos.' });
    return;
  }
  const paginacao = parsePaginacao(parsed.data);
  if (!paginacao) {
    enviarJson(response, 400, { erro: 'Paginação inválida.' });
    return;
  }
  try {
    enviarJson(response, 200, await consultarSolicitacoesPaginadas({ ...paginacao,
      status: parsed.data.status, inicio: parsed.data.inicio, fim: parsed.data.fim }));
  } catch (erro) { erroConsulta(response, erro); }
}

export async function listarOrdensPaginadasController(response: ServerResponse, params: URLSearchParams): Promise<void> {
  const raw = parametros(params);
  const parsed = raw === null ? null : consultaSvoFiltroOrdens.safeParse(raw);
  if (!parsed?.success) {
    enviarJson(response, 400, { erro: 'Filtros da ordem inválidos.' });
    return;
  }
  const paginacao = parsePaginacao(parsed.data);
  if (!paginacao) {
    enviarJson(response, 400, { erro: 'Paginação inválida.' });
    return;
  }
  try {
    enviarJson(response, 200, await consultarOrdensPaginadas({ ...paginacao, status: parsed.data.status }));
  } catch (erro) { erroConsulta(response, erro); }
}

/** Consultas por ID exigem JWT ATENDENTE_SVO no roteador, sem efeito colateral. */
export async function detalharSvoController(response: ServerResponse, id: string,
  tipo: 'solicitacao' | 'ordem', params: URLSearchParams): Promise<void> {
  if ([...params.keys()].length) {
    enviarJson(response, 400, { erro: 'Parâmetros não permitidos.' });
    return;
  }
  try {
    const registro = tipo === 'solicitacao'
      ? await consultarSolicitacaoDetalhada(id) : await consultarOrdemDetalhada(id);
    if (!registro) {
      enviarJson(response, 404, { erro: tipo === 'solicitacao' ? 'Solicitação não encontrada.' : 'Ordem não encontrada.' });
      return;
    }
    enviarJson(response, 200, registro);
  } catch (erro) { erroConsulta(response, erro); }
}

export async function historicoSvoController(response: ServerResponse, id: string,
  tipo: 'solicitacao' | 'ordem', params: URLSearchParams): Promise<void> {
  const raw = parametros(params);
  const parsed = raw === null ? null : consultaSvoPaginacao.safeParse(raw);
  if (!parsed?.success) {
    enviarJson(response, 400, { erro: 'Filtros do histórico inválidos.' });
    return;
  }
  const paginacao = parsePaginacao(parsed.data);
  if (!paginacao) {
    enviarJson(response, 400, { erro: 'Paginação inválida.' });
    return;
  }
  try {
    const historico = await consultarHistoricoSvo(id, tipo, paginacao);
    if (!historico) {
      enviarJson(response, 404, { erro: tipo === 'solicitacao' ? 'Solicitação não encontrada.' : 'Ordem não encontrada.' });
      return;
    }
    enviarJson(response, 200, historico);
  } catch (erro) { erroConsulta(response, erro); }
}
