import { z } from 'zod';
import { erro, erroString, erroSvo, sucessoExclusao, gestor, consultaFrota } from './schemas.js';
import { veiculosSchemas } from '../../modules/veiculos/veiculos.schemas.js';
import { authSchemas } from '../../modules/auth/auth.schemas.js';
import { usuariosSchemas } from '../../modules/usuarios/usuarios.schemas.js';
import { auditoriaSchemas } from '../../modules/auditoria/auditoria.schemas.js';
import { motoristasSchemas } from '../../modules/motoristas/motoristas.schemas.js';
import { abastecimentosSchemas } from '../../modules/abastecimentos/abastecimentos.schemas.js';
import { documentosSchemas } from '../../modules/documentos/documentos.schemas.js';
import { dashboardSchemas } from '../../modules/dashboard/dashboard.schemas.js';
import { svoSchemas } from '../../modules/svo/svo.schemas.js';

export const schemas = { Erro: erro, ErroString: erroString, ErroSvo: erroSvo,
  ErroUsuario: z.union([erro, erroString]), ErroOperacionalSvo: z.union([erro, erroSvo]), Exclusao: sucessoExclusao,
  ...veiculosSchemas, ...authSchemas, ...usuariosSchemas, ...auditoriaSchemas, ...motoristasSchemas,
  ...abastecimentosSchemas, ...documentosSchemas, ...dashboardSchemas, ...svoSchemas };
