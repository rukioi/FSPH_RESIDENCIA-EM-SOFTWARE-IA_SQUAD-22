import { beforeEach, expect, test, vi } from 'vitest';
import type postgres from 'postgres';

const mocks = vi.hoisted(() => {
  const tx = vi.fn<(parts: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>>();
  const begin = vi.fn(async (...args: unknown[]) => (args.at(-1) as (tx: typeof mocks.tx) => Promise<unknown>)(tx));
  return {tx,begin};
});
vi.mock('../../src/database/connection.js', () => ({sql:{begin:mocks.begin}}));
import { agendarSolicitacao } from '../../src/modules/solicitacoes/solicitacoes.repository.js';
import { verificarDisponibilidade } from '../../src/modules/alocacao/alocacao.repository.js';
const tx = mocks.tx as unknown as postgres.TransactionSql;
// Fragmentos do postgres.js são construídos pelo mesmo tag, mas só a consulta externa é enviada.
const consultas = () => mocks.tx.mock.calls.filter(([parts]) =>
  /^\s*(SELECT|UPDATE|INSERT|WITH)\s/.test(parts[0]) && !parts[0].includes('SELECT 1 FROM public.manutencao_veiculo'));
const dados = {motoristaId:'12',veiculoId:'34',dataHoraRetornoPrevisto:'2026-11-10T20:00:00Z'};
const intervalo = {inicio:'2026-11-10T08:00:00.000000',fim:'2026-11-10T17:00:00.000000'};
const resultado = {id:'1024',status:'AGENDADA',motoristaId:'12',veiculoId:'34',dataHoraSaida:intervalo.inicio+'-03:00',dataHoraRetornoPrevisto:intervalo.fim+'-03:00'};
beforeEach(() => {
  mocks.tx.mockReset(); mocks.begin.mockClear();
  mocks.tx.mockImplementation(async parts => {
    const query = parts.join('?');
    if (query.includes('SELECT usuario_id::text FROM public.motorista')) return [{usuario_id:'99'}];
    if (query.includes('SELECT ativo,perfil FROM public.usuario')) return [{ativo:true,perfil:'MOTORISTA'}];
    if (query.includes('SELECT status,')) return [{status:'APROVADA',...intervalo,retorno_valido:true}];
    // SCRUM-240: nenhum impedimento conhecido no cenário padrão.
    if (query.includes('motorista_transicao_profissional')) return [];
    if (query.includes('FROM public.motorista') || query.includes('FROM public.veiculo')) return [{id:'12',status:'DISPONIVEL'}];
    if (query.includes('UPDATE public.solicitacao_viagem')) return [resultado];
    if (query.includes('INSERT INTO public.viagem')) return [{id:'1'}];
    return [];
  });
});

test('agendamento bloqueia pedido, motorista e veículo antes de conferir conflitos e auditar', async () => {
  expect(await agendarSolicitacao('1024','42',dados)).toEqual(resultado);
  expect(mocks.begin.mock.calls[0][0]).toBe('isolation level read committed');
  const queries = consultas().map(([parts]) => parts.join('?'));
  expect(queries[0]).toContain('FOR UPDATE');
  expect(queries[0]).toContain("AT TIME ZONE 'America/Maceio'");
  expect(consultas()[0].slice(1)).toEqual([dados.dataHoraRetornoPrevisto,dados.dataHoraRetornoPrevisto,'1024']);
  expect(queries[1]).toContain('public.motorista'); expect(queries[1]).toContain('FOR UPDATE');
  expect(queries[2]).toContain('public.veiculo'); expect(queries[2]).toContain('FOR UPDATE');
  expect(queries[3]).toContain('EM_TRANSPORTE');
  expect(queries[4]).toContain('AGENDADA');
  // SCRUM-240: impedimento é consulta própria, depois dos locks e dos conflitos.
  expect(queries[5]).toContain('motorista_transicao_profissional');
  expect(consultas()[5].slice(1)).toEqual([intervalo.inicio,intervalo.inicio,intervalo.fim,['12'],['12']]);
  expect(queries[8]).toContain("WHERE id=? AND status='APROVADA'");
  expect(consultas()[8].slice(1)).toEqual(['12','34',intervalo.fim,'1024']);
  expect(queries[9]).toContain('INSERT INTO public.viagem');
  expect(consultas()[10].slice(1)).toEqual(['42',['Agendou a solicitação de transporte ID 1024'],['solicitacao_viagem_agendada'],['1024']]);
});

test.each([['ausente',[],404],['pendente',[{status:'PENDENTE'}],409],['agendada',[{status:'AGENDADA'}],409],['retorno inválido',[{status:'APROVADA',retorno_valido:false}],400]])('não agenda pedido %s', async (_caso,rows,status) => {
  mocks.tx.mockResolvedValueOnce(rows as Record<string, unknown>[]);
  await expect(agendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status});
  expect(mocks.tx).toHaveBeenCalledTimes(1);
});

