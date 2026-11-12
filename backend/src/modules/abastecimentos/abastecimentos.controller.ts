import type { IncomingMessage, ServerResponse } from 'node:http';
import { lerCorpoJson } from '../../shared/http/body.js';
import { enviarJson, enviarErro } from '../../shared/http/json.js';
import { tratarErroTecnico } from '../../shared/http/errors.js';
import { cadastrarAbastecimento, detalharAbastecimento, obterIndicadoresAbastecimentos, listarAbastecimentos as listar } from './abastecimentos.service.js';
import { consultarComprovante } from './abastecimentos.repository.js';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { consultarUltimoAnexo, enviarArquivo, lerAnexo, salvarAnexo } from '../anexos/anexos.service.js';
import { registroId } from '../anexos/anexos.schemas.js';
import { ErroHttp } from '../../shared/http/errors.js';

/** Consulta coleção/histórico por sessão autorizada, sem SQL no adaptador HTTP. */
export async function listarAbastecimentos(req:IncomingMessage,res:ServerResponse,veiculoId?:string) {
  try { enviarJson(res,200,await listar(new URL(req.url??'', 'http://localhost').searchParams,veiculoId)); }
  catch(error) { tratarErroTecnico(res,error); }
}

/** Recupera o detalhe persistido usando o envelope publicado. */
export async function obterAbastecimento(res:ServerResponse,id:string) {
  try { enviarJson(res,200,await detalharAbastecimento(id)); }
  catch(error) { tratarErroTecnico(res,error); }
}

/** Entrega agregados filtrados do servidor, sem cálculo operacional no frontend. */
export async function indicadoresAbastecimentos(req:IncomingMessage,res:ServerResponse) {
  try { enviarJson(res,200,await obterIndicadoresAbastecimentos(new URL(req.url??'','http://localhost').searchParams)); }
  catch(error) { tratarErroTecnico(res,error); }
}

/** Lê corpo limitado e confirma sucesso somente após a transação no servidor. */
export async function criarAbastecimento(req:IncomingMessage,res:ServerResponse,autorId:string) {
  try { enviarJson(res,201,await cadastrarAbastecimento(await lerCorpoJson(req,1500*1024),autorId)); }
  catch(error) { tratarErroTecnico(res,error); }
}

/** Download do último comprovante compartilhado; conserva o legado quando ainda não migrado. */
export async function baixarComprovante(res:ServerResponse,id:string,usuario:UsuarioAutenticado) {
  try {
    if(!/^[0-9]{1,19}$/.test(id)||BigInt(id)>9223372036854775807n) {
      enviarErro(res,404,'NAO_ENCONTRADO','Comprovante não encontrado.'); return;
    }
    const row=await consultarUltimoAnexo(usuario,{tipoRegistro:'ABASTECIMENTO',registroId:id}) ?? await consultarComprovante(id);
    if(!row?.dados) { enviarErro(res,404,'NAO_ENCONTRADO','Comprovante não encontrado.'); return; }
    await enviarArquivo(res,row);
  } catch(error) { tratarErroTecnico(res,error); }
}

/** Comprovante usa exatamente validação, transação e storage da SCRUM-194. */
export async function enviarComprovante(req:IncomingMessage,res:ServerResponse,id:string,usuario:UsuarioAutenticado) {
  try {
    if(!registroId.safeParse(id).success) throw new ErroHttp(404,'NAO_ENCONTRADO','Abastecimento não encontrado.');
    const {vinculo,arquivo}=await lerAnexo(req,{tipoRegistro:'ABASTECIMENTO',registroId:id});
    enviarJson(res,201,await salvarAnexo(usuario,vinculo,arquivo));
  } catch(error) { req.resume(); tratarErroTecnico(res,error); }
}
