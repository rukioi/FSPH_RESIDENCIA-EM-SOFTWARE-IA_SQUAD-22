import type { IncomingMessage, ServerResponse } from 'node:http';
import { enviarErro } from '../../shared/http/json.js';
import { autenticarRequisicao } from '../../security/session.js';
import { autorizarPerfis } from '../../security/authorization.js';
import { listarAbastecimentos, criarAbastecimento, baixarComprovante, obterAbastecimento, indicadoresAbastecimentos } from './abastecimentos.controller.js';

/** Aplica sessão e RBAC comuns em todas as consultas e escritas de abastecimento. */
export async function abastecimentosRoute(req:IncomingMessage,res:ServerResponse):Promise<void> {
  const pathname=new URL(req.url??'', 'http://localhost').pathname;
  const usuario=await autenticarRequisicao(req,res);
  if(!usuario||!autorizarPerfis(usuario,['ADM','GESTOR_FROTA'],res)) return;
  const comprovante=/^\/api\/abastecimentos\/(\d+)\/comprovante$/.exec(pathname);
  const historico=/^\/api\/veiculos\/(\d+)\/abastecimentos$/.exec(pathname);
  const detalhe=/^\/api\/abastecimentos\/(\d+)$/.exec(pathname);
  if(req.method==='GET') {
    if(pathname==='/api/abastecimentos/indicadores') return indicadoresAbastecimentos(req,res);
    if(comprovante) return baixarComprovante(res,comprovante[1]);
    if(historico) return listarAbastecimentos(req,res,historico[1]);
    if(detalhe) return obterAbastecimento(res,detalhe[1]);
    if(pathname==='/api/abastecimentos') return listarAbastecimentos(req,res);
  }
  if(req.method==='POST'&&pathname==='/api/abastecimentos') return criarAbastecimento(req,res,usuario.id);
  enviarErro(res,404,'NAO_ENCONTRADO','Rota de abastecimentos não encontrada.');
}
