import {comValidacaoTemporal} from './solicitacoes.erros.js';
import {instanteEmMicrosPostgres} from './solicitacoes.datas.js';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { criarSolicitacaoSchema, listarSolicitacoesSchema, solicitacao, rejeitarSolicitacaoSchema, idDecisaoSchema, decisaoSolicitacao, agendarSolicitacaoSchema, agendamentoSolicitacao, editarSolicitacaoSchema } from './solicitacoes.schemas.js';
import { inserirSolicitacao, consultarSolicitacoes, decidirSolicitacao, agendarSolicitacao, editarSolicitacao, type LinhaSolicitacao, type ConsultaSolicitacoes, type NovaSolicitacao } from './solicitacoes.repository.js';
import type { z } from 'zod';
import { consultarAgendaSchema,consultarDisponibilidadeSchema,reagendarSolicitacaoSchema,respostaAgenda,respostaDisponibilidade } from './solicitacoes.schemas.js';
import { consultarAgenda,consultarDisponibilidade,reagendarSolicitacao } from './solicitacoes.agenda.repository.js';
import {detalheSolicitacao,consultarHistoricoSchema,respostaHistorico} from './solicitacoes.schemas.js';
import {consultarDetalhes,consultarHistorico} from './solicitacoes.detalhes.repository.js';

function validar<T>(schema: z.ZodType<T>, entrada: unknown): T {
  const result = schema.safeParse(entrada);
  if (!result.success) {
    const fields = Object.fromEntries(result.error.issues.map(issue =>
      [issue.path.join('.') || 'body', 'Informe um valor válido, sem campos adicionais.']));
    throw new ErroHttp(400, 'DADOS_INVALIDOS', 'Revise os campos informados.', fields);
  }
  return result.data;
}

/** Prepara a criação sem persistir; identidade e estado nunca vêm do corpo. */
export function prepararCriacao(body: unknown, usuario: UsuarioAutenticado): NovaSolicitacao {
  if (usuario.perfil !== 'SOLICITANTE_INTERNO') throw new ErroHttp(403, 'ACESSO_NEGADO', 'Acesso não permitido.');
  return { dados: validar(criarSolicitacaoSchema, body), solicitanteId: usuario.id, status: 'PENDENTE' };
}

/** Define o escopo obrigatório antes da futura consulta e contagem no repository. */
export function prepararConsulta(query: unknown, usuario: UsuarioAutenticado): ConsultaSolicitacoes {
  const escopo: ConsultaSolicitacoes['escopo'] = usuario.perfil === 'SOLICITANTE_INTERNO'
    ? { tipo: 'proprias', solicitanteId: usuario.id } : { tipo: 'gestao' };
  if (!['SOLICITANTE_INTERNO', 'GESTOR_FROTA', 'ADM'].includes(usuario.perfil)) {
    throw new ErroHttp(403, 'ACESSO_NEGADO', 'Acesso não permitido.');
  }
  return { filtros: validar(listarSolicitacoesSchema, query), escopo };
}

function dto(row: LinhaSolicitacao) {
  return solicitacao.parse({
    id: row.id, codigo: row.codigo, codigoExibicao: `#${row.codigo}`,
    solicitante: row.solicitante_id === null ? null : { id: row.solicitante_id, nome: row.solicitante_nome },
    origem: row.origem, destino: row.destino, finalidade: row.finalidade,
    dataHoraSaida: row.data_hora_saida, qtdPassageiros: row.qtd_passageiros, status: row.status,
  });
}

/** Persiste entrada validada e mantém códigos de integridade conhecidos no domínio HTTP. */
export async function criar(body: unknown, usuario: UsuarioAutenticado) {
  const entrada = prepararCriacao(body, usuario);
  try { return dto(await comValidacaoTemporal(()=>inserirSolicitacao(entrada))); }
  catch (erro) {
    const code = typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
    if (code === '23505') throw new ErroHttp(409, 'CODIGO_DUPLICADO', 'Já existe uma solicitação com esse código.');
    if (code === '23503') throw new ErroHttp(404, 'REFERENCIA_INEXISTENTE', 'O solicitante não foi encontrado.');
    throw erro;
  }
}

/** Projeta DTO público e paginação, com escopo determinado exclusivamente pela sessão. */
export async function listar(query: unknown, usuario: UsuarioAutenticado) {
  const consulta = prepararConsulta(query, usuario);
  const { rows, total } = await consultarSolicitacoes(consulta);
  return { data: rows.map(dto), meta: { page: consulta.filtros.page, limit: consulta.filtros.limit, total } };
}

/** Autoriza o responsável atual e decide apenas com parâmetros validados, sem aceitar identidade externa. */
export async function decidir(id: string, acao: 'aprovar' | 'rejeitar', body: unknown, usuario: UsuarioAutenticado) {
  if (!['ADM', 'GESTOR_FROTA'].includes(usuario.perfil)) throw new ErroHttp(403, 'ACESSO_NEGADO', 'Acesso não permitido.');
  const identificador = validar(idDecisaoSchema, id);
  const decisao = acao === 'aprovar'
    ? { status: 'APROVADA' as const, motivo: null }
    : { status: 'REPROVADA' as const, motivo: validar(rejeitarSolicitacaoSchema, body).motivo };
  return decisaoSolicitacao.parse(await decidirSolicitacao(identificador, usuario.id, decisao));
}

