import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { AddressInfo } from 'node:net';

vi.mock('../../src/modules/usuarios/usuarios.repository.js', () => ({
  consultarIdentidade: async (id: string) => {
    const perfil = ({ '1': 'SOLICITANTE_INTERNO', '2': 'GESTOR_FROTA', '3': 'ADM', '4': 'MOTORISTA', '5': 'ATENDENTE_SVO' } as Record<string, string>)[id];
    return perfil ? { id, perfil, ativo: true, nome: 'Fixture', email: 'fixture@example.invalid' } : undefined;
  },
}));
vi.mock('../../src/database/connection.js', () => ({ sql: () => { throw new Error('Banco proibido neste teste'); } }));
vi.mock('../../src/modules/solicitacoes/solicitacoes.repository.js', () => ({
  inserirSolicitacao: vi.fn(), consultarSolicitacoes: vi.fn(), decidirSolicitacao: vi.fn(), agendarSolicitacao: vi.fn(), editarSolicitacao: vi.fn(),
}));
vi.mock('../../src/modules/solicitacoes/solicitacoes.agenda.repository.js',()=>({
  consultarAgenda:vi.fn(),consultarDisponibilidade:vi.fn(),reagendarSolicitacao:vi.fn(),
}));
vi.mock('../../src/modules/solicitacoes/solicitacoes.detalhes.repository.js',()=>({consultarDetalhes:vi.fn(),consultarHistorico:vi.fn()}));

import { criarJwt } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { inserirSolicitacao, consultarSolicitacoes, decidirSolicitacao, agendarSolicitacao, editarSolicitacao } from '../../src/modules/solicitacoes/solicitacoes.repository.js';
import { ErroHttp } from '../../src/shared/http/errors.js';
import { consultarAgenda,consultarDisponibilidade,reagendarSolicitacao } from '../../src/modules/solicitacoes/solicitacoes.agenda.repository.js';
import {consultarDetalhes,consultarHistorico} from '../../src/modules/solicitacoes/solicitacoes.detalhes.repository.js';
import { prepararCriacao, prepararConsulta } from '../../src/modules/solicitacoes/solicitacoes.service.js';
import { criarSolicitacaoSchema, listarSolicitacoesSchema, parametrosSolicitacoes } from '../../src/modules/solicitacoes/solicitacoes.schemas.js';

const body = { origem: 'Sede', destino: 'Unidade', finalidade: 'Visita institucional', dataHoraSaida: '2026-11-10T08:00:00-03:00', qtdPassageiros: 3 };
const usuario = { id: '1', perfil: 'SOLICITANTE_INTERNO' };
const server = createApp();
const row = { id: '1024', codigo: 'TRP-1024', solicitante_id: '1', solicitante_nome: 'Fixture',
  origem: 'Sede', destino: 'Unidade', finalidade: 'Visita institucional', data_hora_saida: '2026-11-10T08:00:00.000000-03:00', qtd_passageiros: 3, status: 'PENDENTE' as const };
