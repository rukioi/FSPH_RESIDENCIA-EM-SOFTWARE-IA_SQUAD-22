import type { IncomingMessage, ServerResponse } from 'node:http';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarDados, enviarJson } from '../../shared/http/json.js';
import { criar, listar, decidir, agendar, editar,listarAgenda,listarDisponibilidade,reagendar,detalhar,historico } from './solicitacoes.service.js';
import { parametrosSolicitacoes } from './solicitacoes.schemas.js';

/** Lê JSON limitado e confirma a criação somente após o commit da transação. */
export async function criarSolicitacao(req: IncomingMessage, res: ServerResponse, usuario: UsuarioAutenticado): Promise<void> {
  enviarDados(res, 201, await criar(await lerCorpoJson(req), usuario));
}

/** Retorna lista e contagem com filtros validados e escopo autorizado. */
export async function listarSolicitacoes(req: IncomingMessage, res: ServerResponse, usuario: UsuarioAutenticado): Promise<void> {
  enviarJson(res, 200, await listar(parametrosSolicitacoes(new URL(req.url ?? '', 'http://localhost').searchParams), usuario));
}

/** Confirma a decisão somente após estado e atividade serem confirmados na mesma transação. */
export async function decidirPedido(req: IncomingMessage, res: ServerResponse, usuario: UsuarioAutenticado, id: string, acao: 'aprovar' | 'rejeitar'): Promise<void> {
  const body = acao === 'rejeitar' ? await lerCorpoJson(req) : undefined;
  if (acao === 'aprovar') req.resume();
  enviarDados(res, 200, await decidir(id, acao, body, usuario));
}

/** Confirma o agendamento após reserva e auditoria atômicas. */
export async function agendarPedido(req: IncomingMessage, res: ServerResponse, usuario: UsuarioAutenticado, id: string): Promise<void> {
  enviarDados(res, 200, await agendar(id, await lerCorpoJson(req), usuario));
}

/** Retorna a solicitação após commit da edição e da atividade. */
export async function editarPedido(req: IncomingMessage, res: ServerResponse, usuario: UsuarioAutenticado, id: string): Promise<void> {
  enviarDados(res, 200, await editar(id, await lerCorpoJson(req), usuario));
}

/** Publica consultas administrativas sem expor o catálogo de recursos a outros perfis. */
export async function consultarAgendaPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,tipo:'agenda'|'disponibilidade'):Promise<void> {
  const query=parametrosSolicitacoes(new URL(req.url??'','http://localhost').searchParams);
  enviarJson(res,200,await (tipo==='agenda' ? listarAgenda(query,usuario) : listarDisponibilidade(query,usuario)));
}

/** Responde somente após reagendamento e atividade confirmados atomicamente. */
export async function reagendarPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {
  enviarDados(res,200,await reagendar(id,await lerCorpoJson(req),usuario));
}

/** Consulta detalhes acessíveis sem distinguir ausência e acesso a pedido alheio. */
export async function detalharPedido(_req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {
  enviarDados(res,200,await detalhar(id,usuario));
}

/** Retorna somente o histórico paginado vinculado a um pedido autorizado. */
export async function historicoPedido(req:IncomingMessage,res:ServerResponse,usuario:UsuarioAutenticado,id:string):Promise<void> {
  enviarJson(res,200,await historico(id,parametrosSolicitacoes(new URL(req.url??'','http://localhost').searchParams),usuario));
}
