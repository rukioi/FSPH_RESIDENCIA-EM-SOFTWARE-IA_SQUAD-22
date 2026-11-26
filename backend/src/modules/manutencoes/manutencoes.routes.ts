import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarJson } from '../../shared/http/json.js';
import { gestor } from '../../shared/contract/schemas.js';
import { cadastrarManutencao, editarManutencao, ifMatchManutencao, manutencaoId, transicaoManutencao } from './manutencoes.schemas.js';
import {
  consultarHistoricoManutencao, consultarListaManutencoes, consultarManutencao, criarEscritaManutencao, obterIndicadoresManutencao, validarManutencao,
} from './manutencoes.service.js';

/** Conecta a escrita somente quando a composição da aplicação fornecer a guarda transacional real. */
export function criarRotaManutencoes(guarda: Parameters<typeof criarEscritaManutencao>[0]) {
  const escrita = criarEscritaManutencao(guarda);
  return async function manutencoesRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const usuario = await autenticarRequisicao(req, res);
    if (!usuario || !autorizarPerfis(usuario, gestor, res)) {
      req.resume();
      return;
    }
    const url = new URL(req.url ?? '', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/manutencoes/indicadores') {
      enviarJson(res, 200, await obterIndicadoresManutencao(url.searchParams));
      return;
    }
    const partes = url.pathname.split('/');
    const id = partes[3] === undefined ? undefined : validarManutencao(manutencaoId, partes[3]);

    if (req.method === 'POST') {
      const entrada = validarManutencao(cadastrarManutencao, await lerCorpoJson(req));
      const body = await escrita.cadastrar(entrada, usuario.id);
      res.setHeader('Location', '/api/manutencoes/' + body.data.id);
      res.setHeader('ETag', body.data.versao);
      enviarJson(res, 201, body);
      return;
    }
    if (req.method === 'PATCH' && id !== undefined) {
      const token = validarManutencao(ifMatchManutencao, req.headers['if-match']);
      const raw = await lerCorpoJson(req);
      const comando = partes[4] === 'status' ? { transicao: validarManutencao(transicaoManutencao, raw) }
        : { edicao: validarManutencao(editarManutencao, raw) };
      const body = await escrita.alterar(id, usuario.id, token, comando);
      res.setHeader('ETag', body.data.versao);
      enviarJson(res, 200, body);
      return;
    }
    if (partes[2] === 'veiculos' || id === undefined) {
      enviarJson(res, 200, await consultarListaManutencoes(url.searchParams, id));
    } else if (partes[4] === 'historico') {
      enviarJson(res, 200, await consultarHistoricoManutencao(id, url.searchParams));
    } else {
      const body = await consultarManutencao(id);
      res.setHeader('ETag', body.data.versao);
      enviarJson(res, 200, body);
    }
  };
}
