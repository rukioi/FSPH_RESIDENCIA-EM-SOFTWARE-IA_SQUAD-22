import { z } from 'zod';
import {parametrosPeriodoDashboard,notasDashboardPeriodo} from '../../modules/dashboard/dashboard.indicadores.schemas.js';
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
import { svoConsultasSchemas } from '../../modules/svo/svo.consultas.schemas.js';
import { svoDashboardSchemas } from '../../modules/svo/svo.dashboard.schemas.js';
import { svoOperacionalSchemas } from '../../modules/svo/svo.operacional.schemas.js';
import { solicitacoesSchemas, statusSolicitacao } from '../../modules/solicitacoes/solicitacoes.schemas.js';
import { dataHoraInstitucionalSchema } from '../../modules/solicitacoes/solicitacoes.datas.js';

export const schemas = { Erro: erro, ErroString: erroString, ErroSvo: erroSvo,
  ErroUsuario: z.union([erro, erroString]), ErroOperacionalSvo: z.union([erro, erroSvo]), Exclusao: sucessoExclusao,
  ...veiculosSchemas, ...authSchemas, ...usuariosSchemas, ...auditoriaSchemas, ...motoristasSchemas,
  ...abastecimentosSchemas, ...documentosSchemas, ...dashboardSchemas, ...svoSchemas, ...svoConsultasSchemas, ...svoDashboardSchemas, ...svoOperacionalSchemas, ...solicitacoesSchemas };
