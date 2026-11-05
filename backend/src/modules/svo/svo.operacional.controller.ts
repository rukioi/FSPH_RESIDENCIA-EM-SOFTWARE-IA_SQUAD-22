import type { IncomingMessage, ServerResponse } from 'node:http';
import { ErroCorpoRequisicao, lerCorpoJson } from '../../shared/http/body.js';
import { responderErroCorpo } from '../../shared/http/errors.js';
import { enviarJson } from '../../shared/http/json.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { svoOperacionalSchemas } from './svo.operacional.schemas.js';
import { recursosDisponiveisSvo, ocupacaoSvo, minhasOrdens, minhaOrdem,
  executarOrdem, cancelarOrdem, type AcaoOrdem } from './svo.operacional.repository.js';

function erroServidor(response: ServerResponse, erro: unknown): void {
  registrarFalha(erro);
  enviarJson(response,500,{error:{code:'ERRO_INTERNO',message:'Não foi possível concluir a operação SVO.'}});
}
function semParametros(response: ServerResponse, params: URLSearchParams): boolean {
  if ([...params.keys()].length) { enviarJson(response,400,{erro:'Parâmetros de consulta não permitidos.'});return false; }
  return true;
}
async function jsonRequisicao(request: IncomingMessage, response: ServerResponse):Promise<unknown|undefined>{
  try { return await lerCorpoJson(request); }
  catch(erro){
    if(erro instanceof ErroCorpoRequisicao){responderErroCorpo(response,erro,true);return undefined;}
    throw erro;
  }
}
export async function recursosSvoController(response:ServerResponse,params:URLSearchParams):Promise<void>{
  if(!semParametros(response,params))return;
  try { enviarJson(response,200,await recursosDisponiveisSvo()); }
  catch(erro){erroServidor(response,erro);}
}
export async function ocupacaoSvoController(response:ServerResponse,id:string,params:URLSearchParams):Promise<void>{
  if(!semParametros(response,params))return;
  try { const row=await ocupacaoSvo(id);enviarJson(response,row?200:404,row??{erro:'S10 não encontrada.'}); }
  catch(erro){erroServidor(response,erro);}
}
export async function minhasOrdensController(response:ServerResponse,usuarioId:string,params:URLSearchParams):Promise<void>{
  if(!semParametros(response,params))return;
  try {enviarJson(response,200,await minhasOrdens(usuarioId));}
  catch(erro){erroServidor(response,erro);}
}
export async function minhaOrdemController(response:ServerResponse,usuarioId:string,id:string,params:URLSearchParams):Promise<void>{
  if(!semParametros(response,params))return;
  try {const row=await minhaOrdem(usuarioId,id);enviarJson(response,row?200:404,row??{erro:'Ordem não encontrada.'});}
  catch(erro){erroServidor(response,erro);}
}
export async function executarOrdemController(request:IncomingMessage,response:ServerResponse,
  usuarioId:string,id:string,acao:AcaoOrdem,params:URLSearchParams):Promise<void>{
  if(!semParametros(response,params))return;
  let km:number|null=null;
  if(acao==='iniciar'||acao==='concluir'){
    const body=await jsonRequisicao(request,response);
    if(body===undefined)return;
    const parsed=(acao==='iniciar'?svoOperacionalSchemas.IniciarOrdemSvo:
      svoOperacionalSchemas.ConcluirOrdemSvo).safeParse(body);
    if(!parsed.success){enviarJson(response,400,{erro:'Quilometragem inválida.'});return;}
    km=acao==='iniciar' ? (parsed.data as {kmInicial:number}).kmInicial : (parsed.data as {kmFinal:number}).kmFinal;
  }
  try {
    const r=await executarOrdem(usuarioId,id,acao,km);
    enviarJson(response,r.tipo==='ok'?200:r.tipo==='conflito'?409:404,
      r.tipo==='ok'?r.dados:{erro:r.tipo==='conflito'?'Transição ou quilometragem inválida.':'Ordem não encontrada.'});
  }catch(erro){erroServidor(response,erro);}
}
export async function cancelarOrdemController(request:IncomingMessage,response:ServerResponse,
  usuarioId:string,id:string,params:URLSearchParams):Promise<void>{
  if(!semParametros(response,params))return;
  const body=await jsonRequisicao(request,response);
  if(body===undefined)return;
  if(!svoOperacionalSchemas.CancelarOrdemSvo.safeParse(body).success){
    enviarJson(response,400,{erro:'Corpo inválido; envie objeto JSON vazio.'});return;
  }
  try {
    const r=await cancelarOrdem(usuarioId,id);
    enviarJson(response,r.tipo==='ok'?200:r.tipo==='conflito'?409:404,
      r.tipo==='ok'?r.dados:{erro:r.tipo==='conflito'?'Ordem não pode ser cancelada.':'Ordem não encontrada.'});
  }catch(erro){erroServidor(response,erro);}
}