beforeEach(() => {
  vi.mocked(inserirSolicitacao).mockReset().mockResolvedValue(row);
  vi.mocked(consultarSolicitacoes).mockReset().mockResolvedValue({ rows: [row], total: 1 });
  vi.mocked(decidirSolicitacao).mockReset().mockImplementation(async (id, _ator, decisao) => ({ id, status: decisao.status, motivoRejeicao: decisao.motivo }));
  vi.mocked(agendarSolicitacao).mockReset().mockResolvedValue({ id:'1024',status:'AGENDADA',motoristaId:'12',veiculoId:'34',dataHoraSaida:row.data_hora_saida,dataHoraRetornoPrevisto:'2026-11-10T17:00:00-03:00' });
  vi.mocked(editarSolicitacao).mockReset().mockResolvedValue({...row,origem:'Nova sede'});
  vi.mocked(consultarAgenda).mockReset().mockResolvedValue({data:[],total:0});
  vi.mocked(consultarDisponibilidade).mockReset().mockResolvedValue({motoristas:[{id:'12',nome:'Motorista'}],veiculos:[{id:'34',placa:'TEST123',modelo:'Modelo'}]});
  vi.mocked(reagendarSolicitacao).mockReset().mockResolvedValue({id:'1024',status:'AGENDADA',motoristaId:'12',veiculoId:'34',dataHoraSaida:'2099-11-10T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-11-10T17:00:00-03:00'});
  vi.mocked(consultarDetalhes).mockReset().mockResolvedValue({id:'1024',codigo:'TRP-1024',codigoExibicao:'#TRP-1024',solicitante:{id:'1',nome:'Fixture'},
    origem:'Sede',destino:'Unidade',finalidade:null,status:'AGENDADA',qtdPassageiros:3,dataHoraSaida:row.data_hora_saida,
    motivoRejeicao:null,dataHoraRetornoPrevisto:'2099-11-10T17:00:00-03:00',motorista:{id:'12',nome:'Motorista'},veiculo:{id:'34',placa:'TEST123',modelo:'Modelo'}});
  vi.mocked(consultarHistorico).mockReset().mockResolvedValue({data:[{id:'55',descricao:'Aprovou a solicitação de transporte ID 1024',dataHora:'2026-11-04T10:00:00.000000',responsavel:{id:'2',nome:'Gestor'}}],total:1});
});
let base: string;
beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/solicitacoes-viagem`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

async function call(method: string, id?: string, payload: unknown = body, query = '') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (id) headers.Authorization = `Bearer ${await criarJwt({ id, perfil: 'ADM' })}`;
  return fetch(base + query, { method, headers, body: method === 'POST' || method === 'PATCH' ? JSON.stringify(payload) : undefined });
}

test.each([
  { origem: '' }, { origem: ' '.repeat(5) }, { origem: 'x'.repeat(256) }, { destino: '' }, { destino: 'x'.repeat(256) },
  { finalidade: '' }, { finalidade: null }, { dataHoraSaida: '2026-02-30T08:00:00-03:00' },
  { dataHoraSaida: '2026-11-10T08:00:00' }, { qtdPassageiros: 0 }, { qtdPassageiros: 1.5 },
  { qtdPassageiros: '3' }, { qtdPassageiros: 2147483648 }, { solicitanteId: '99' }, { solicitante_id: '99' },
  { status: 'AGENDADA' }, { codigo: 'injetado' }, { desconhecido: true },
])('POST rejeita entrada inválida %j', patch => {
  expect(criarSolicitacaoSchema.safeParse({ ...body, ...patch }).success).toBe(false);
});

test('criação usa exclusivamente a sessão e não muda o instante recebido', () => {
  expect(prepararCriacao(body, usuario)).toEqual({ dados: body, solicitanteId: '1', status: 'PENDENTE' });
  expect(() => prepararCriacao({ ...body, solicitanteId: '2' }, usuario)).toThrow();
});

test.each(['page=0', 'page=1.5', 'limit=101', 'limit=0', 'page=1&page=2', 'status=CANCELADA', 'solicitanteId=2', 'x=1', 'page=9007199254740991&limit=100'])('GET rejeita consulta inválida %s', query => {
  expect(listarSolicitacoesSchema.safeParse(parametrosSolicitacoes(new URLSearchParams(query))).success).toBe(false);
});

test('escopo de cada solicitante é obrigatório e não pode ser substituído pelo filtro', () => {
  for (const id of ['1', '9007199254740993']) {
    expect(prepararConsulta({}, { ...usuario, id })).toEqual({ filtros: { page: 1, limit: 20 }, escopo: { tipo: 'proprias', solicitanteId: id } });
  }
  expect(() => prepararConsulta({ solicitanteId: '2' }, usuario)).toThrow();
  for (const perfil of ['ADM', 'GESTOR_FROTA']) {
    expect(prepararConsulta({ status: 'PENDENTE' }, { id: '2', perfil }).escopo).toEqual({ tipo: 'gestao' });
  }
});

test.each(['GET', 'POST'])('%s sem sessão ou com usuário inexistente retorna 401', async method => {
  expect((await call(method)).status).toBe(401);
  expect((await call(method, '99')).status).toBe(401);
});

test.each([['POST', '2'], ['POST', '3'], ['POST', '4'], ['POST', '5'], ['GET', '4'], ['GET', '5']])('%s nega perfil da identidade %s com 403', async (method, id) => {
  expect((await call(method, id)).status).toBe(403);
});

test('entrada inválida nunca chega à persistência', async () => {
  expect((await call('POST', '1', { ...body, solicitanteId: '2' })).status).toBe(400);
  expect((await call('GET', '1', undefined, '?page=1&page=2')).status).toBe(400);
  expect(inserirSolicitacao).not.toHaveBeenCalled();
  expect(consultarSolicitacoes).not.toHaveBeenCalled();
});

test('POST publicado retorna 201, identidade efetiva, código de apresentação e finalidade', async () => {
  const response = await call('POST', '1');
  expect(response.status).toBe(201);
  expect(response.headers.get('X-Request-Id')).toBeTruthy();
  expect(await response.json()).toMatchObject({ data: { id: '1024', codigo: 'TRP-1024', codigoExibicao: '#TRP-1024', solicitante: { id: '1', nome: 'Fixture' }, finalidade: body.finalidade, dataHoraSaida: row.data_hora_saida, status: 'PENDENTE' } });
  expect(inserirSolicitacao).toHaveBeenCalledWith({ dados: body, solicitanteId: '1', status: 'PENDENTE' });
});

test.each([['1', { tipo: 'proprias', solicitanteId: '1' }], ['2', { tipo: 'gestao' }], ['3', { tipo: 'gestao' }]])('GET da identidade %s aplica escopo e paginação no repository', async (id, escopo) => {
  const response = await call('GET', id, undefined, '?page=2&limit=5&status=PENDENTE');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ data: [{ solicitante: { id: '1' } }], meta: { page: 2, limit: 5, total: 1 } });
  expect(consultarSolicitacoes).toHaveBeenCalledWith({ filtros: { page: 2, limit: 5, status: 'PENDENTE' }, escopo });
});

test('GET mantém finalidade null e horários locais antigos sem converter', async () => {
  vi.mocked(consultarSolicitacoes).mockResolvedValueOnce({ rows: [{ ...row, finalidade: null }], total: 1 });
  const response = await call('GET', '1');
  expect(await response.json()).toMatchObject({ data: [{ finalidade: null, dataHoraSaida: row.data_hora_saida }] });
});

test.each([['23505',409], ['23503',404]])('POST mapeia integridade %s para %s', async (code, status) => {
  vi.mocked(inserirSolicitacao).mockRejectedValueOnce({ code });
  expect((await call('POST', '1')).status).toBe(status);
});

test('POST não responde sucesso antes da persistência confirmar', async () => {
  let resolve!: (value: typeof row) => void;
  let entered!: () => void;
  const started = new Promise<void>(done => { entered = done; });
  vi.mocked(inserirSolicitacao).mockImplementationOnce(() => { entered(); return new Promise(done => { resolve = done; }); });
  let finished = false;
  const request = call('POST', '1').then(response => { finished = true; return response; });
  await started;
  expect(finished).toBe(false);
  resolve(row);
  expect((await request).status).toBe(201);
});

test.each(['aprovar','rejeitar'])('decisão %s exige sessão e nega solicitante, motorista e SVO', async acao => {
  expect((await call('POST', undefined, { motivo: 'Justificativa' }, '/1024/' + acao)).status).toBe(401);
  for (const id of ['1','4','5']) {
    expect((await call('POST', id, { motivo: 'Justificativa' }, '/1024/' + acao)).status).toBe(403);
  }
  expect(decidirSolicitacao).not.toHaveBeenCalled();
});

test.each(['2','3'])('ADM/Gestor %s decide com identidade atual da sessão e motivo normalizado', async id => {
  const aprovado = await call('POST', id, undefined, '/1024/aprovar');
  expect(aprovado.status).toBe(200);
  expect(await aprovado.json()).toEqual({ data: { id:'1024', status:'APROVADA', motivoRejeicao:null } });
  expect(decidirSolicitacao).toHaveBeenLastCalledWith('1024', id, { status:'APROVADA', motivo:null });
  const rejeitado = await call('POST', id, { motivo:'  Sem justificativa institucional  ' }, '/1024/rejeitar');
  expect(rejeitado.status).toBe(200);
  expect(await rejeitado.json()).toEqual({ data: { id:'1024', status:'REPROVADA', motivoRejeicao:'Sem justificativa institucional' } });
  expect(decidirSolicitacao).toHaveBeenLastCalledWith('1024', id, { status:'REPROVADA', motivo:'Sem justificativa institucional' });
});

test.each([{}, {motivo:''}, {motivo:'   '}, {motivo:null}, {motivo:42}, {motivo:'válido',responsavelId:'1'}])('rejeição inválida %j recebe 400 sem decisão', async payload => {
  expect((await call('POST', '2', payload, '/1024/rejeitar')).status).toBe(400);
  expect(decidirSolicitacao).not.toHaveBeenCalled();
});

test.each([404,409])('decisão propaga erro de domínio %s', async status => {
  vi.mocked(decidirSolicitacao).mockRejectedValueOnce(new ErroHttp(status,'DECISAO_RECUSADA','Decisão recusada.'));
  expect((await call('POST', '2', undefined, '/1024/aprovar')).status).toBe(status);
});

test('ID além de BIGINT recebe 400 e GET aceita APROVADA sem quebrar o DTO', async () => {
  expect((await call('POST','2',undefined,'/9223372036854775808/aprovar')).status).toBe(400);
  expect(decidirSolicitacao).not.toHaveBeenCalled();
  vi.mocked(consultarSolicitacoes).mockResolvedValueOnce({ rows:[{...row,status:'APROVADA'}],total:1 });
  const response = await call('GET','1',undefined,'?status=APROVADA');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({data:[{status:'APROVADA'}]});
});

test('decisões só expõem POST; outros métodos recebem 405 com Allow', async () => {
  const response = await call('GET','2',undefined,'/1024/aprovar');
  expect(response.status).toBe(405);
  expect(response.headers.get('Allow')).toBe('POST');
  expect(decidirSolicitacao).not.toHaveBeenCalled();
});

const agenda = {motoristaId:'12',veiculoId:'34',dataHoraRetornoPrevisto:'2026-11-10T17:00:00-03:00'};
test.each(['2','3'])('gestor/ADM %s agenda usando ator da sessão', async id => {
  const response = await call('POST',id,agenda,'/1024/agendar');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({data:{status:'AGENDADA',motoristaId:'12',veiculoId:'34'}});
  expect(agendarSolicitacao).toHaveBeenCalledWith('1024',id,agenda);
});
test('agendamento exige sessão e nega solicitante, motorista e SVO', async () => {
  expect((await call('POST',undefined,agenda,'/1024/agendar')).status).toBe(401);
  for (const id of ['1','4','5']) expect((await call('POST',id,agenda,'/1024/agendar')).status).toBe(403);
  expect(agendarSolicitacao).not.toHaveBeenCalled();
});
test.each([{motoristaId:12},{veiculoId:'9223372036854775808'},{dataHoraRetornoPrevisto:'2026-11-10T17:00:00'},{dataHoraSaida:'2026-11-10T08:00:00-03:00'},{responsavelId:'1'}])('agendamento rejeita entrada %j', async patch => {
  expect((await call('POST','2',{...agenda,...patch},'/1024/agendar')).status).toBe(400);
  expect(agendarSolicitacao).not.toHaveBeenCalled();
});
test.each([400,404,409])('agendamento propaga erro de domínio %s', async status => {
  vi.mocked(agendarSolicitacao).mockRejectedValueOnce(new ErroHttp(status,'AGENDAMENTO_RECUSADO','Agendamento recusado.'));
  expect((await call('POST','2',agenda,'/1024/agendar')).status).toBe(status);
});
test.each([['23503',404],['23505',409],['23514',400]])('agendamento mapeia SQLSTATE %s', async (code,status) => {
  vi.mocked(agendarSolicitacao).mockRejectedValueOnce({code});
  expect((await call('POST','2',agenda,'/1024/agendar')).status).toBe(status);
});

test.each(['2','3'])('PATCH permite ADM/Gestor %s com ator da sessão', async id => {
  const response = await call('PATCH',id,{origem:'  Nova sede  '},'/1024');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({data:{id:'1024',origem:'Nova sede',status:'PENDENTE'}});
  expect(editarSolicitacao).toHaveBeenCalledWith('1024',id,{origem:'Nova sede'});
});
test('PATCH nega sessão ausente e perfis não autorizados', async () => {
  expect((await call('PATCH',undefined,{origem:'Nova sede'},'/1024')).status).toBe(401);
  for (const id of ['1','4','5']) expect((await call('PATCH',id,{origem:'Nova sede'},'/1024')).status).toBe(403);
  expect(editarSolicitacao).not.toHaveBeenCalled();
});
test.each([{}, {origem:''}, {destino:' '.repeat(3)}, {finalidade:null}, {qtdPassageiros:0}, {qtdPassageiros:1.5},
  {dataHoraSaida:'2026-11-10T08:00:00'}, {motoristaId:'12'}, {veiculoId:'34'},
  {dataHoraRetornoPrevisto:'2026-11-10T17:00:00-03:00'}, {status:'APROVADA'}, {solicitanteId:'99'},
  {codigo:'TRP-99'}, {origem:'x'.repeat(256)}])('PATCH inválido %j recebe 400 antes de persistir', async payload => {
  expect((await call('PATCH','2',payload,'/1024')).status).toBe(400);
  expect(editarSolicitacao).not.toHaveBeenCalled();
});
test.each([{destino:'Outra unidade'},{finalidade:'Nova finalidade'},{qtdPassageiros:4},{dataHoraSaida:'2026-11-10T11:00:00Z'}])('PATCH aceita campo permitido %j', async payload => {
  expect((await call('PATCH','2',payload,'/1024')).status).toBe(200);
  expect(editarSolicitacao).toHaveBeenCalledWith('1024','2',payload);
});
test.each([404,409])('PATCH propaga erro de domínio %s', async status => {
  vi.mocked(editarSolicitacao).mockRejectedValueOnce(new ErroHttp(status,'EDICAO_RECUSADA','Edição recusada.'));
  expect((await call('PATCH','2',{origem:'Nova sede'},'/1024')).status).toBe(status);
});
test('rota de edição não oferece PUT ou cancelamento', async () => {
  const response = await call('PUT','2',undefined,'/1024');
  expect(response.status).toBe(405); expect(response.headers.get('Allow')).toBe('GET, PATCH');
  expect((await call('POST','2',{},'/1024/cancelar')).status).toBe(404);
});

const periodoAgenda='?'+new URLSearchParams({inicio:'2099-11-10T08:00:00-03:00',fim:'2099-11-11T08:00:00-03:00'});
const reagendamento={motoristaId:'12',veiculoId:'34',dataHoraSaida:'2099-11-10T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-11-10T17:00:00-03:00'};

test.each(['-27001','12','0','-9223372036854775808','9223372036854775807'])('recursos BIGINT válidos %s chegam aos repositórios sem conversão',async recursoId=>{
  for(const [acao,payload,repositorio] of [
    ['agendar',agenda,agendarSolicitacao],['reagendar',reagendamento,reagendarSolicitacao],
  ] as const){
    const body={...payload,motoristaId:recursoId,veiculoId:recursoId};
    expect((await call('POST','2',body,`/1024/${acao}`)).status).toBe(200);
    expect(repositorio).toHaveBeenCalledWith('1024','2',body);
  }
});

test.each(['-9223372036854775809','9223372036854775808','1.5','', ' ', ' 12','12 ', '+12','1e3','--1','abc',12,null])('recurso inválido %j é rejeitado antes da persistência',async recursoId=>{
  for(const [acao,payload] of [['agendar',agenda],['reagendar',reagendamento]] as const){
    for(const campo of ['motoristaId','veiculoId']){
      const response=await call('POST','2',{...payload,[campo]:recursoId},`/1024/${acao}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({error:{code:'DADOS_INVALIDOS'}});
    }
  }
  expect(agendarSolicitacao).not.toHaveBeenCalled();
  expect(reagendarSolicitacao).not.toHaveBeenCalled();
});
test.each(['/agenda','/disponibilidade','/1024/reagendar'])('SCRUM-156 restringe %s a gestores',async path=>{
  const method=path.endsWith('reagendar')?'POST':'GET';
  expect((await call(method,undefined,reagendamento,path+periodoAgenda)).status).toBe(401);
  for(const id of ['1','4','5']) expect((await call(method,id,reagendamento,path+periodoAgenda)).status).toBe(403);
  expect(consultarAgenda).not.toHaveBeenCalled();expect(consultarDisponibilidade).not.toHaveBeenCalled();expect(reagendarSolicitacao).not.toHaveBeenCalled();
});
test.each(['2','3'])('gestor/ADM %s consulta agenda, disponibilidade e reagenda',async id=>{
  const agenda=await call('GET',id,undefined,'/agenda'+periodoAgenda+'&page=2&limit=5');
  expect(agenda.status).toBe(200);expect(await agenda.json()).toEqual({data:[],meta:{page:2,limit:5,total:0}});
  expect(consultarAgenda).toHaveBeenCalledWith({inicio:'2099-11-10T08:00:00-03:00',fim:'2099-11-11T08:00:00-03:00',page:2,limit:5});
  const recursos=await call('GET',id,undefined,'/disponibilidade'+periodoAgenda);
  expect(recursos.status).toBe(200);expect(await recursos.json()).toMatchObject({data:{motoristas:[{id:'12'}],veiculos:[{id:'34'}]}});
  const response=await call('POST',id,reagendamento,'/1024/reagendar');
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({data:{status:'AGENDADA'}});
  expect(reagendarSolicitacao).toHaveBeenCalledWith('1024',id,reagendamento);
});
test.each(['','?inicio=inválido&fim=inválido','?inicio=2099-11-10T08:00:00Z&fim=2099-11-10T08:00:00Z',
  '?inicio=2099-01-01T00:00:00Z&fim=2099-03-01T00:00:00Z',
  periodoAgenda+'&inicio=2099-11-12T00:00:00Z',periodoAgenda+'&solicitanteId=1',periodoAgenda+'&page=0',periodoAgenda+'&limit=101'])('agenda rejeita query %s',async query=>{
  expect((await call('GET','2',undefined,'/agenda'+query)).status).toBe(400);expect(consultarAgenda).not.toHaveBeenCalled();
});
test('disponibilidade rejeita paginação não suportada e queries sem offset',async()=>{
  expect((await call('GET','2',undefined,'/disponibilidade'+periodoAgenda+'&page=1')).status).toBe(400);
  expect((await call('GET','2',undefined,'/disponibilidade?inicio=2099-11-10T08:00:00&fim=2099-11-11T08:00:00')).status).toBe(400);
});
test.each([{dataHoraSaida:'2000-01-01T08:00:00-03:00',dataHoraRetornoPrevisto:'2000-01-01T17:00:00-03:00'},
  {dataHoraRetornoPrevisto:'2099-11-10T08:00:00-03:00'},{dataHoraSaida:'2099-11-10T08:00:00'},
  {responsavelId:'1'},{status:'APROVADA'},{motoristaId:null}])('reagendamento inválido %j recebe 400',async patch=>{
  expect((await call('POST','2',{...reagendamento,...patch},'/1024/reagendar')).status).toBe(400);expect(reagendarSolicitacao).not.toHaveBeenCalled();
});
test.each([404,409])('reagendamento propaga erro %s',async status=>{
  vi.mocked(reagendarSolicitacao).mockRejectedValueOnce(new ErroHttp(status,'REAGENDAMENTO_RECUSADO','Reagendamento recusado.'));
  expect((await call('POST','2',reagendamento,'/1024/reagendar')).status).toBe(status);
});

