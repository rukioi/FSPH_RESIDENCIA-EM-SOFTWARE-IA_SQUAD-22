import type { IncomingMessage, ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { criarPedido, consultarMinhas, executarPedido, validarPedido, listarPedido, pendentesPedido, detalhePedido, historicoPedido, listarEvidenciasPedido, baixarEvidenciaPedido, corrigirPedido, correcoesPedido } from './viagens.controller.js';

/** Protege a consulta pelo perfil persistido e sessão atual. */
export async function viagensRoute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const usuario = await autenticarRequisicao(req, res);
  if (!usuario) return;
  const pathname = new URL(req.url ?? '', 'http://localhost').pathname;
  const correcao = pathname.match(/^\/api\/viagens\/([0-9]+)\/(corrigir-quilometragem|correcoes)$/);
  const evidencias = pathname.match(/^\/api\/viagens\/([0-9]+)\/evidencias$/);
  const download = pathname.match(/^\/api\/viagens\/evidencias\/([0-9]+)$/);
  const consulta = pathname.match(/^\/api\/viagens\/([0-9]+)(?:\/(historico))?$/);
  const pendentes = pathname === '/api/viagens/pendentes-validacao';
  const listagem = pathname === '/api/viagens';
  const validacao = pathname.match(/^\/api\/viagens\/([0-9]+)\/validar$/);
  if (!autorizarPerfis(usuario,validacao || listagem || pendentes || correcao ? ['ADM','GESTOR_FROTA'] : consulta || evidencias || download ? ['ADM','GESTOR_FROTA','MOTORISTA'] : ['MOTORISTA'],res)) return;
  if (correcao) { if(correcao[2]==='correcoes') await correcoesPedido(req,res,usuario,correcao[1]); else await corrigirPedido(req,res,usuario,correcao[1]); return; }
  if (evidencias) { await listarEvidenciasPedido(req,res,usuario,evidencias[1]); return; }
  if (download) { await baixarEvidenciaPedido(res,usuario,download[1]); return; }
  if (pendentes) { await pendentesPedido(req,res,usuario); return; }
  if (listagem) { if(req.method==='POST') await criarPedido(req,res,usuario); else await listarPedido(req,res,usuario); return; }
  if (consulta) { if (consulta[2]) await historicoPedido(req,res,usuario,consulta[1]); else await detalhePedido(res,usuario,consulta[1]); return; }
  if (validacao) { await validarPedido(req,res,usuario,validacao[1]); return; }
  const match = pathname.match(/^\/api\/viagens\/([0-9]+)\/(iniciar|concluir|encerrar)$/);
  if (match) await executarPedido(req,res,usuario,match[1],match[2] === 'encerrar' ? 'concluir' : match[2] as 'iniciar'|'concluir');
  else await consultarMinhas(req, res, usuario);
}