test('falha de auditoria impede confirmação do agendamento', async () => {
  const original = mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async (parts,...values) => {
    if (parts.join('').includes('public.log_atividade')) throw new Error('Falha da atividade');
    return original(parts,...values);
  });
  await expect(agendarSolicitacao('1024','42',dados)).rejects.toThrow('Falha da atividade');
});

test.each(['motorista','veiculo'])('recurso %s inexistente bloqueia operação', async recurso => {
  const original = mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async (parts,...values) => parts.join('').includes('FROM public.'+recurso) ? [] : original(parts,...values));
  await expect(agendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status:404});
  expect(mocks.tx.mock.calls.some(([parts]) => parts.join('').includes('UPDATE public.solicitacao_viagem'))).toBe(false);
});

test.each(['motorista','veiculo'])('recurso %s fora de DISPONIVEL bloqueia operação', async recurso => {
  const original = mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async (parts,...values) => parts.join('').includes('FROM public.'+recurso) ? [{status:'INDISPONIVEL'}] : original(parts,...values));
  await expect(agendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status:409});
});

test.each(['ordem_coleta','solicitacao_viagem'])('conflito em %s impede agendamento e auditoria', async tabela => {
  const original = mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async (parts,...values) => {
    const query = parts.join('');
    if (query.includes('SELECT id FROM public.'+tabela)) return [{id:'99'}];
    return original(parts,...values);
  });
  await expect(agendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status:409,code:'CONFLITO_ALOCACAO'});
  expect(mocks.tx.mock.calls.some(([parts]) => parts.join('').includes('UPDATE public.solicitacao_viagem'))).toBe(false);
});

test('intervalo usa desigualdades estritas, protege reservas sem fim e compara motorista OU veículo', async () => {
  expect(await verificarDisponibilidade(tx,'12','34',intervalo)).toBe('disponivel');
  const [parts,...values] = consultas()[3];
  const query = parts.join('?');
  expect(query).toContain('motorista_id=? OR veiculo_id=?');
  expect(query).toContain('data_hora_saida < ?::text::timestamp');
  expect(query).toContain('data_hora_retorno_previsto > ?::text::timestamp');
  expect(query).toContain('data_hora_retorno_previsto IS NULL');
  expect(query).toContain('PRONTA_PARA_INICIAR'); expect(query).toContain('EM_ANDAMENTO');
  expect(query).not.toContain('FOR UPDATE');
  expect(values).toEqual([null,null,'12','34',intervalo.inicio,intervalo.fim,intervalo.inicio,expect.anything()]);
});

test('SVO sem intervalo consulta toda reserva ativa, incluindo futura, sob os mesmos locks', async () => {
  expect(await verificarDisponibilidade(tx,'12','34',null)).toBe('disponivel');
  expect(consultas()[3].slice(1)).toEqual([null,null,'12','34',null,null,null,expect.anything()]);
  expect(consultas()[2][0].join('')).toContain("'EM_DESLOCAMENTO', 'EM_TRANSPORTE'");
});
