
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  listarOrdensPendentes,
  criarSolicitacao,
  despacharOrdem,
} from './svo.repository.js';

export function testarSvoController(
  response: ServerResponse
): void {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  response.end(JSON.stringify({
    mensagem: 'Controller do SVO funcionando!',
  }));
}

export async function listarOrdensPendentesController(
  response: ServerResponse
): Promise<void> {
  try {
    const ordens = await listarOrdensPendentes();

    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify(ordens));
  } catch (erro) {
    console.error('Erro ao listar ordens de coleta:', erro);

    response.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível consultar as ordens de coleta.',
      },
    }));
  }
}

export async function criarSolicitacaoController(
  request: IncomingMessage,
  response: ServerResponse,
  atendenteId: string
): Promise<void> {
  let corpo = '';

  for await (const parte of request) {
    corpo += parte.toString();
  }

  let dados: unknown;

  try {
    dados = JSON.parse(corpo);
  } catch {
    response.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      erro: 'O corpo da requisição precisa ser um JSON válido.',
    }));
    return;
  }

  if (
    typeof dados !== 'object' ||
    dados === null ||
    Array.isArray(dados)
  ) {
    response.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      erro: 'Os dados da solicitação são inválidos.',
    }));
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
      response.writeHead(400, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        erro: `O campo ${campo} é obrigatório.`,
      }));
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
      response.writeHead(400, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        erro: `O campo ${campo} precisa ser um texto.`,
      }));
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

    response.writeHead(201, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify(resultado));
  } catch (erro) {
    console.error('Erro ao criar solicitação de óbito:', erro);

    response.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível criar a solicitação de óbito.',
      },
    }));
  }
}

export async function despacharOrdemController(
  request: IncomingMessage,
  response: ServerResponse,
  ordemId: number
): Promise<void> {
  let corpo = '';

  for await (const parte of request) {
    corpo += parte.toString();
  }

  let dados: unknown;

  try {
    dados = JSON.parse(corpo);
  } catch {
    response.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      erro: 'O corpo da requisição precisa ser um JSON válido.',
    }));
    return;
  }

  if (
    typeof dados !== 'object' ||
    dados === null ||
    Array.isArray(dados)
  ) {
    response.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      erro: 'Os dados do despacho são inválidos.',
    }));
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
    response.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      erro: 'motoristaId e veiculoId devem ser números inteiros positivos.',
    }));
    return;
  }

  
  try {
    const ordem = await despacharOrdem({
      ordemId,
      motoristaId: Number(motoristaId),
      veiculoId: Number(veiculoId),
    });

    if (ordem === null) {
      response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        erro: 'Ordem não encontrada ou não está pendente de alocação.',
      }));
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify(ordem));
  } catch (erro) {
    console.error('Erro ao despachar ordem de coleta:', erro);

    response.writeHead(500, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      error: {
        code: 'ERRO_INTERNO',
        message: 'Não foi possível despachar a ordem de coleta.',
      },
    }));
  }
}