test.each(['1','2','3'])('identidade %s consulta detalhes e histórico com escopo correto',async id=>{
  const response=await call('GET',id,undefined,'/1024');
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({data:{finalidade:null,motorista:{id:'12'},veiculo:{id:'34'}}});
  expect(consultarDetalhes).toHaveBeenCalledWith('1024',id==='1'?'1':null);
  const logs=await call('GET',id,undefined,'/1024/historico?page=2&limit=5');
  expect(logs.status).toBe(200);const json=await logs.json();
  expect(json.meta).toEqual({page:2,limit:5,total:1});
  if(id==='1')expect(json.data[0]).not.toHaveProperty('responsavel');
  else expect(json.data[0].responsavel).toEqual({id:'2',nome:'Gestor'});
  expect(consultarHistorico).toHaveBeenCalledWith('1024',id==='1'?'1':null,2,5);
});
test.each(['/1024','/1024/historico'])('detalhes/histórico %s protegem sessão e perfil',async path=>{
  expect((await call('GET',undefined,undefined,path)).status).toBe(401);
  for(const id of ['4','5'])expect((await call('GET',id,undefined,path)).status).toBe(403);
  expect(consultarDetalhes).not.toHaveBeenCalled();expect(consultarHistorico).not.toHaveBeenCalled();
});
test('pedido alheio ou ausente devolve o mesmo 404 em detalhes e histórico',async()=>{
  vi.mocked(consultarDetalhes).mockRejectedValue(new ErroHttp(404,'NAO_ENCONTRADO','Solicitação não encontrada.'));
  vi.mocked(consultarHistorico).mockRejectedValue(new ErroHttp(404,'NAO_ENCONTRADO','Solicitação não encontrada.'));
  const a=await call('GET','1',undefined,'/1024');const b=await call('GET','1',undefined,'/1024/historico');
  expect(a.status).toBe(404);expect(b.status).toBe(404);expect(await a.json()).toEqual(await b.json());
});
test.each(['?page=0','?limit=101','?page=1&page=2','?usuarioId=2','?status=APROVADA'])('histórico rejeita query %s',async query=>{
  expect((await call('GET','1',undefined,'/1024/historico'+query)).status).toBe(400);expect(consultarHistorico).not.toHaveBeenCalled();
});

