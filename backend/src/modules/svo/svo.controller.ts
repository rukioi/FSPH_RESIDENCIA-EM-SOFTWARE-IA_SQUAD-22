import { ErroCorpoRequisicao, lerCorpoJson } from '../../shared/http/body.js';
import { responderErroCorpo } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { svoSchemas } from './svo.schemas.js';
import {
  listarOrdensPendentes,
  criarSolicitacao,
  listarSolicitacoes,
  despacharOrdem,
} from './svo.repository.js';

export { ErroCorpoRequisicao, lerCorpoJson } from '../../shared/http/body.js';

/** Lê o corpo e mantém o envelope legado das falhas do SVO. */
async function lerDadosDaRequisicao(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<unknown> {
  try {
    return await lerCorpoJson(request);
  } catch (erro) {
    if (erro instanceof ErroCorpoRequisicao) {
      responderErroCorpo(response, erro, true);
      return undefined;
    }

    throw erro;
  }
}

/** Responde a verificação legada do controller sem acessar o banco. */
export function testarSvoController(
  response: ServerResponse
): void {
  jsonCompartilhado(response, 200, {
    mensagem: 'Controller do SVO funcionando!',
  });
}

/** Lista as ordens pendentes de despacho para o atendente autenticado. */
export async function listarOrdensPendentesController(
  response: ServerResponse
): Promise<void> {
  try {
    const ordens = await listarOrdensPendentes();

    jsonCompartilhado(response, 200, ordens);
  } catch (erro) {
    registrarFalha(erro);

    jsonCompartilhado(response, 500, {
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível consultar as ordens de coleta.',
      },
    });
  }
}

/** Consulta inicial da SCRUM-130: até 20 registros, sem informações pessoais. */
export async function listarSolicitacoesController(
  response: ServerResponse,
  params: URLSearchParams,
): Promise<void> {
  if ([...params.keys()].some(key => key !== 'status') || params.getAll('status').length > 1) {
    jsonCompartilhado(response, 400, { erro: 'Filtro inválido.' });
    return;
  }
  const raw = params.get('status');
  const filtro = raw === null ? undefined : svoSchemas.StatusTriagem.safeParse(raw);
  if (filtro !== undefined && !filtro.success) {
    jsonCompartilhado(response, 400, { erro: 'Status de triagem inválido.' });
    return;
  }
  try {
    jsonCompartilhado(response, 200, await listarSolicitacoes(filtro?.data));
  } catch (erro) {
    registrarFalha(erro);
    jsonCompartilhado(response, 500, {
      error: { code: 'ERRO_INTERNO', message: 'Não foi possível consultar solicitações SVO.' },
    });
  }
}

/** Registra atendimento telefônico autenticado; não cria ordem nem conclui triagem. */
export async function criarSolicitacaoController(
  request: IncomingMessage,
  response: ServerResponse,
  atendenteId: string,
): Promise<void> {

const corpo = await lerDadosDaRequisicao(request, response);
if (corpo === undefined) return;

let dadosNormalizados: unknown = corpo;

if (
  corpo !== null &&
  typeof corpo === 'object' &&
  !Array.isArray(corpo)
) {
  const dados = corpo as Record<string, unknown>;
  const telefone = dados.solicitanteTelefone;

  if (typeof telefone === 'string' && telefone.trim() === '') {
    dadosNormalizados = {
      ...dados,
      solicitanteTelefone: undefined,
    };
  }
}

const validacao = svoSchemas.CriarSolicitacaoSvo.safeParse(dadosNormalizados);
  if (!validacao.success) {
    jsonCompartilhado(response, 400, {
      erro: 'Dados da ocorrência inválidos ou campos não permitidos.',
    });
    return;
  }
  try {
    const resultado = await criarSolicitacao({ ...validacao.data, atendenteId });
    jsonCompartilhado(response, 201, resultado);
  } catch (erro) {
    registrarFalha(erro);
    const codigo = typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
    if (codigo === '23505') {
      jsonCompartilhado(response, 409, { erro: 'Conflito ao gerar o protocolo da ocorrência.' });
      return;
    }
    jsonCompartilhado(response, 500, {
      error: { code: 'ERRO_INTERNO', message: 'Não foi possível criar a solicitação de óbito.' },
    });
  }
}

/**
 * Despacha a ordem informada no corpo.
 * Referência inexistente responde 404. Recurso indisponível ou já alocado responde 409.
 */
export async function despacharOrdemController(
  request: IncomingMessage,
  response: ServerResponse,
  ordemId: number
): Promise<void> {
  const dados = await lerDadosDaRequisicao(request, response);

  if (dados === undefined) {
    return;
  }

  if (
    typeof dados !== 'object' ||
    dados === null ||
    Array.isArray(dados)
  ) {
    jsonCompartilhado(response, 400, {
      erro: 'Os dados do despacho são inválidos.',
    });
    return;
  }

  const { motoristaId, veiculoId } =
    dados as Record<string, unknown>;

  if (
    !Number.isSafeInteger(motoristaId) ||
    Number(motoristaId) <= 0 ||
    !Number.isSafeInteger(veiculoId) ||
    Number(veiculoId) <= 0
  ) {
    jsonCompartilhado(response, 400, {
      erro: 'motoristaId e veiculoId devem ser números inteiros positivos.',
    });
    return;
  }

  try {
    const resultado = await despacharOrdem({
      ordemId,
      motoristaId: Number(motoristaId),
      veiculoId: Number(veiculoId),
    });

    if (resultado.tipo === 'ordem_indisponivel') {
      jsonCompartilhado(response, 404, {
        erro: 'Ordem não encontrada ou não está pendente de alocação.',
      });
      return;
    }

    if (resultado.tipo === 'referencia_inexistente') {
      jsonCompartilhado(response, 404, {
        erro: 'Motorista ou veículo não encontrado.',
      });
      return;
    }

    if (resultado.tipo === 'recurso_inelegivel') {
      jsonCompartilhado(response, 409, {
        erro: 'Motorista ou veículo não está disponível para despacho.',
      });
      return;
    }

    if (resultado.tipo === 'conflito_alocacao') {
      jsonCompartilhado(response, 409, {
        erro: 'Motorista ou veículo já está em deslocamento.',
      });
      return;
    }

    jsonCompartilhado(response, 200, resultado.ordem);
  } catch (erro) {
    registrarFalha(erro);

    jsonCompartilhado(response, 500, {
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível despachar a ordem de coleta.',
      },
    });
  }
}
