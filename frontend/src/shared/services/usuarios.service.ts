import type { Perfil, Usuario } from '../../features/usuarios/dados';
import type { ApiSchemas } from '../api/generated/schema';
import { usuariosSchemas } from '../../../../backend/src/modules/usuarios/usuarios.schemas';
import { executeApi } from '../api/client';
import { parseResponse } from '../api/validation';

const perfis: Record<ApiSchemas['Usuario']['perfil'], Perfil> = {
  ADM:'ADM', GESTOR_FROTA:'Gestor da Frota', SOLICITANTE_INTERNO:'Solicitante',
  MOTORISTA:'Motorista', ATENDENTE_SVO:'Atendente SVO',
};
function converterUsuario(usuario: ApiSchemas['UsuarioStatus']): Usuario {
  if (!Number.isSafeInteger(Number(usuario.id))) throw new Error('Identificador de usuário não suportado nesta tela.');
  return {id:Number(usuario.id),nome:usuario.nome,email:usuario.email,ativo:usuario.ativo === true,perfil:perfis[usuario.perfil]};
}
function perfilApi(perfil: Perfil): ApiSchemas['Usuario']['perfil'] {
  return (Object.keys(perfis) as ApiSchemas['Usuario']['perfil'][]).find(code => perfis[code] === perfil)!;
}
export type NovoUsuario = Omit<ApiSchemas['CriarUsuario'],'perfil'> & {perfil:Perfil};
export type DadosEdicaoUsuario = Omit<ApiSchemas['EditarUsuario'],'perfil'> & {perfil:Perfil};

/** Valida o array legado inteiro e só depois converte os rótulos de apresentação. */
export async function listarUsuarios(signal?: AbortSignal): Promise<Usuario[]> {
  return (await executeApi('usuarios_get__api_admin_usuarios',{signal,parse:v=>parseResponse(usuariosSchemas.Usuarios,v)})).map(converterUsuario);
}
/** Cadastro confirmado; perfil visual é convertido somente na fronteira HTTP. */
export async function cadastrarUsuario(usuario: NovoUsuario): Promise<Usuario> {
  return converterUsuario(await executeApi('usuarios_post__api_admin_usuarios',{
    body:{...usuario,perfil:perfilApi(usuario.perfil)},parse:v=>parseResponse(usuariosSchemas.Usuario,v)}));
}
/** Edição usa o mesmo adaptador de perfil e de erros do cadastro. */
export async function editarUsuario(id:number, usuario:DadosEdicaoUsuario): Promise<Usuario> {
  return converterUsuario(await executeApi('usuarios_put__api_admin_usuarios_id_',{
    id:String(id),body:{...usuario,perfil:perfilApi(usuario.perfil)},parse:v=>parseResponse(usuariosSchemas.Usuario,v)}));
}
/** Estado desejado idempotente; a tela recebe somente a confirmação da API. */
export async function alterarStatusUsuario(id:number, ativo:boolean): Promise<Usuario> {
  return converterUsuario(await executeApi('usuarios_patch__api_admin_usuarios_id_status',{
    id:String(id),body:{ativo},parse:v=>parseResponse(usuariosSchemas.UsuarioStatus,v)}));
}
