import { ErroCorpoRequisicao, lerCorpoJson } from '../../shared/http/body.js';
import { responderErroCorpo } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  listarOrdensPendentes,
  criarSolicitacao,
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

/**
 * Cria uma solicitação de óbito a partir de um JSON de até 64 KB.
 * Corpo grande responde 413. Falha de leitura não segue para o banco.
 */
export async function criarSolicitacaoController(
  request: IncomingMessage,
  response: ServerResponse,
  atendenteId: string
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
      erro: 'Os dados da solicitação são inválidos.',
    });
    return;
  }

  const camposObrigatorios = [
    'localFalecimento',
    'enderecoRemocao',
    'solicitanteNome',
  ] as const;

  for (const campo of camposObrigatorios) {
    const valor = (dados as Record<string, unknown>)[campo];

    if (typeof valor !== 'string' || valor.trim() === '') {
      jsonCompartilhado(response, 400, {
        erro: `O campo ${campo} é obrigatório.`,
      });
      return;
    }
  }

  const camposOpcionais = [
    'nomeFalecido',
    'solicitanteParentesco',
    'solicitanteTelefone',
    'observacoesMedicas',
  ] as const;

  for (const campo of camposOpcionais) {
    const valor = (dados as Record<string, unknown>)[campo];

    if (
      valor !== undefined &&
      valor !== null &&
      typeof valor !== 'string'
    ) {
      jsonCompartilhado(response, 400, {
        erro: `O campo ${campo} precisa ser um texto.`,
      });
      return;
    }
  }

  try {
    const resultado = await criarSolicitacao({
      atendenteId,
      localFalecimento: (dados as Record<string, string>).localFalecimento,
      enderecoRemocao: (dados as Record<string, string>).enderecoRemocao,
      solicitanteNome: (dados as Record<string, string>).solicitanteNome,
      nomeFalecido: (dados as Record<string, string>).nomeFalecido,
      solicitanteParentesco: (dados as Record<string, string>).solicitanteParentesco,
      solicitanteTelefone: (dados as Record<string, string>).solicitanteTelefone,
      observacoesMedicas: (dados as Record<string, string>).observacoesMedicas,
    });

    jsonCompartilhado(response, 201, resultado);
  } catch (erro) {
    registrarFalha(erro);

    jsonCompartilhado(response, 500, {
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível criar a solicitação de óbito.',
      },
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
