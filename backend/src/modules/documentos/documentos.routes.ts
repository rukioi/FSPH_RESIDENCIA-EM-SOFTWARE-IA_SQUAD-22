import { enviarJson as jsonCompartilhado } from '../../shared/http/json.js';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { consultarDocumentos,detalharDocumento,editarDocumento } from './documentos.gestao.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { tratarErroTecnico } from '../../shared/http/errors.js';

import {
  buscarPendenciasDocumentos,
  criarDocumento,
  listarDocumentos,
} from './documentos.controller.js';

/** Gerencia as rotas de documentos e suas pendências. */
export async function documentosRoute(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const usuario = await autenticarRequisicao(req, res);

  if (!usuario) {
    return;
  }

  if (!autorizarPerfis(usuario, ['ADM', 'GESTOR_FROTA'], res)) return;

  const url = new URL(
    req.url ?? '',
    `http://${req.headers.host ?? 'localhost'}`,
  );

  const pathname = url.pathname;
  const method = req.method;

  const detalhe=/^\/api\/documentos\/(\d+)(\/historico)?$/.exec(pathname);
  if(pathname==='/api/documentos/consulta'||detalhe){
    try{
      if(pathname==='/api/documentos/consulta')jsonCompartilhado(res,200,await consultarDocumentos(url.searchParams));
      else if(detalhe&&method==='PATCH')jsonCompartilhado(res,200,await editarDocumento(detalhe[1],url.searchParams,await lerCorpoJson(req),usuario.id));
      else if(detalhe)jsonCompartilhado(res,200,await detalharDocumento(detalhe[1],url.searchParams,!!detalhe[2]));
    }catch(error){req.resume();tratarErroTecnico(res,error);}
    return;
  }

  // Cadastro de documentos de veículos.
  if (method === 'POST' && pathname === '/api/documentos') {
    await criarDocumento(req, res, usuario.id);
    return;
  }

  // Listagem completa, incluindo documentos regulares.
  if (method === 'GET' && pathname === '/api/documentos') {
    await listarDocumentos(res);
    return;
  }

  // Preserva a consulta original de pendências.
  if (
    method === 'GET' &&
    pathname === '/api/documentos/pendencias'
  ) {
    await buscarPendenciasDocumentos(res);
    return;
  }

  jsonCompartilhado(res, 404, {
    error: {
      code: 'NAO_ENCONTRADO',
      message: 'Rota de documentos não encontrada.',
    },
  });
}