/** Valida o agendamento e usa exclusivamente o gestor autenticado como ator da auditoria. */
export async function agendar(id: string, body: unknown, usuario: UsuarioAutenticado) {
  if (!['ADM','GESTOR_FROTA'].includes(usuario.perfil)) throw new ErroHttp(403, 'ACESSO_NEGADO', 'Acesso não permitido.');
  const identificador = validar(idDecisaoSchema, id);
  const dados = validar(agendarSolicitacaoSchema, body);
  try { return agendamentoSolicitacao.parse(await comValidacaoTemporal(()=>agendarSolicitacao(identificador, usuario.id, dados))); }
  catch (erro) {
    const code = typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
    if (code === '23503') throw new ErroHttp(404, 'REFERENCIA_INEXISTENTE', 'Motorista, veículo ou responsável não encontrado.');
    if (code === '23505' || code === '23P01') throw new ErroHttp(409, 'CONFLITO_ALOCACAO', 'A alocação possui um conflito.');
    if (code === '23514') throw new ErroHttp(400, 'RETORNO_INVALIDO', 'O retorno previsto deve ser posterior à saída.');
    throw erro;
  }
}

/** Valida PATCH estrito e audita com o gestor atual; estado e identidade não vêm do corpo. */
export async function editar(id: string, body: unknown, usuario: UsuarioAutenticado) {
  if (!['ADM','GESTOR_FROTA'].includes(usuario.perfil)) throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  const identificador = validar(idDecisaoSchema, id);
  const dados = validar(editarSolicitacaoSchema, body);
  try { return dto(await comValidacaoTemporal(()=>editarSolicitacao(identificador, usuario.id, dados))); }
  catch (erro) {
    const code = typeof erro === 'object' && erro !== null && 'code' in erro ? erro.code : undefined;
    if (code === '23503') throw new ErroHttp(404,'REFERENCIA_INEXISTENTE','O responsável não foi encontrado.');
    if (code === '23514') throw new ErroHttp(400,'DADOS_INVALIDOS','A alteração não respeita as restrições da solicitação.');
    throw erro;
  }
}

function autorizarAgenda(usuario:UsuarioAutenticado) {
  if (!['ADM','GESTOR_FROTA'].includes(usuario.perfil)) throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
}

/** Consulta agenda administrativa com período limitado, paginação e DTO sem identificação privada. */
export async function listarAgenda(query:unknown,usuario:UsuarioAutenticado) {
  autorizarAgenda(usuario);
  const filtros=validar(consultarAgendaSchema,query);
  const {data,total}=await comValidacaoTemporal(()=>consultarAgenda(filtros));
  return respostaAgenda.parse({data,meta:{page:filtros.page,limit:filtros.limit,total}});
}

/** Disponibilidade é informativa; o write revalida todos os conflitos sob lock. */
export async function listarDisponibilidade(query:unknown,usuario:UsuarioAutenticado) {
  autorizarAgenda(usuario);
  return respostaDisponibilidade.parse({data:await comValidacaoTemporal(()=>consultarDisponibilidade(validar(consultarDisponibilidadeSchema,query)))});
}

/** Reagenda apenas por gestor atual, com intervalo completo e saída futura, sem nova aprovação. */
export async function reagendar(id:string,body:unknown,usuario:UsuarioAutenticado) {
  autorizarAgenda(usuario);
  const identificador=validar(idDecisaoSchema,id);
  const dados=validar(reagendarSolicitacaoSchema,body);
  const saida=instanteEmMicrosPostgres(dados.dataHoraSaida);
  if (saida===null||saida<=BigInt(Date.now())*1000n) throw new ErroHttp(400,'SAIDA_INVALIDA','A saída deve estar no futuro.');
  try {return agendamentoSolicitacao.parse(await comValidacaoTemporal(()=>reagendarSolicitacao(identificador,usuario.id,dados)));}
  catch (erro) {
    const code=typeof erro==='object' && erro!==null && 'code' in erro ? erro.code : undefined;
    if (code==='23503') throw new ErroHttp(404,'REFERENCIA_INEXISTENTE','Motorista, veículo ou responsável não encontrado.');
    if (code==='23514') throw new ErroHttp(400,'RETORNO_INVALIDO','O retorno previsto deve ser posterior à saída.');
    if (code==='23505' || code==='23P01') throw new ErroHttp(409,'CONFLITO_ALOCACAO','A alocação possui um conflito.');
    throw erro;
  }
}

function escopoDetalhes(usuario:UsuarioAutenticado):string|null {
  if(!['ADM','GESTOR_FROTA','SOLICITANTE_INTERNO'].includes(usuario.perfil))throw new ErroHttp(403,'ACESSO_NEGADO','Acesso não permitido.');
  return usuario.perfil==='SOLICITANTE_INTERNO'?usuario.id:null;
}

/** Detalhes são filtrados no SQL pela identidade atual, com DTO mínimo. */
export async function detalhar(id:string,usuario:UsuarioAutenticado) {
  const escopo=escopoDetalhes(usuario);
  return detalheSolicitacao.parse(await consultarDetalhes(validar(idDecisaoSchema,id),escopo));
}

/** Histórico não interpreta descrições; remove dados do responsável para solicitantes. */
export async function historico(id:string,query:unknown,usuario:UsuarioAutenticado) {
  const escopo=escopoDetalhes(usuario);
  const identificador=validar(idDecisaoSchema,id);
  const {page,limit}=validar(consultarHistoricoSchema,query);
  const result=await consultarHistorico(identificador,escopo,page,limit);
  const data=escopo===null?result.data:result.data.map(({id,descricao,dataHora})=>({id,descricao,dataHora}));
  return respostaHistorico.parse({data,meta:{page,limit,total:result.total}});
}
