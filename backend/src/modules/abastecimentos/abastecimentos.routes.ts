import { obterIndicadoresAbastecimentos } from './abastecimentos.indicadores.js';
import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { criarAbastecimento, baixarComprovante } from './abastecimentos.controller.js';

import { listarAbastecimentos, detalharAbastecimento } from './abastecimentos.consultas.js';
import { consultarUltimoAnexo, enviarArquivo, lerAnexo, salvarAnexo } from '../anexos/anexos.service.js';

export async function abastecimentosRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  const comprovante = /^\/api\/abastecimentos\/(\d+)\/comprovante$/.exec(pathname);

  const detalhe = /^\/api\/abastecimentos\/(\d+)$/.exec(pathname);
  const historico = /^\/api\/veiculos\/(\d+)\/abastecimentos$/.exec(pathname);
  const indicadores = pathname === '/api/abastecimentos/indicadores';

  if (
    !indicadores && !comprovante && !detalhe && !historico && pathname !== '/api/abastecimentos' ||
    (method !== 'GET' && method !== 'POST')
  ) {
    jsonCompartilhado(res, 404, {
      error: {
        code: 'NAO_ENCONTRADO',
        message: 'Rota de abastecimentos não encontrada.',
      },
    });
    return;
  }

  const usuario = await autenticarRequisicao(req, res);
  if (!usuario) return;
  if (!autorizarPerfis(usuario, ['ADM', 'GESTOR_FROTA'], res)) return;

  if (method === 'GET' && indicadores) {
    jsonCompartilhado(res, 200, await obterIndicadoresAbastecimentos(url.searchParams));
    return;
  }

  if (method === 'GET' && comprovante) {
    const arquivo = await consultarUltimoAnexo(usuario, { tipoRegistro: 'ABASTECIMENTO', registroId: BigInt(comprovante[1]).toString() });
    if (arquivo) return enviarArquivo(res, arquivo);
    return baixarComprovante(res, comprovante[1]);
  }

  if (method === 'POST' && comprovante) {
    const { vinculo, arquivo } = await lerAnexo(req, { tipoRegistro: 'ABASTECIMENTO', registroId: comprovante[1] });
    jsonCompartilhado(res, 201, await salvarAnexo(usuario, vinculo, arquivo));
    return;
  }

  if (method === 'GET' && detalhe) {
    jsonCompartilhado(res, 200, await detalharAbastecimento(detalhe[1]));
    return;
  }

  if (method === 'GET' && (historico || pathname === '/api/abastecimentos')) {
    jsonCompartilhado(res, 200, await listarAbastecimentos(url.searchParams, historico?.[1]));
    return;
  }

  if (method === 'POST' && pathname === '/api/abastecimentos') {
    return criarAbastecimento(req, res, usuario.id);
  }

  jsonCompartilhado(res, 404, {
      error: { code: 'NAO_ENCONTRADO', message: 'Rota de abastecimentos não encontrada.' },
    });
}
