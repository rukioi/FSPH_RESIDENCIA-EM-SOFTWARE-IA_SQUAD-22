import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = vi.fn<(parts: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>>();
  const begin = vi.fn(async (...args: unknown[]) => {
    const callback = args.at(-1) as (tx: typeof mocks.tx) => Promise<unknown>;
    return callback(tx);
  });
  return { tx, begin };
});
vi.mock('../../src/database/connection.js', () => ({ sql: { begin: mocks.begin } }));
import { inserirSolicitacao, consultarSolicitacoes, decidirSolicitacao, editarSolicitacao } from '../../src/modules/solicitacoes/solicitacoes.repository.js';

const input = { solicitanteId: '42', status: 'PENDENTE' as const, dados: {
  origem: 'Sede', destino: 'Unidade', finalidade: 'Serviço', dataHoraSaida: '2026-11-10T11:00:00Z', qtdPassageiros: 2,
} };
const row = { id: '1024', codigo: 'TRP-1024', solicitante_id: '42', origem: 'Sede', destino: 'Unidade',
  finalidade: 'Serviço', data_hora_saida: '2026-11-10T08:00:00.000000-03:00', qtd_passageiros: 2, status: 'PENDENTE' };
beforeEach(() => {
  mocks.tx.mockReset(); mocks.begin.mockClear();
  mocks.tx.mockImplementation(async (parts) => {
    const sql = parts.join('?');
    if (sql.includes('nextval')) return [{ id: '1024' }];
    if (sql.includes('INSERT INTO public.solicitacao_viagem')) return [row];
    if (sql.includes('SELECT nome')) return [{ nome: 'Solicitante' }];
    if (sql.includes('count(*)')) return [{ total: '1' }];
    if (sql.includes('FROM public.solicitacao_viagem')) return [row];
    return [];
  });
});

test('criação usa sequência, parâmetros, fuso explícito e auditoria na mesma transação', async () => {
  expect(await inserirSolicitacao(input)).toMatchObject({ ...row, solicitante_nome: 'Solicitante' });
  expect(mocks.begin).toHaveBeenCalledTimes(1);
  const insert = mocks.tx.mock.calls.find(([parts]) => parts.join('').includes('INSERT INTO public.solicitacao_viagem'))!;
  expect(insert[0].join('?')).toContain("::timestamptz AT TIME ZONE 'America/Maceio'");
  expect(insert[0].join('?')).toContain("to_char(data_hora_saida");
  expect(insert[0].join('?')).toContain("'-03:00'");
  expect(insert.slice(1)).toEqual(['1024', 'TRP-1024', '42', 'Sede', 'Unidade', 'Serviço', input.dados.dataHoraSaida, 2]);
  const audit = mocks.tx.mock.calls.find(([parts]) => parts.join('').includes('INSERT INTO public.log_atividade'))!;
  expect(audit.slice(1)).toEqual(['42', ['Criou a solicitação de transporte ID 1024'],['1024']]);
});

test('falha de auditoria rejeita o callback transacional, sem sucesso parcial', async () => {
  const original = mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async (parts, ...values) => {
    if (parts.join('').includes('INSERT INTO public.log_atividade')) throw new Error('Falha de auditoria');
    return original(parts, ...values);
  });
  await expect(inserirSolicitacao(input)).rejects.toThrow('Falha de auditoria');
});

test.each(['2026-11-10T08:00:00-03:00', '2026-11-10T11:00:00Z', '2026-11-10T13:00:00+02:00'])('offset %s chega como parâmetro ao operador de fuso do PostgreSQL', async dataHoraSaida => {
  await inserirSolicitacao({ ...input, dados: { ...input.dados, dataHoraSaida } });
  const insert = mocks.tx.mock.calls.find(([parts]) => parts.join('').includes('INSERT INTO public.solicitacao_viagem'))!;
  expect(insert.slice(1)).toContain(dataHoraSaida);
});

