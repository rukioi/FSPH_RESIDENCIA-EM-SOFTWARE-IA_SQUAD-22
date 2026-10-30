import type { IncomingMessage, ServerResponse } from 'node:http';
import { lerCorpoJson } from '../../shared/http/body.js';
import { responderErroCorpo, responderErroHttp } from '../../shared/http/errors.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { enviarDados, enviarErro } from '../../shared/http/json.js';
import * as service from './veiculos.service.js';

function tratarErro(res: ServerResponse, err: unknown, mensagem: string) {
  if (responderErroCorpo(res,err) || responderErroHttp(res,err)) return;
  if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') {
    enviarErro(res,409,'PLACA_DUPLICADA','Já existe um veículo cadastrado com esta placa.');
    return;
  }
  registrarFalha(err);
  enviarErro(res,500,'ERRO_INTERNO',mensagem);
}
/** Lista o DTO do piloto mantendo data e ordenação atuais. */
export async function listarVeiculos(_req: IncomingMessage,res: ServerResponse) {
  try { enviarDados(res,200,await service.listar()); }
  catch (err) { tratarErro(res,err,'Falha ao listar veículos.'); }
}
/** Lê JSON limitado e delega as regras existentes ao serviço responsável. */
export async function criarVeiculo(req: IncomingMessage,res: ServerResponse) {
  try { enviarDados(res,201,await service.criar(await lerCorpoJson(req))); }
  catch (err) { tratarErro(res,err,'Falha ao cadastrar veículo.'); }
}
/** Preserva PUT/PATCH parciais e a resposta de ausência. */
export async function atualizarVeiculo(req: IncomingMessage,res: ServerResponse,id: string) {
  try { enviarDados(res,200,await service.editar(id,await lerCorpoJson(req))); }
  catch (err) { tratarErro(res,err,'Falha ao atualizar veículo.'); }
}
/** Preserva exclusão com 200 e data.success. */
export async function deletarVeiculo(_req: IncomingMessage,res: ServerResponse,id: string) {
  try { enviarDados(res,200,await service.remover(id)); }
  catch (err) { tratarErro(res,err,'Falha ao remover veículo.'); }
}