export type SchemaName = keyof typeof schemas;
export type Modulo = 'auth'|'usuarios'|'auditoria'|'dashboard'|'svo'|'veiculos'|'motoristas'|'abastecimentos'|'documentos'|'solicitacoes';
export interface Operacao {
  id: string; modulo: Modulo; method: 'get'|'post'|'put'|'patch'|'delete'; path: string;
  perfis: string[]; response: SchemaName; status: number; body?: SchemaName;
  errors: number[]; runtimeValidation?:boolean; errorSchema?: SchemaName; notes: string; query?: { name: string; required: boolean; schema: z.ZodType }[];
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
    ['/api/dashboard','/api/dashboard/graficos','/api/dashboard/pendencias','/api/dashboard/gestor'][i],
    i===1?'GraficosPeriodo':i===3?'DashboardGestorIndicadores':s,gestor,
    i===1||i===3?{runtimeValidation:true,query:parametrosPeriodoDashboard,errors:[400,401,403,500],notes:notasDashboardPeriodo}:{})),
  // SCRUM-132/145/147/148 — capacidades, vínculo por motorista e execução auditada.
  op('svo','get','/api/svo/recursos-disponiveis','RecursosDisponiveisSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,500],notes:'Disponibilidade informativa: S10 própria Chevrolet com cadastro coerente, lotação ativa 0/4..4/4; CNH válida, motorista autenticável, documentos vencidos e reservas bloqueiam. Revalidar no PATCH de despacho.'}),
  op('svo','get','/api/svo/veiculos/{id}/ocupacao','OcupacaoSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,404,500],notes:'Lotação ativa calculada pela soma de quantidade_corpos de ordens despachadas e em transporte; liberada na conclusão/cancelamento.'}),
  op('svo','get','/api/svo/ordens-coleta/minhas','MinhasOrdensSvo',['MOTORISTA'],{
    errors:[400,401,403,500],notes:'Somente ordens vinculadas a motorista.usuario_id da sessão; até 100 ordens por id DESC, sem paginação nem parâmetros de consulta; a lista pode estar truncada; sem dados médicos/pessoais do solicitante.'}),
  op('svo','get','/api/svo/ordens-coleta/minhas/{id}','MinhaOrdemSvo',['MOTORISTA'],{
    errors:[400,401,403,404,500],notes:'Ordem própria mínima; IDs não vinculados retornam 404 indistinguível.'}),
  op('svo','patch','/api/svo/ordens-coleta/{id}/iniciar','OrdemExecucaoSvo',['MOTORISTA'],{
    body:'IniciarOrdemSvo',errors:[400,401,403,404,409,413,415,500],
    notes:'Exige atribuição do motorista e EM_DESLOCAMENTO ainda não iniciada; grava km inicial, data e auditoria.'}),
  op('svo','patch','/api/svo/ordens-coleta/{id}/etapa','OrdemExecucaoSvo',['MOTORISTA'],{
    errors:[400,401,403,404,409,500],notes:'EM_DESLOCAMENTO iniciada -> EM_TRANSPORTE, com log transacional.'}),
  op('svo','patch','/api/svo/ordens-coleta/{id}/concluir','OrdemExecucaoSvo',['MOTORISTA'],{
    body:'ConcluirOrdemSvo',errors:[400,401,403,404,409,413,415,500],
    notes:'EM_TRANSPORTE -> CONCLUIDA; km final não inferior ao inicial; libera lotação e audita.'}),
  op('svo','patch','/api/svo/ordens-coleta/{id}/cancelar','OrdemExecucaoSvo',['ATENDENTE_SVO'],{
    body:'CancelarOrdemSvo',errors:[400,401,403,404,409,413,415,500],
    notes:'Atendente cancela ordem ainda aberta; liberação de lotação pela exclusão do estado ativo.'}),
  op('svo','get','/api/svo/ordens-coleta','OrdensSvo',['ATENDENTE_SVO'],{errors:[400,401,403,500],errorSchema:'ErroOperacionalSvo',
    query:[{name:'status',required:true,schema:z.literal('AGUARDANDO_DESPACHO')}],notes:'status público AGUARDANDO_DESPACHO consulta PENDENTE_ALOCACAO no banco. Array direto; sem paginação.'}),
  op('svo','get','/api/svo/solicitacoes','SolicitacoesSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,500],errorSchema:'ErroOperacionalSvo',
    query:[{name:'status',required:false,schema:schemas.StatusTriagem}],
    notes:'Consulta inicial limitada a 20 registros com protocolo, estado e data. Filtros avançados, detalhes e paginação: SCRUM-146.'}),
  op('svo','post','/api/svo/solicitacoes','SolicitacaoSvo',['ATENDENTE_SVO'],{
    body:'CriarSolicitacaoSvo',errors:[400,401,403,409,413,415,500],errorSchema:'ErroOperacionalSvo',
    notes:'Registra somente a ocorrência telefônica em AGUARDANDO_TRIAGEM; nenhuma ordem até confirmação SVO na SCRUM-131.'}),
  op('svo','patch','/api/svo/solicitacoes/{id}/triagem','TriagemParcialSvo',['ATENDENTE_SVO'],{
    body:'SalvarTriagemParcialSvo',errors:[400,401,403,404,409,413,415,500],errorSchema:'ErroOperacionalSvo',
    notes:'Salva triagem parcial sem decisão ou ordem. Apenas AGUARDANDO_TRIAGEM.'}),
  op('svo','post','/api/svo/solicitacoes/{id}/triagem','TriagemFinalSvo',['ATENDENTE_SVO'],{
    body:'FinalizarTriagemSvo',status:200,errors:[400,401,403,404,409,413,415,500],errorSchema:'ErroOperacionalSvo',
    notes:'Decisão SVO/IML transacional. SVO exige quantidadeCorpos de 1 a 4 e gera uma ordem; IML não gera ordem. Nova decisão após finalização: 409.'}),
  op('svo','patch','/api/svo/ordens-coleta/{id}/despachar','OrdemDespachada',['ATENDENTE_SVO'],{body:'DespacharSvo',errors:[400,401,403,404,409,413,415,500],errorSchema:'ErroOperacionalSvo'}),
  op('svo','get','/api/svo/solicitacoes/paginadas','ListaSolicitacoesSvoPaginada',['ATENDENTE_SVO'],{
    errors:[400,401,403,500], notes:'SCRUM-146: lista paginada sem dados pessoais; datas civis inclusivas, filtro status e ordenação determinística.',
    query:[{name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'status',required:false,schema:schemas.StatusTriagem},
      {name:'inicio',required:false,schema:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)},
      {name:'fim',required:false,schema:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}]}),
  op('svo','get','/api/svo/solicitacoes/{id}','DetalheSolicitacaoSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,404,500],notes:'SCRUM-146: detalhe restrito ao atendente; recupera rascunho salvo sem finalizar decisão.'}),
  op('svo','get','/api/svo/solicitacoes/{id}/historico','HistoricoSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,404,500],notes:'SCRUM-146: somente eventos reais com descrições exatas da auditoria legada; sem eventos artificiais.',
    query:[{name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)}]}),
  op('svo','get','/api/svo/ordens-coleta/paginadas','ListaOrdensSvoPaginada',['ATENDENTE_SVO'],{
    errors:[400,401,403,500],notes:'SCRUM-146: lista paginada de ordens reais; preserva endpoint legado de despacho.',
    query:[{name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'status',required:false,schema:z.enum(['PENDENTE_ALOCACAO','EM_DESLOCAMENTO','EM_TRANSPORTE','CONCLUIDA','CANCELADA'])}]}),
  op('svo','get','/api/svo/ordens-coleta/{id}','DetalheOrdemSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,404,500],notes:'SCRUM-146: detalhe operacional autorizado, sem observações médicas.'}),
  op('svo','get','/api/svo/ordens-coleta/{id}/historico','HistoricoSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,404,500],notes:'SCRUM-146: eventos auditados de geração de ordem realmente persistidos.',
    query:[{name:'page',required:false,schema:z.string().regex(/^[1-9]\d*$/)},
      {name:'limit',required:false,schema:z.string().regex(/^[1-9]\d*$/)}]}),
  op('svo','get','/api/svo/dashboard','DashboardOperacionalSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,500],notes:'SCRUM-149: IND-10..14 com fila atual independente do período, decisões por triado_em e distribuição por criado_em.',
    query:[{name:'periodo',required:false,schema:z.enum(['hoje','7d','30d'])}]}),
  op('svo','get','/api/svo/dashboard/filas','FilasOperacionaisSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,500],notes:'SCRUM-149: saldo real atual de triagem e despacho, mais 10 itens mínimos por fila.'}),
  op('svo','get','/api/svo/dashboard/atividades','AtividadesRecentesSvo',['ATENDENTE_SVO'],{
    errors:[400,401,403,500],notes:'SCRUM-149 IND-07: eventos SVO reais, sem dados pessoais; limite 1..50.',
    query:[{name:'limite',required:false,schema:z.string().regex(/^[1-9]\d*$/)}]}),
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

/** Informa somente operações que efetivamente aplicam seus schemas no caminho HTTP. */
export function possuiValidacaoRuntime(operation:Operacao):boolean{
  return operation.runtimeValidation??['veiculos','solicitacoes'].includes(operation.modulo);
}