export type SchemaName = keyof typeof schemas;
export type Modulo = 'auth'|'usuarios'|'auditoria'|'dashboard'|'svo'|'veiculos'|'motoristas'|'abastecimentos'|'documentos';
export interface Operacao {
  id: string; modulo: Modulo; method: 'get'|'post'|'put'|'patch'|'delete'; path: string;
  perfis: string[]; response: SchemaName; status: number; body?: SchemaName;
  errors: number[]; errorSchema?: SchemaName; notes: string; query?: { name: string; required: boolean; schema: z.ZodType }[];
}
const op = (modulo: Modulo, method: Operacao['method'], path: string, response: SchemaName,
  perfis: string[], options: Partial<Omit<Operacao,'modulo'|'method'|'path'|'response'|'perfis'>> = {}): Operacao => ({
  id: modulo + '_' + method + '_' + path.replace(/\W+/g,'_'), modulo, method, path, response, perfis,
  status: method === 'post' && modulo !== 'auth' ? 201 : 200,
  errors: [...(method !== 'get' && method !== 'delete' ? [400,413,415] : []), ...(perfis.length ? [401,403] : []),500],
  notes: 'Formato atual preservado; query params não declarados são ignorados.', ...options,
});
export const operations: Operacao[] = [
  op('auth','post','/api/auth/login','Login',[],{body:'Credenciais',errors:[400,401,413,415,429,500]}),
  op('auth','get','/api/auth/sessao','Sessao',['ADM','GESTOR_FROTA','ATENDENTE_SVO','MOTORISTA','SOLICITANTE_INTERNO'],{errors:[401,500]}),
  op('usuarios','get','/api/admin/usuarios','Usuarios',['ADM']),
  op('usuarios','post','/api/admin/usuarios','Usuario',['ADM'],{body:'CriarUsuario',errorSchema:'ErroUsuario'}),
  op('usuarios','put','/api/admin/usuarios/{id}','Usuario',['ADM'],{body:'EditarUsuario',errors:[400,401,403,404,413,415,500],errorSchema:'ErroUsuario',notes:'PUT parcial. Barra final opcional.'}),
  op('usuarios','patch','/api/admin/usuarios/{id}/status','UsuarioStatus',['ADM'],{body:'StatusUsuario',errors:[400,401,403,404,413,415,500],errorSchema:'ErroUsuario',notes:'Estado explícito idempotente; barra final opcional.'}),
  op('auditoria','get','/api/admin/auditoria/logs','Auditoria',['ADM'],{errors:[400,401,403,500],notes:'Sem page/limit retorna array legado com email. Com qualquer parâmetro de paginação retorna DTO mínimo; defaults page=1, limit=20, max=100. Duplicatas/offset inseguro:400.',query:[
    {name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)}, {name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)}]}),
  ...(['Dashboard','Graficos','PendenciasDashboard','DashboardGestor'] as const).map((s,i)=>op('dashboard','get',
    ['/api/dashboard','/api/dashboard/graficos','/api/dashboard/pendencias','/api/dashboard/gestor'][i],s,gestor)),
  op('svo','get','/api/svo/ordens-coleta','OrdensSvo',['ATENDENTE_SVO'],{errors:[400,401,403,500],errorSchema:'ErroOperacionalSvo',
    query:[{name:'status',required:true,schema:z.literal('AGUARDANDO_DESPACHO')}],notes:'status público AGUARDANDO_DESPACHO consulta PENDENTE_ALOCACAO no banco. Array direto; sem paginação.'}),
  op('svo','post','/api/svo/solicitacoes','SolicitacaoSvo',['ATENDENTE_SVO'],{body:'CriarSolicitacaoSvo',errorSchema:'ErroOperacionalSvo'}),
  op('svo','patch','/api/svo/ordens-coleta/{id}/despachar','OrdemDespachada',['ATENDENTE_SVO'],{body:'DespacharSvo',errors:[400,401,403,404,409,413,415,500],errorSchema:'ErroOperacionalSvo'}),
  op('veiculos','get','/api/veiculos','ListaVeiculos',consultaFrota,{notes:'Lista completa id DESC, sem paginação. Piloto validado em runtime.'}),
  op('veiculos','post','/api/veiculos','RespostaVeiculo',gestor,{body:'CriarVeiculo',errors:[400,401,403,409,413,415,500]}),
  ...(['put','patch'] as const).map(method=>op('veiculos',method,'/api/veiculos/{id}','RespostaVeiculo',gestor,
    {body:'EditarVeiculo',errors:[400,401,403,404,409,413,415,500],notes:'Alteração parcial; campos não suportados ignorados. Sem mudança de estados/disponibilidade.'})),
  op('veiculos','delete','/api/veiculos/{id}','ExclusaoVeiculo',gestor,{errors:[401,403,404,500],notes:'200 com data.success; FK 23503 ainda recebe 500 legado, não 409.'}),
  op('motoristas','get','/api/motoristas','Motoristas',consultaFrota),
  op('motoristas','post','/api/motoristas','RespostaMotorista',gestor,{body:'CriarMotorista',errors:[400,401,403,409,413,415,500]}),
  ...(['put','patch'] as const).map(method=>op('motoristas',method,'/api/motoristas/{id}','RespostaMotorista',gestor,{body:'EditarMotorista',errors:[400,401,403,404,409,413,415,500]})),
  op('motoristas','delete','/api/motoristas/{id}','Exclusao',gestor,{errors:[401,403,404,500]}),
  op('abastecimentos','get','/api/abastecimentos','Abastecimentos',gestor),
  op('abastecimentos','post','/api/abastecimentos','RespostaAbastecimento',gestor,{body:'CriarAbastecimento'}),
  op('documentos','get','/api/documentos','Documentos',gestor),
  op('documentos','get','/api/documentos/pendencias','PendenciasDocumentos',gestor),
  op('documentos','post','/api/documentos','RespostaDocumento',gestor,{body:'CriarDocumento'}),
];

/** Mantém correspondência exata com os caminhos existentes, inclusive a barra opcional de usuários. */
export function routePattern(operation: Operacao): RegExp {
  const path = operation.path.replace(/\{id\}/g, '[0-9]+');
  return new RegExp('^' + path + (operation.modulo === 'usuarios' && path.includes('[0-9]+') ? '/?' : '') + '$');
}