test.each(['0000-01-01T08:00:00-03:00','2026-11-10T08:00:00+16:00','0001-01-01T00:00:00+15:59','9999-12-31T23:59:59-15:59'])('datas incompatíveis %s recebem 400 antes de acessar o repository',async dataHora=>{
  expect((await call('POST','1',{...body,dataHoraSaida:dataHora})).status).toBe(400);
  expect((await call('PATCH','2',{dataHoraSaida:dataHora},'/1024')).status).toBe(400);
  expect((await call('POST','2',{...agenda,dataHoraRetornoPrevisto:dataHora},'/1024/agendar')).status).toBe(400);
  expect((await call('POST','2',{...reagendamento,dataHoraSaida:dataHora},'/1024/reagendar')).status).toBe(400);
  const query='?'+new URLSearchParams({inicio:dataHora,fim:'2099-11-11T08:00:00-03:00'});
  expect((await call('GET','2',undefined,'/agenda'+query)).status).toBe(400);
  expect((await call('GET','2',undefined,'/disponibilidade'+query)).status).toBe(400);
  for(const repository of [inserirSolicitacao,editarSolicitacao,agendarSolicitacao,reagendarSolicitacao,consultarAgenda,consultarDisponibilidade])expect(repository).not.toHaveBeenCalled();
});
