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
import { solicitacoesSchemas, statusSolicitacao } from '../../modules/solicitacoes/solicitacoes.schemas.js';
import { dataHoraInstitucionalSchema } from '../../modules/solicitacoes/solicitacoes.datas.js';

export const schemas = { Erro: erro, ErroString: erroString, ErroSvo: erroSvo,
  ErroUsuario: z.union([erro, erroString]), ErroOperacionalSvo: z.union([erro, erroSvo]), Exclusao: sucessoExclusao,
  ...veiculosSchemas, ...authSchemas, ...usuariosSchemas, ...auditoriaSchemas, ...motoristasSchemas,
  ...abastecimentosSchemas, ...documentosSchemas, ...dashboardSchemas, ...svoSchemas, ...solicitacoesSchemas };
export type SchemaName = keyof typeof schemas;
export type Modulo = 'auth'|'usuarios'|'auditoria'|'dashboard'|'svo'|'veiculos'|'motoristas'|'abastecimentos'|'documentos'|'solicitacoes';
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
  op('solicitacoes','get','/api/solicitacoes-viagem/{id}','RespostaDetalheSolicitacaoViagem',['ADM','GESTOR_FROTA','SOLICITANTE_INTERNO'],{
    errors:[400,401,403,404,500],notes:'Solicitante acessa somente pedido próprio; ausente/inacessível recebe o mesmo 404. Dados mínimos, finalidade/retorno/recursos legados podem ser null.'}),
  op('solicitacoes','get','/api/solicitacoes-viagem/{id}/historico','RespostaHistoricoSolicitacaoViagem',['ADM','GESTOR_FROTA','SOLICITANTE_INTERNO'],{
    errors:[400,401,403,404,500],notes:'Vínculo estruturado log_atividade.solicitacao_viagem_id; sem busca textual ou backfill. data_hora ASC NULLS LAST, id ASC. page=1,limit=20 máximo100. Solicitante não recebe responsável interno. Auditoria sem fuso, sem inferência de offset histórico.',
    query:[{name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},{name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)}]}),
  op('solicitacoes','get','/api/solicitacoes-viagem/agenda','RespostaAgendaViagem',gestor,{
    errors:[400,401,403,500],notes:'Período inicio/fim ISO com offset, até 31 dias. Só AGENDADA intersectando [inicio,fim). page=1, limit=20 (máximo 100). Dados mínimos e recursos; retorno legado ausente é null, sem fim presumido.',
    query:[{name:'inicio',required:true,schema:dataHoraInstitucionalSchema},{name:'fim',required:true,schema:dataHoraInstitucionalSchema},
      {name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},{name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)}]}),
  op('solicitacoes','get','/api/solicitacoes-viagem/disponibilidade','RespostaDisponibilidadeViagem',gestor,{
    errors:[400,401,403,500],notes:'inicio/fim ISO com offset, até 31 dias. Recursos DISPONIVEL sem reservas institucionais conflitantes ou SVO ativo. Consulta informativa, não garante reserva. Query estrita; sem paginação.',
    query:[{name:'inicio',required:true,schema:dataHoraInstitucionalSchema},{name:'fim',required:true,schema:dataHoraInstitucionalSchema}]}),
  op('solicitacoes','post','/api/solicitacoes-viagem/{id}/reagendar','RespostaAgendamentoSolicitacaoViagem',gestor,{
    status:200,body:'ReagendarSolicitacaoViagem',errors:[400,401,403,404,409,413,415,500],
    notes:'Somente AGENDADA; exige saída futura e intervalo válido. Corpo completo: saída, retorno, motoristaId e veiculoId. Mantém AGENDADA. Exclui própria reserva; bloqueia recursos antigos/novos ordenados; revalida conflitos e audita atomicamente.'}),
  op('solicitacoes','patch','/api/solicitacoes-viagem/{id}','RespostaSolicitacaoViagem',gestor,{
    status:200, body:'EditarSolicitacaoViagem', errors:[400,401,403,404,409,413,415,500],
    notes:'PATCH estrito e não vazio: origem, destino, finalidade, dataHoraSaida e qtdPassageiros. PENDENTE permanece PENDENTE; APROVADA retorna a PENDENTE. Outros estados:409. Edição e auditoria atômicas sob bloqueio de linha. Sem cancelamento ou edição de recursos/retorno.'}),
  op('solicitacoes','post','/api/solicitacoes-viagem/{id}/agendar','RespostaAgendamentoSolicitacaoViagem',gestor,{
    status:200, body:'AgendarSolicitacaoViagem', errors:[400,401,403,404,409,413,415,500],
    notes:'Somente APROVADA → AGENDADA. Saída vem do pedido; retorno posterior normalizado para America/Maceio. Intervalo [saída, retorno), recursos DISPONIVEL e sem conflito institucional/SVO. Reserva e auditoria atômicas.'}),
  op('solicitacoes','post','/api/solicitacoes-viagem/{id}/aprovar','RespostaDecisaoSolicitacaoViagem',gestor,{
    status:200, errors:[400,401,403,404,409,500], notes:'Sem corpo (conteúdo recebido é ignorado). Somente PENDENTE → APROVADA; decisão e auditoria na mesma transação com bloqueio de linha. Não agenda nem aloca recursos.'}),
  op('solicitacoes','post','/api/solicitacoes-viagem/{id}/rejeitar','RespostaDecisaoSolicitacaoViagem',gestor,{
    status:200, body:'RejeitarSolicitacaoViagem', errors:[400,401,403,404,409,413,415,500], notes:'Corpo estrito {motivo}, texto não vazio após trim. Somente PENDENTE → REPROVADA. Motivo persistido; ator pela sessão; auditoria transacional sem motivo privado na descrição.'}),
  op('solicitacoes','post','/api/solicitacoes-viagem','RespostaSolicitacaoViagem',['SOLICITANTE_INTERNO'],{
    body:'CriarSolicitacaoViagem', errors:[400,401,403,404,409,413,415,500],
    notes:'Corpo estrito; identidade pela sessão; PENDENTE. Código armazenado TRP-n, apresentação #TRP-n. Saída normalizada para America/Maceio sem fuso no banco. Criação e auditoria atômicas.'}),
  op('solicitacoes','get','/api/solicitacoes-viagem','ListaSolicitacoesViagem',['SOLICITANTE_INTERNO','GESTOR_FROTA','ADM'],{
    errors:[400,401,403,500], notes:'Solicitante vê somente seus pedidos; ADM/Gestor veem todos. id DESC. Query estrita, sem duplicatas; page=1, limit=20 (máximo 100). Horários históricos presumidos locais, sem conversão. Finalidade antiga pode ser null.',
    query:[{name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'status',required:false,schema:statusSolicitacao}]}),
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
  op('svo','get','/api/svo/solicitacoes','SolicitacoesSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,500],errorSchema:'ErroOperacionalSvo',
    query:[{name:'status',required:false,schema:schemas.StatusTriagem}],
    notes:'Consulta inicial limitada a 20 registros com protocolo, estado e data. Filtros avançados, detalhes e paginação: SCRUM-146.'}),
  op('svo','post','/api/svo/solicitacoes','SolicitacaoSvo',['ATENDENTE_SVO'],{
    body:'CriarSolicitacaoSvo',errors:[400,401,403,409,413,415,500],errorSchema:'ErroOperacionalSvo',
    notes:'Registra somente a ocorrência telefônica em AGUARDANDO_TRIAGEM; nenhuma ordem até confirmação SVO na SCRUM-131.'}),
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
  op('abastecimentos','post','/api/abastecimentos','RespostaAbastecimento',gestor,{body:'CriarAbastecimento',errors:[400,401,403,404,413,415,500]}),
  op('documentos','get','/api/documentos','Documentos',gestor),
  op('documentos','get','/api/documentos/pendencias','PendenciasDocumentos',gestor),
  op('documentos','post','/api/documentos','RespostaDocumento',gestor,{body:'CriarDocumento'}),
];

/** Mantém correspondência exata com os caminhos existentes, inclusive a barra opcional de usuários. */
export function routePattern(operation: Operacao): RegExp {
  const path = operation.path.replace(/\{id\}/g, '[0-9]+');
  return new RegExp('^' + path + (operation.modulo === 'usuarios' && path.includes('[0-9]+') ? '/?' : '') + '$');
}
