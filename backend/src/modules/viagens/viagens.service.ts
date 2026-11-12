import { corrigirQuilometragemSchema,correcaoViagemSchema,itemCorrecaoViagemSchema } from './viagens.correcao.schemas.js';
import { corrigirQuilometragem } from './viagens.correcao.repository.js';
import { evidenciaMetadadosSchema, evidenciaBinariaSchema } from './viagens.evidencias.schemas.js';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { criarViagemSchema, consultaMinhasViagens, viagemMotorista, executarViagemSchema, execucaoViagemSchema, validacaoViagemSchema, consultaViagensSchema, consultaHistoricoViagemSchema, detalheViagemSchema, eventoViagemSchema } from './viagens.schemas.js';
import { obterViagemPorSolicitacao, consultarMinhasViagens, executarViagem, validarViagem, listarViagens, detalharViagem, historicoViagem, listarCorrecoes, listarEvidencias, baixarEvidencia } from './viagens.repository.js';

/** Valida filtros e restringe a consulta à identidade efetiva da sessão. */
export async function listarMinhasViagens(query: unknown, usuario: UsuarioAutenticado) {
  if (usuario.perfil !== 'MOTORISTA') throw new ErroHttp(403, 'ACESSO_NEGADO', 'Acesso não permitido.');
  const resultado = consultaMinhasViagens.safeParse(query);
  if (!resultado.success) throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Revise os filtros informados.');
  const { rows, total } = await consultarMinhasViagens(usuario.id, resultado.data);
  return { data: rows.map(row => viagemMotorista.parse(row)), meta: { page: resultado.data.page, limit: resultado.data.limit, total } };
}

/** Retorna a viagem criada no agendamento; pedidos antigos sem viagem exigem analise manual. */
export async function criarOuConsultar(body:unknown,usuario:UsuarioAutenticado) {
  if(!['ADM','GESTOR_FROTA'].includes(usuario.perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso nao permitido.');
  const dados=criarViagemSchema.safeParse(body);if(!dados.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os dados informados.');
  const id=await obterViagemPorSolicitacao(dados.data.solicitacaoId);
  return detalheViagemSchema.parse(await detalharViagem(id,null));
}

/** Valida a ação antes de executar sua transação. */
export async function executar(id:string, acao:'iniciar'|'concluir', body:unknown, usuario:UsuarioAutenticado) {
  if(usuario.perfil!=='MOTORISTA') throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  const dados=executarViagemSchema.safeParse(body);
  if(!dados.success || !/^[0-9]{1,19}$/.test(id) || BigInt(id)>9223372036854775807n) throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os dados informados.');
  return execucaoViagemSchema.parse(await executarViagem(id,usuario.id,acao,dados.data.quilometragem,dados.data.foto));
}

/** Autoriza o responsável atual e valida o identificador antes da transação. */
export async function validar(id:string,usuario:UsuarioAutenticado) {
  if(!['ADM','GESTOR_FROTA'].includes(usuario.perfil)) throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  if(!/^[0-9]{1,19}$/.test(id)||BigInt(id)>9223372036854775807n) throw new ErroHttp(400,'DADOS_INVALIDOS','Identificador inválido.');
  return validacaoViagemSchema.parse(await validarViagem(id,usuario.id));
}

function idConsulta(id:string) { if(!/^[0-9]{1,19}$/.test(id)||BigInt(id)>9223372036854775807n)throw new ErroHttp(400,'DADOS_INVALIDOS','Identificador inválido.');return id; }
function escopo(usuario:UsuarioAutenticado) {if(!['ADM','GESTOR_FROTA','MOTORISTA'].includes(usuario.perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');return usuario.perfil==='MOTORISTA'?usuario.id:null;}
/** Lista administrativa com filtros validados. */
export async function listarAdministrativo(query:unknown,usuario:UsuarioAutenticado) {
  if(!['ADM','GESTOR_FROTA'].includes(usuario.perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  const f=consultaViagensSchema.safeParse(query);if(!f.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os filtros informados.');
  const {dados,total}=await listarViagens(f.data);return {data:dados.map(v=>detalheViagemSchema.parse(v)),meta:{page:f.data.page,limit:f.data.limit,total}};
}
/** Lista viagens concluidas aguardando validacao pela gestao. */
export async function pendentesValidacao(query:Record<string,unknown>,usuario:UsuarioAutenticado) {
  if(!['ADM','GESTOR_FROTA'].includes(usuario.perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso nao permitido.');
  if(Object.keys(query).some(k=>!['pagina','limit'].includes(k)))throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os filtros informados.');
  const f=consultaHistoricoViagemSchema.safeParse({page:query.pagina,limit:query.limit});
  if(!f.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os filtros informados.');
  const {dados,total}=await listarViagens({page:f.data.page,limit:f.data.limit,pendenteValidacao:true});
  return {data:dados.map(v=>detalheViagemSchema.parse(v)),meta:{page:f.data.page,limit:f.data.limit,total}};
}
/** Aplica o escopo de motorista à consulta de detalhes. */
export async function detalhes(id:string,usuario:UsuarioAutenticado) {return detalheViagemSchema.parse(await detalharViagem(idConsulta(id),escopo(usuario)));}
/** Consulta somente eventos reais da viagem acessível. */
export async function historico(id:string,query:unknown,usuario:UsuarioAutenticado) {
  const f=consultaHistoricoViagemSchema.safeParse(query);if(!f.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os filtros informados.');
  const {eventos,total}=await historicoViagem(idConsulta(id),escopo(usuario),f.data.page,f.data.limit);return {data:eventos.map(e=>eventoViagemSchema.parse(e)),meta:{page:f.data.page,limit:f.data.limit,total}};
}

/** Autoriza e pagina os metadados das evidências da viagem. */
export async function consultarEvidencias(id:string,query:unknown,usuario:UsuarioAutenticado) {
  const f=consultaHistoricoViagemSchema.safeParse(query);if(!f.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os filtros informados.');
  const {dados,total}=await listarEvidencias(idConsulta(id),escopo(usuario),f.data.page,f.data.limit);
  return {data:dados.map(e=>evidenciaMetadadosSchema.parse(e)),meta:{page:f.data.page,limit:f.data.limit,total}};
}
/** Autoriza o download pelo vínculo da viagem com o motorista atual. */
export async function obterEvidencia(id:string,usuario:UsuarioAutenticado) {return evidenciaBinariaSchema.parse(await baixarEvidencia(idConsulta(id),escopo(usuario)));}

/** Autoriza a correção e valida o corpo antes da transação. */
export async function corrigir(id:string,body:unknown,usuario:UsuarioAutenticado) {
  if(!['ADM','GESTOR_FROTA'].includes(usuario.perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  const dados=corrigirQuilometragemSchema.safeParse(body);if(!dados.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os dados informados.');
  return correcaoViagemSchema.parse(await corrigirQuilometragem(idConsulta(id),usuario.id,dados.data));
}
/** Lista as correções versionadas acessíveis à gestão. */
export async function consultarCorrecoes(id:string,query:unknown,usuario:UsuarioAutenticado) {
  if(!['ADM','GESTOR_FROTA'].includes(usuario.perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  const f=consultaHistoricoViagemSchema.safeParse(query);if(!f.success)throw new ErroHttp(400,'DADOS_INVALIDOS','Revise os filtros informados.');
  const {dados,total}=await listarCorrecoes(idConsulta(id),f.data.page,f.data.limit);
  return {data:dados.map(d=>itemCorrecaoViagemSchema.parse(d)),meta:{page:f.data.page,limit:f.data.limit,total}};
}
