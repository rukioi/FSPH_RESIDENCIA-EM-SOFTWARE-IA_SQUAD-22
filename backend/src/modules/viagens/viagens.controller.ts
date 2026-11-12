import type { IncomingMessage, ServerResponse } from 'node:http';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarDados, enviarJson } from '../../shared/http/json.js';
import { parametrosSolicitacoes } from '../solicitacoes/solicitacoes.schemas.js';
import { criarOuConsultar, listarMinhasViagens, executar, validar, listarAdministrativo, pendentesValidacao, detalhes, historico, consultarEvidencias, obterEvidencia, corrigir, consultarCorrecoes } from './viagens.service.js';

/** Retorna a página institucional do motorista autenticado. */
export async function consultarMinhas(req: IncomingMessage, res: ServerResponse, usuario: UsuarioAutenticado): Promise<void> {
  const parametros = parametrosSolicitacoes(new URL(req.url ?? '', 'http://localhost').searchParams);
  enviarJson(res, 200, await listarMinhasViagens(parametros, usuario));
}

/** Retorna a viagem vinculada ao pedido ja agendado. */
export async function criarPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado):Promise<void> {enviarDados(res,200,await criarOuConsultar(await lerCorpoJson(req),usuario));}

/** Executa a transição após validar o corpo. */
export async function executarPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string,acao:'iniciar'|'concluir'):Promise<void> {
  enviarDados(res,200,await executar(id,acao,await lerCorpoJson(req,1500*1024),usuario));
}

/** Confirma a validação sem alterar quilometragem ou horários de execução. */
export async function validarPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {
  req.resume();
  enviarDados(res,200,await validar(id,usuario));
}

/** Responde à consulta administrativa paginada. */
export async function listarPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado):Promise<void> {enviarJson(res,200,await listarAdministrativo(parametrosSolicitacoes(new URL(req.url??'','http://localhost').searchParams),usuario));}
/** Retorna a fila de viagens concluidas que aguardam validacao. */
export async function pendentesPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado):Promise<void> {enviarJson(res,200,await pendentesValidacao(parametrosSolicitacoes(new URL(req.url??'','http://localhost').searchParams),usuario));}
/** Responde aos detalhes autorizados. */
export async function detalhePedido(res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {enviarDados(res,200,await detalhes(id,usuario));}
/** Responde ao histórico autorizado e paginado. */
export async function historicoPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {enviarJson(res,200,await historico(id,parametrosSolicitacoes(new URL(req.url??'','http://localhost').searchParams),usuario));}

/** Retorna metadados sem expor os bytes nas listas. */
export async function listarEvidenciasPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {enviarJson(res,200,await consultarEvidencias(id,parametrosSolicitacoes(new URL(req.url??'','http://localhost').searchParams),usuario));}
/** Devolve os bytes originais como anexo e sem cache. */
export async function baixarEvidenciaPedido(res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {
  const arquivo=await obterEvidencia(id,usuario);res.setHeader('Content-Type',String(arquivo.tipo));res.setHeader('Content-Disposition','attachment; filename="evidencia"');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','private, no-store');res.end(arquivo.dados as Buffer);
}

/** Corrige quilometragem com justificativa e confirmação explícita quando necessária. */
export async function corrigirPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {enviarDados(res,200,await corrigir(id,await lerCorpoJson(req),usuario));}
/** Lista o histórico de correções para a gestão. */
export async function correcoesPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {enviarJson(res,200,await consultarCorrecoes(id,parametrosSolicitacoes(new URL(req.url??'','http://localhost').searchParams),usuario));}
