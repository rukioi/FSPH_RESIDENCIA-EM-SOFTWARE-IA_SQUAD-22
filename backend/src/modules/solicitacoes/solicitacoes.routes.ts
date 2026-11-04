import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { enviarErro } from '../../shared/http/json.js';
import { criarSolicitacao, listarSolicitacoes, decidirPedido, agendarPedido, editarPedido,consultarAgendaPedido,reagendarPedido,detalharPedido,historicoPedido } from './solicitacoes.controller.js';

/** Aplica sessão atual e permissões aos endpoints institucionais, separados do SVO. */
export async function solicitacoesRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pathname = new URL(req.url ?? '', 'http://localhost').pathname;
  const decisao = pathname.match(/^\/api\/solicitacoes-viagem\/([0-9]+)\/(aprovar|rejeitar|agendar|reagendar)$/);
  const consulta=pathname.match(/^\/api\/solicitacoes-viagem\/(agenda|disponibilidade)$/);
  const edicao = pathname.match(/^\/api\/solicitacoes-viagem\/([0-9]+)$/);
  const historico=pathname.match(/^\/api\/solicitacoes-viagem\/([0-9]+)\/historico$/);
  if (pathname !== '/api/solicitacoes-viagem' && !decisao && !edicao && !consulta && !historico) {
    enviarErro(res, 404, 'NAO_ENCONTRADO', 'Rota não encontrada.');
    return;
  }
  if (consulta || historico ? req.method!=='GET' : edicao ? req.method !== 'PATCH' && req.method!=='GET' : decisao ? req.method !== 'POST' : req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', consulta || historico ? 'GET' : edicao ? 'GET, PATCH' : decisao ? 'POST' : 'GET, POST');
    enviarErro(res, 405, 'METODO_NAO_PERMITIDO', 'Método não permitido.');
    return;
  }
  const usuario = await autenticarRequisicao(req, res);
  if (!usuario) return;
  const perfis = decisao || (edicao && req.method==='PATCH') || consulta ? ['ADM', 'GESTOR_FROTA'] : req.method === 'POST' ? ['SOLICITANTE_INTERNO'] : ['SOLICITANTE_INTERNO', 'GESTOR_FROTA', 'ADM'];
  if (!autorizarPerfis(usuario, perfis, res)) return;
  if(historico){await historicoPedido(req,res,usuario,historico[1]);return;}
  if (consulta) {
    await consultarAgendaPedido(req,res,usuario,consulta[1] as 'agenda'|'disponibilidade');
    return;
  }
  if (edicao) {
    if(req.method==='GET')await detalharPedido(req,res,usuario,edicao[1]);
    else await editarPedido(req, res, usuario, edicao[1]);
    return;
  }
  if (decisao) {
    if (decisao[2] === 'reagendar') await reagendarPedido(req,res,usuario,decisao[1]);
    else if (decisao[2] === 'agendar') await agendarPedido(req, res, usuario, decisao[1]);
    else await decidirPedido(req, res, usuario, decisao[1], decisao[2] as 'aprovar' | 'rejeitar');
    return;
  }
  if (req.method === 'POST') await criarSolicitacao(req, res, usuario);
  else await listarSolicitacoes(req, res, usuario);
}
