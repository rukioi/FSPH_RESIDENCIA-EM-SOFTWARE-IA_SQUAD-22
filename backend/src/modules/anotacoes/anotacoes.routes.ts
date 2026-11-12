import type { IncomingMessage,ServerResponse } from 'node:http';
import { autenticarRequisicao } from '../../security/session.js';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarJson } from '../../shared/http/json.js';
import { tratarErroTecnico } from '../../shared/http/errors.js';
import { criarAnotacao,listarAnotacoes } from './anotacoes.service.js';

/** RF48 não decide triagem/viagem: só anexa texto privado ao registro permitido. */
export async function anotacoesRoute(req:IncomingMessage,res:ServerResponse){
  const usuario=await autenticarRequisicao(req,res);if(!usuario){req.resume();return;}
  try{
    if(req.method==='POST')enviarJson(res,201,await criarAnotacao(usuario,await lerCorpoJson(req)));
    else enviarJson(res,200,await listarAnotacoes(usuario,new URL(req.url??'','http://localhost').searchParams));
  }catch(error){req.resume();tratarErroTecnico(res,error);}
}
