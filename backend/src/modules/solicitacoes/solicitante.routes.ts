import type { IncomingMessage, ServerResponse } from 'node:http';
import { validarJwt } from '../../security/jwt.js';
import { ErroCorpoRequisicao, lerCorpoJson } from '../svo/svo.controller.js';

/** Protege as rotas do Portal do Solicitante. */
export async function solicitanteRoute(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const usuario = await validarJwt(request.headers.authorization);

  if (!usuario) {
    response.writeHead(401, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      error: {
        code: 'NAO_AUTENTICADO',
        message: 'Autenticação necessária.',
      },
    }));
    return;
  }

  if (usuario.perfil !== 'SOLICITANTE') {
    response.writeHead(403, {
      'Content-Type': 'application/json; charset=utf-8',
    });

    response.end(JSON.stringify({
      error: {
        code: 'ACESSO_NEGADO',
        message: 'Você não tem permissão para realizar esta ação.',
      },
    }));
    return;
  }
  if (request.method === 'POST') {
    let dados: unknown;

    try {
      dados = await lerCorpoJson(request);
    } catch (erro) {
      const codigo = erro instanceof ErroCorpoRequisicao
        ? erro.codigo
        : 'ERRO_LEITURA';

      const status = codigo === 'CORPO_MUITO_GRANDE'
        ? 413
        : codigo === 'JSON_INVALIDO'
          ? 400
          : 500;

      if (response.destroyed || response.writableEnded) return;

      response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
      });

      response.end(JSON.stringify({
        error: {
          code: codigo,
          message: status === 413
            ? 'O corpo da requisição excede o limite permitido.'
            : status === 400
              ? 'Envie um JSON válido.'
              : 'Não foi possível ler a requisição.',
        },
      }));
      return;
    }
    const campos = ['motivo', 'origem', 'destino'] as const;

    const valido =
      dados !== null &&
      typeof dados === 'object' &&
      !Array.isArray(dados) &&
      campos.every((campo) => {
        const valor = (dados as Record<string, unknown>)[campo];
        return typeof valor === 'string' &&
          valor.trim().length > 0 &&
          valor.length <= 500;
      }) &&
      Object.keys(dados).every((campo) => campos.includes(campo as typeof campos[number]));

    if (!valido) {
      response.writeHead(400, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      response.end(JSON.stringify({
        error: {
          code: 'DADOS_INVALIDOS',
          message: 'Informe motivo, origem e destino válidos.',
        },
      }));
      return;
    }
  }
  response.writeHead(501, {
    'Content-Type': 'application/json; charset=utf-8',
  });

  response.end(JSON.stringify({
    error: {
      code: 'NAO_IMPLEMENTADO',
      message: 'Funcionalidade ainda não implementada.',
    },
  }));
}




