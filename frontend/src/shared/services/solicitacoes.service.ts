
import type { z } from 'zod';

import {
  criarSolicitacaoSchema,
  editarSolicitacaoSchema,
  agendarSolicitacaoSchema,
  reagendarSolicitacaoSchema,
  rejeitarSolicitacaoSchema,
  solicitacoesSchemas,
  listarSolicitacoesSchema,
  statusSolicitacao,
} from '../../../../backend/src/modules/solicitacoes/solicitacoes.schemas';

import { requestApi } from '../api/client';
import { parseResponse } from '../api/validation';

// Tipos dos dados enviados para a API.
export type NovaSolicitacao = z.infer<typeof criarSolicitacaoSchema>;
export type DadosEdicaoSolicitacao = z.infer<typeof editarSolicitacaoSchema>;
export type DadosAgendamento = z.infer<typeof agendarSolicitacaoSchema>;
export type DadosReagendamento = z.infer<typeof reagendarSolicitacaoSchema>;
export type MotivoRejeicao = z.infer<typeof rejeitarSolicitacaoSchema>;
export type StatusSolicitacao = z.infer<typeof statusSolicitacao>;

// Tipos dos filtros.
export type FiltrosSolicitacoes = {
  page?: number;
  limit?: number;
  status?: StatusSolicitacao;
};

export type FiltrosAgenda = {
  inicio: string;
  fim: string;
  page?: number;
  limit?: number;
};

export type FiltrosDisponibilidade = {
  inicio: string;
  fim: string;
};

// Monta os parâmetros da URL sem enviar valores indefinidos.
function criarQuery(filtros: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();

  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor !== undefined) {
      params.set(chave, String(valor));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

// Monta o corpo JSON das requisições.
function corpoJson(dados: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  };
}

/** Cria uma solicitação vinculada ao usuário autenticado. */
export async function criarSolicitacao(dados: NovaSolicitacao) {
  const resposta = await requestApi(
    '/api/solicitacoes-viagem',
    corpoJson(dados),
    valor => parseResponse(
      solicitacoesSchemas.RespostaSolicitacaoViagem,
      valor,
    ),
  );

  return resposta.data;
}

/** Lista solicitações conforme o perfil e os filtros autorizados pelo backend. */
export async function listarSolicitacoes(filtros: FiltrosSolicitacoes = {}) {
  const query = criarQuery(filtros);

  return requestApi(
    `/api/solicitacoes-viagem${query}`,
    { method: 'GET' },
    valor => parseResponse(
      solicitacoesSchemas.ListaSolicitacoesViagem,
      valor,
    ),
  );
}

/** Consulta os detalhes de uma solicitação. */
export async function buscarDetalheSolicitacao(id: string) {
  const resposta = await requestApi(
    `/api/solicitacoes-viagem/${encodeURIComponent(id)}`,
    { method: 'GET' },
    valor => parseResponse(
      solicitacoesSchemas.RespostaDetalheSolicitacaoViagem,
      valor,
    ),
  );

  return resposta.data;
}

/** Consulta o histórico de uma solicitação. */
export async function buscarHistoricoSolicitacao(
  id: string,
  filtros: { page?: number; limit?: number } = {},
) {
  const query = criarQuery(filtros);

  return requestApi(
    `/api/solicitacoes-viagem/${encodeURIComponent(id)}/historico${query}`,
    { method: 'GET' },
    valor => parseResponse(
      solicitacoesSchemas.RespostaHistoricoSolicitacaoViagem,
      valor,
    ),
  );
}

/** Edita os campos permitidos pelo backend para o perfil Gestor/ADM. */
export async function editarSolicitacao(
  id: string,
  dados: DadosEdicaoSolicitacao,
) {
  const resposta = await requestApi(
    `/api/solicitacoes-viagem/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    },
    valor => parseResponse(
      solicitacoesSchemas.RespostaSolicitacaoViagem,
      valor,
    ),
  );

  return resposta.data;
}

/** Aprova uma solicitação pendente. */
export async function aprovarSolicitacao(id: string) {
  const resposta = await requestApi(
    `/api/solicitacoes-viagem/${encodeURIComponent(id)}/aprovar`,
    { method: 'POST' },
    valor => parseResponse(
      solicitacoesSchemas.RespostaDecisaoSolicitacaoViagem,
      valor,
    ),
  );

  return resposta.data;
}

/** Rejeita uma solicitação pendente com justificativa obrigatória. */
export async function rejeitarSolicitacao(
  id: string,
  motivo: string,
) {
  const resposta = await requestApi(
    `/api/solicitacoes-viagem/${encodeURIComponent(id)}/rejeitar`,
    corpoJson({ motivo }),
    valor => parseResponse(
      solicitacoesSchemas.RespostaDecisaoSolicitacaoViagem,
      valor,
    ),
  );

  return resposta.data;
}

/** Consulta as solicitações agendadas em determinado intervalo. */
export async function buscarAgenda(filtros: FiltrosAgenda) {
  const query = criarQuery(filtros);

  return requestApi(
    `/api/solicitacoes-viagem/agenda${query}`,
    { method: 'GET' },
    valor => parseResponse(
      solicitacoesSchemas.RespostaAgendaViagem,
      valor,
    ),
  );
}

/** Consulta motoristas e veículos disponíveis no intervalo informado. */
export async function buscarDisponibilidade(
  filtros: FiltrosDisponibilidade,
) {
  const query = criarQuery(filtros);

  const resposta = await requestApi(
    `/api/solicitacoes-viagem/disponibilidade${query}`,
    { method: 'GET' },
    valor => parseResponse(
      solicitacoesSchemas.RespostaDisponibilidadeViagem,
      valor,
    ),
  );

  return resposta.data;
}

/** Agenda uma solicitação previamente aprovada. */
export async function agendarSolicitacao(
  id: string,
  dados: DadosAgendamento,
) {
  const resposta = await requestApi(
    `/api/solicitacoes-viagem/${encodeURIComponent(id)}/agendar`,
    corpoJson(dados),
    valor => parseResponse(
      solicitacoesSchemas.RespostaAgendamentoSolicitacaoViagem,
      valor,
    ),
  );

  return resposta.data;
}

/** Reagenda uma solicitação que já está agendada. */
export async function reagendarSolicitacao(
  id: string,
  dados: DadosReagendamento,
) {
  const resposta = await requestApi(
    `/api/solicitacoes-viagem/${encodeURIComponent(id)}/reagendar`,
    corpoJson(dados),
    valor => parseResponse(
      solicitacoesSchemas.RespostaAgendamentoSolicitacaoViagem,
      valor,
    ),
  );

  return resposta.data;
}
