
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  listarOrdensPendentes,
  criarSolicitacao,
  despacharOrdem,
} from './svo.repository.js';

const LIMITE_CORPO_BYTES = 64 * 1024;

type CodigoErroCorpo =
  | 'CORPO_MUITO_GRANDE'
  | 'CONEXAO_INTERROMPIDA'
  | 'JSON_INVALIDO'
  | 'ERRO_LEITURA';

/** Falha conhecida ao ler o corpo HTTP, antes da regra de negócio. */
export class ErroCorpoRequisicao extends Error {
  readonly codigo: CodigoErroCorpo;

  constructor(codigo: CodigoErroCorpo) {
    super(codigo);
    this.name = 'ErroCorpoRequisicao';
    this.codigo = codigo;
  }
}

/**
 * Lê o corpo até 64 KiB, junta os bytes e só então interpreta o JSON.
 * O limite é aplicado antes de guardar cada parte. Erro de stream,
 * conexão interrompida e JSON inválido viram erro classificado.
 */
export async function lerCorpoJson(request: IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = [];
  let total = 0;

  request.on('error', () => {});

  try {
    for await (const parte of request) {
      if (request.aborted) {
        throw new ErroCorpoRequisicao('CONEXAO_INTERROMPIDA');
      }

      const buffer = paraBuffer(parte);

      if (buffer.length > LIMITE_CORPO_BYTES - total) {
        throw new ErroCorpoRequisicao('CORPO_MUITO_GRANDE');
      }

      total += buffer.length;
      partes.push(buffer);
    }
  } catch (erro) {
    if (erro instanceof ErroCorpoRequisicao) {
      throw erro;
    }

    if (request.aborted || ehInterrupcao(erro)) {
      throw new ErroCorpoRequisicao('CONEXAO_INTERROMPIDA');
    }

    throw new ErroCorpoRequisicao('ERRO_LEITURA');
  }

  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch {
    throw new ErroCorpoRequisicao('JSON_INVALIDO');
  }
}

/** Converte um pedaço do stream em buffer sem aceitar tipo inesperado. */
function paraBuffer(parte: unknown): Buffer {
  if (Buffer.isBuffer(parte)) {
    return parte;
  }

  if (parte instanceof Uint8Array) {
    return Buffer.from(parte);
  }

  if (typeof parte === 'string') {
    return Buffer.from(parte);
  }

  throw new ErroCorpoRequisicao('ERRO_LEITURA');
}

/** Identifica queda de conexão a partir do código do erro de stream. */
function ehInterrupcao(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null || !('code' in erro)) {
    return false;
  }

  const codigo = erro.code;
  return codigo === 'ECONNRESET'
    || codigo === 'EPIPE'
    || codigo === 'ERR_STREAM_PREMATURE_CLOSE';
}

/** Envia JSON se a resposta ainda estiver aberta. */
function responderJson(
  response: ServerResponse,
  status: number,
  corpo: unknown,
  aoEnviar?: () => void,
): void {
  if (response.headersSent || response.writableEnded || response.destroyed) {
    return;
  }

  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(corpo), aoEnviar);
}

/**
 * Converte falha de leitura em resposta HTTP.
 * Conexão já encerrada não gera nova resposta.
 */
function responderErroDeCorpo(
  request: IncomingMessage,
  response: ServerResponse,
  erro: ErroCorpoRequisicao,
): void {
  if (erro.codigo === 'CONEXAO_INTERROMPIDA') {
    return;
  }

  if (erro.codigo === 'CORPO_MUITO_GRANDE') {
    responderJson(response, 413, {
      erro: 'O corpo da requisição excede o limite de 64 KB.',
    }, () => encerrarLeitura(request));
    return;
  }

  if (erro.codigo === 'JSON_INVALIDO') {
    responderJson(response, 400, {
      erro: 'O corpo da requisição precisa ser um JSON válido.',
    });
    return;
  }

  responderJson(response, 400, {
    erro: 'Não foi possível ler o corpo da requisição.',
  });
}

/** Interrompe o restante do upload sem deixar o erro do socket escapar. */
function encerrarLeitura(request: IncomingMessage): void {
  request.on('error', () => {});

  if (!request.destroyed) {
    request.destroy();
  }
}

/**
 * Lê e classifica o corpo. Responde e devolve undefined quando a leitura falha.
 */
async function lerDadosDaRequisicao(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<unknown> {
  try {
    return await lerCorpoJson(request);
  } catch (erro) {
    if (erro instanceof ErroCorpoRequisicao) {
      responderErroDeCorpo(request, response, erro);
      return undefined;
    }

    throw erro;
  }
}

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

/** Lista as ordens pendentes de despacho para o atendente autenticado. */
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
    const resultado = await despacharOrdem({
      ordemId,
      motoristaId: Number(motoristaId),
      veiculoId: Number(veiculoId),
    });

    if (resultado.tipo === 'ordem_indisponivel') {
      response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        erro: 'Ordem não encontrada ou não está pendente de alocação.',
      }));
      return;
    }

    if (resultado.tipo === 'referencia_inexistente') {
      response.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        erro: 'Motorista ou veículo não encontrado.',
      }));
      return;
    }

    if (resultado.tipo === 'recurso_inelegivel') {
      response.writeHead(409, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        erro: 'Motorista ou veículo não está disponível para despacho.',
      }));
      return;
    }

    if (resultado.tipo === 'conflito_alocacao') {
      response.writeHead(409, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        erro: 'Motorista ou veículo já está em deslocamento.',
      }));
      return;
    }

    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify(resultado.ordem));
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
