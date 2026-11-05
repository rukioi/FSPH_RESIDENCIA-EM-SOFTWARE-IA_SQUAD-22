import {beforeEach,expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>{
  const tx=vi.fn<(parts:TemplateStringsArray,...values:unknown[])=>Promise<Record<string,unknown>[]>>();
  const begin=vi.fn(async(...args:unknown[])=>(args.at(-1) as (tx:typeof mocks.tx)=>Promise<unknown>)(tx));
  return{tx,begin};
});
vi.mock('../../src/database/connection.js',()=>({sql:{begin:mocks.begin}}));
import {consultarAgenda,consultarDisponibilidade,reagendarSolicitacao} from '../../src/modules/solicitacoes/solicitacoes.agenda.repository.js';
const intervalo={inicio:'2099-11-10T08:00:00.000000',fim:'2099-11-10T17:00:00.000000'};
const query={inicio:'2099-11-10T11:00:00Z',fim:'2099-11-10T20:00:00Z'};
const dados={motoristaId:'2',veiculoId:'4',dataHoraSaida:query.inicio,dataHoraRetornoPrevisto:query.fim};
const resultado={id:'1024',status:'AGENDADA',motoristaId:'2',veiculoId:'4',dataHoraSaida:intervalo.inicio+'-03:00',dataHoraRetornoPrevisto:intervalo.fim+'-03:00'};
beforeEach(()=>{
  mocks.tx.mockReset();mocks.begin.mockClear();
  mocks.tx.mockImplementation(async parts=>{
    const sql=parts.join('?');
    if(sql.includes('AS inicio'))return[intervalo];
    if(sql.includes('SELECT status,motorista_id'))return[{status:'AGENDADA',motorista_id:'9',veiculo_id:'12'}];
    if(sql.includes('SELECT id, status'))return[{id:'2',status:'DISPONIVEL'}];
    if(sql.includes('UPDATE public.solicitacao_viagem'))return[resultado];
    if(sql.includes('count(*)'))return[{total:'0'}];
    if(sql.includes('WITH recursos'))return[{tipo:'motorista',id:'2',nome:'Motorista',placa:null,modelo:null},{tipo:'veiculo',id:'4',nome:null,placa:'TEST123',modelo:'Modelo'}];
    return[];
  });
});
test('agenda normaliza período e usa o mesmo filtro temporal em lista e total',async()=>{
  expect(await consultarAgenda({...query,page:2,limit:5})).toEqual({data:[],total:0});
  expect(mocks.begin.mock.calls[0][0]).toBe('isolation level repeatable read read only');
  expect(mocks.tx.mock.calls[0][0].join('?')).toContain("AT TIME ZONE 'America/Maceio'");
  expect(mocks.tx.mock.calls[0].slice(1)).toEqual([query.inicio,query.fim]);
  for(const [parts,...values] of mocks.tx.mock.calls.slice(1)){
    expect(parts.join('?')).toContain("s.status='AGENDADA'");
    expect(parts.join('?')).toContain('s.data_hora_saida<?::text::timestamp');
    expect(parts.join('?')).toContain('s.data_hora_retorno_previsto>?::text::timestamp');
    expect(values.slice(0,2)).toEqual([intervalo.fim,intervalo.inicio]);
  }
  expect(mocks.tx.mock.calls[1].slice(-2)).toEqual([5,5]);
  const lista=mocks.tx.mock.calls[1][0].join('?');
  expect(lista).toContain('json_build_object');expect(lista).not.toContain('email');expect(lista).not.toContain('cpf');expect(lista).not.toContain('telefone');
});
test('disponibilidade verifica cada recurso contra os dois fluxos sem locks ou horários SVO inventados',async()=>{
  expect(await consultarDisponibilidade(query)).toEqual({motoristas:[{id:'2',nome:'Motorista'}],veiculos:[{id:'4',placa:'TEST123',modelo:'Modelo'}]});
  const [parts,...values]=mocks.tx.mock.calls[1];const sql=parts.join('?');
  expect(sql).toContain("r.status='DISPONIVEL'");expect(sql).toContain("'EM_DESLOCAMENTO','EM_TRANSPORTE'");
  expect(sql).toContain("'AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO'");
  expect(sql).toContain('s.data_hora_retorno_previsto IS NULL');expect(sql).not.toContain('FOR UPDATE');
  expect(sql).not.toContain('o.data_fim');expect(values).toEqual([intervalo.fim,intervalo.inicio]);
});
test('reagendamento bloqueia recursos antigos/novos em ordem numérica e ignora só a própria reserva',async()=>{
  expect(await reagendarSolicitacao('1024','42',dados)).toEqual(resultado);
  expect(mocks.begin.mock.calls[0][0]).toBe('isolation level read committed');
  expect(mocks.tx.mock.calls[0][0].join('?')).toContain('FOR UPDATE');
  const locks=mocks.tx.mock.calls.slice(2,6);
  expect(locks.map(call=>call.slice(1))).toEqual([['2'],['9'],['4'],['12']]);
  expect(locks.slice(0,2).every(([parts])=>parts.join('').includes('public.motorista'))).toBe(true);
  expect(locks.slice(2).every(([parts])=>parts.join('').includes('public.veiculo'))).toBe(true);
  const conflitos=mocks.tx.mock.calls.find(([parts])=>parts.join('').includes('SELECT id FROM public.solicitacao_viagem'))!;
  expect(conflitos[0].join('?')).toContain('id<>?::bigint');expect(conflitos.slice(1,3)).toEqual(['1024','1024']);
  const update=mocks.tx.mock.calls.find(([parts])=>parts.join('').includes('UPDATE public.solicitacao_viagem'))!;
  expect(update[0].join('?')).toContain("WHERE id=? AND status='AGENDADA'");
  expect(update[0].join('?')).toContain("clock_timestamp() AT TIME ZONE 'America/Maceio'");
  expect(update.slice(1)).toEqual([intervalo.inicio,intervalo.fim,'2','4','1024',intervalo.inicio]);
  expect(mocks.tx.mock.calls.at(-1)!.slice(1)).toEqual(['42',['Reagendou a solicitação de transporte ID 1024'],['1024']]);
});
test('recursos iguais são bloqueados uma vez por tipo antes da revalidação',async()=>{
  mocks.tx.mockResolvedValueOnce([{status:'AGENDADA',motorista_id:'2',veiculo_id:'4'}]);
  await reagendarSolicitacao('1024','42',dados);
  expect(mocks.tx.mock.calls.slice(2,4).map(call=>call.slice(1))).toEqual([['2'],['4']]);
});
test.each(['PENDENTE','APROVADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO','CONCLUIDA','REPROVADA'])('estado %s bloqueia reagendamento',async status=>{
  mocks.tx.mockResolvedValueOnce([{status}]);
  await expect(reagendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status:409});expect(mocks.tx).toHaveBeenCalledTimes(1);
});
test('pedido inexistente retorna 404',async()=>{
  mocks.tx.mockResolvedValueOnce([]);await expect(reagendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status:404});
});
test.each(['ordem_coleta','solicitacao_viagem'])('conflito em %s não altera a reserva anterior',async tabela=>{
  const original=mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async(parts,...values)=>parts.join('').includes('SELECT id FROM public.'+tabela)?[{id:'999'}]:original(parts,...values));
  await expect(reagendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status:409});
  expect(mocks.tx.mock.calls.some(([parts])=>parts.join('').includes('UPDATE public.solicitacao_viagem'))).toBe(false);
});
test('auditoria com falha rejeita a transação inteira',async()=>{
  const original=mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async(parts,...values)=>{
    if(parts.join('').includes('INSERT INTO public.log_atividade'))throw new Error('Falha da atividade');
    return original(parts,...values);
  });
  await expect(reagendarSolicitacao('1024','42',dados)).rejects.toThrow('Falha da atividade');
});
test('saída que deixou de ser futura durante espera não confirma nem audita',async()=>{
  const original=mocks.tx.getMockImplementation()!;
  mocks.tx.mockImplementation(async(parts,...values)=>parts.join('').includes('UPDATE public.solicitacao_viagem')?[]:original(parts,...values));
  await expect(reagendarSolicitacao('1024','42',dados)).rejects.toMatchObject({status:400,code:'SAIDA_INVALIDA'});
  expect(mocks.tx.mock.calls.some(([parts])=>parts.join('').includes('public.log_atividade'))).toBe(false);
});