test.each(['42', '9007199254740993'])('lista e total limitam solicitante %s e estado no mesmo snapshot', async solicitanteId => {
  const result = await consultarSolicitacoes({ filtros: { page: 2, limit: 5, status: 'PENDENTE' }, escopo: { tipo: 'proprias', solicitanteId } });
  expect(result.total).toBe(1);
  expect(mocks.begin.mock.calls[0][0]).toBe('isolation level repeatable read read only');
  const queries = mocks.tx.mock.calls;
  expect(queries).toHaveLength(2);
  for (const [parts, ...values] of queries) {
    expect(parts.join('?')).toContain('s.solicitante_id=?::bigint');
    expect(parts.join('?')).toContain('s.status::text=?');
    expect(values.slice(0, 4)).toEqual([solicitanteId, solicitanteId, 'PENDENTE', 'PENDENTE']);
  }
  expect(queries[0].slice(-2)).toEqual([5, 5]);
});

test('gestão consulta sem restrição de identidade e preserva código bigint', async () => {
  await consultarSolicitacoes({ filtros: { page: 1, limit: 20 }, escopo: { tipo: 'gestao' } });
  expect(mocks.tx.mock.calls[0].slice(1, 5)).toEqual([null, null, null, null]);
  mocks.tx.mockResolvedValueOnce([{ id: '9007199254740993' }]);
  await inserirSolicitacao(input);
  const insert = mocks.tx.mock.calls.find(([parts]) => parts.join('').includes('INSERT INTO public.solicitacao_viagem'))!;
  expect(insert.slice(1, 3)).toEqual(['9007199254740993', 'TRP-9007199254740993']);
});

test('limite varchar(20) é tratado sem truncar nem criar DDL', async () => {
  mocks.tx.mockResolvedValueOnce([{ id: '9223372036854775807' }]);
  await expect(inserirSolicitacao(input)).rejects.toMatchObject({ status: 409, code: 'CODIGO_FORA_DO_LIMITE' });
  expect(mocks.tx).toHaveBeenCalledTimes(1);
});

test.each(['APROVADA','REPROVADA'] as const)('decisão %s bloqueia a linha antes de alterar e auditar', async status => {
  mocks.tx.mockResolvedValueOnce([{status:'PENDENTE'}])
    .mockResolvedValueOnce([{id:'1024',status,motivoRejeicao:status === 'REPROVADA' ? 'Motivo' : null}]);
  await decidirSolicitacao('1024','42',status === 'APROVADA' ? {status,motivo:null} : {status,motivo:'Motivo'});
  expect(mocks.begin).toHaveBeenCalledTimes(1);
  const [lock, update, audit] = mocks.tx.mock.calls;
  expect(lock[0].join('?')).toContain('WHERE id=? FOR UPDATE');
  expect(update[0].join('?')).toContain("WHERE id=? AND status='PENDENTE'");
  expect(update.slice(1)).toEqual([status,status === 'REPROVADA' ? 'Motivo' : null,'1024']);
  expect(audit.slice(1)).toEqual(['42',[`${status === 'APROVADA' ? 'Aprovou' : 'Reprovou'} a solicitação de transporte ID 1024`],['1024']]);
});

test('pedido inexistente retorna 404 sem UPDATE nem auditoria', async () => {
  mocks.tx.mockResolvedValueOnce([]);
  await expect(decidirSolicitacao('1024','42',{status:'APROVADA',motivo:null})).rejects.toMatchObject({status:404});
  expect(mocks.tx).toHaveBeenCalledTimes(1);
});

test.each(['APROVADA','REPROVADA','AGENDADA',null])('estado %s não permite segunda decisão nem auditoria duplicada', async status => {
  mocks.tx.mockResolvedValueOnce([{status}]);
  await expect(decidirSolicitacao('1024','42',{status:'REPROVADA',motivo:'Motivo'})).rejects.toMatchObject({status:409});
  expect(mocks.tx).toHaveBeenCalledTimes(1);
});

test('UPDATE sem linha não emite evento e responde conflito', async () => {
  mocks.tx.mockResolvedValueOnce([{status:'PENDENTE'}]).mockResolvedValueOnce([]);
  await expect(decidirSolicitacao('1024','42',{status:'APROVADA',motivo:null})).rejects.toMatchObject({status:409});
  expect(mocks.tx).toHaveBeenCalledTimes(2);
});

test('falha na auditoria da decisão rejeita a transação', async () => {
  mocks.tx.mockResolvedValueOnce([{status:'PENDENTE'}])
    .mockResolvedValueOnce([{id:'1024',status:'APROVADA',motivoRejeicao:null}])
    .mockRejectedValueOnce(new Error('Falha na atividade'));
  await expect(decidirSolicitacao('1024','42',{status:'APROVADA',motivo:null})).rejects.toThrow('Falha na atividade');
});

test.each(['PENDENTE','APROVADA'])('PATCH em %s termina PENDENTE e preserva campos omitidos', async status => {
  mocks.tx.mockResolvedValueOnce([{status}]).mockResolvedValueOnce([{...row,origem:'Nova sede'}]);
  expect(await editarSolicitacao('1024','42',{origem:'Nova sede'})).toMatchObject({status:'PENDENTE',origem:'Nova sede'});
  expect(mocks.begin.mock.calls[0][0]).toBe('isolation level read committed');
  const [lock,update,,audit] = mocks.tx.mock.calls;
  expect(lock[0].join('?')).toContain('WHERE id=? FOR UPDATE');
  const query = update[0].join('?');
  expect(query).toContain("status='PENDENTE'");
  expect(query).toContain("WHERE id=? AND status IN ('PENDENTE','APROVADA')");
  expect(query).toContain("AT TIME ZONE 'America/Maceio'");
  expect(query).not.toContain('motorista_id='); expect(query).not.toContain('veiculo_id=');
  expect(query).not.toContain('data_hora_retorno_previsto=');
  expect(update.slice(1)).toEqual(['Nova sede',null,null,null,null,'1024']);
  expect(audit.slice(1)).toEqual(['42',['Editou a solicitação de transporte ID 1024'],['1024']]);
});
test.each(['AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO','CONCLUIDA','REPROVADA',null])('PATCH bloqueia estado %s antes do UPDATE', async status => {
  mocks.tx.mockResolvedValueOnce([{status}]);
  await expect(editarSolicitacao('1024','42',{qtdPassageiros:3})).rejects.toMatchObject({status:409});
  expect(mocks.tx).toHaveBeenCalledTimes(1);
});
test('PATCH inexistente responde 404; UPDATE sem linha responde 409', async () => {
  mocks.tx.mockResolvedValueOnce([]);
  await expect(editarSolicitacao('1024','42',{qtdPassageiros:3})).rejects.toMatchObject({status:404});
  mocks.tx.mockResolvedValueOnce([{status:'PENDENTE'}]).mockResolvedValueOnce([]);
  await expect(editarSolicitacao('1024','42',{qtdPassageiros:3})).rejects.toMatchObject({status:409});
});
test('PATCH de horário passa offset parametrizado e falha de auditoria rejeita transação', async () => {
  mocks.tx.mockResolvedValueOnce([{status:'APROVADA'}]).mockResolvedValueOnce([row])
    .mockResolvedValueOnce([{nome:'Solicitante'}]).mockRejectedValueOnce(new Error('Falha na auditoria'));
  await expect(editarSolicitacao('1024','42',{dataHoraSaida:'2026-11-10T11:00:00Z'})).rejects.toThrow('Falha na auditoria');
  expect(mocks.tx.mock.calls[1].slice(1)).toEqual([null,null,null,'2026-11-10T11:00:00Z',null,'1024']);
});
