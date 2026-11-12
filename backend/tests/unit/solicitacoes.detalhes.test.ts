import {beforeEach,expect,test,vi} from 'vitest';
import type postgres from 'postgres';
const mocks=vi.hoisted(()=>{
  const db=vi.fn<(parts:TemplateStringsArray,...values:unknown[])=>Promise<Record<string,unknown>[]>>();
  const begin=vi.fn(async(...args:unknown[])=>(args.at(-1) as (tx:typeof db)=>Promise<unknown>)(db));
  return{db,begin};
});
vi.mock('../../src/database/connection.js',()=>({sql:Object.assign(mocks.db,{begin:mocks.begin})}));
import {consultarDetalhes,consultarHistorico} from '../../src/modules/solicitacoes/solicitacoes.detalhes.repository.js';
import {registrarAtividades,type EventoAtividade} from '../../src/modules/auditoria/auditoria.service.js';
// Consultas sem retorno programado (ex.: notificações após o log) devolvem lista vazia, como o driver.
beforeEach(()=>{mocks.db.mockReset();mocks.db.mockResolvedValue([]);mocks.begin.mockClear();});

test.each(['42',null])('detalhes aplicam escopo %s no SQL e projetam só dados mínimos',async escopo=>{
  mocks.db.mockResolvedValueOnce([{id:'1024',finalidade:null}]);
  expect(await consultarDetalhes('1024',escopo)).toMatchObject({id:'1024',finalidade:null});
  const [parts,...values]=mocks.db.mock.calls[0];const query=parts.join('?');
  expect(values).toEqual(['1024',escopo,escopo]);expect(query).toContain('s.solicitante_id=?::bigint');
  expect(query).not.toContain('email');expect(query).not.toContain('cpf');expect(query).not.toContain('telefone');
  expect(query).toContain('s.data_hora_retorno_previsto');expect(query).toContain('s.motivo_rejeicao');
});
test('detalhes inacessíveis ou ausentes recebem 404',async()=>{
  mocks.db.mockResolvedValueOnce([]);
  await expect(consultarDetalhes('1024','42')).rejects.toMatchObject({status:404,code:'NAO_ENCONTRADO'});
});
test('histórico inacessível não consulta logs ou total',async()=>{
  mocks.db.mockResolvedValueOnce([]);
  await expect(consultarHistorico('1024','42',1,20)).rejects.toMatchObject({status:404});expect(mocks.db).toHaveBeenCalledTimes(1);
});
test.each(['42',null])('histórico filtra vínculo estruturado e escopo %s em página e total',async escopo=>{
  mocks.db.mockResolvedValueOnce([{id:'1024'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{total:'0'}]);
  expect(await consultarHistorico('1024',escopo,2,5)).toEqual({data:[],total:0});
  expect(mocks.begin.mock.calls[0][0]).toBe('isolation level repeatable read read only');
  for(const [parts,...values]of mocks.db.mock.calls.slice(1)){
    const query=parts.join('?');expect(query).toContain('l.solicitacao_viagem_id=?');
    expect(query).toContain('s.solicitante_id=?::bigint');expect(query).not.toContain('LIKE');expect(query).not.toContain('regexp');
    const offset=query.includes('ORDER BY')?1:0;
    expect(values.slice(offset,offset+3)).toEqual(['1024',escopo,escopo]);
  }
  const page=mocks.db.mock.calls[1];expect(page[0].join('?')).toContain('ORDER BY l.data_hora ASC NULLS LAST,l.id ASC');
  expect(page.slice(-2)).toEqual([5,5]);expect(page[1]).toBe(escopo===null);
});
test.each(['solicitacao_viagem_criada','solicitacao_viagem_aprovada','solicitacao_viagem_reprovada','solicitacao_viagem_editada','solicitacao_viagem_agendada','solicitacao_viagem_reagendada'] as const)('evento %s persiste vínculo sem interpretar a descrição',async operacao=>{
  mocks.db.mockResolvedValueOnce([]);
  await registrarAtividades(mocks.db as unknown as postgres.TransactionSql,'42',[{operacao,recursoId:'1024'}]);
  const [parts,...values]=mocks.db.mock.calls[0];expect(parts.join('?')).toContain('(usuario_id, descricao, solicitacao_viagem_id, data_hora)');
  expect(parts.join('?')).toContain('clock_timestamp()::timestamp');
  expect(values[0]).toBe('42');expect(values[2]).toEqual(['1024']);
});
test('eventos SVO e usuários continuam sem vínculo institucional',async()=>{
  mocks.db.mockResolvedValueOnce([]);
  await registrarAtividades(mocks.db as unknown as postgres.TransactionSql,'42',[
    {operacao:'solicitacao_confirmada',recursoId:'1024'},{operacao:'usuario_editado',recursoId:'1024'},
  ]);
  expect(mocks.db.mock.calls[0][0].join('')).not.toContain('solicitacao_viagem_id');
});
test('lote misto preserva alinhamento entre descrições e vínculos, sem backfill',async()=>{
  mocks.db.mockResolvedValueOnce([]);
  const eventos:EventoAtividade[]=[{operacao:'usuario_editado',recursoId:'1024'},{operacao:'solicitacao_viagem_criada',recursoId:'1024'}];
  await registrarAtividades(mocks.db as unknown as postgres.TransactionSql,'42',eventos);
  expect(mocks.db.mock.calls[0][3]).toEqual([null,'1024']);
  expect(mocks.db.mock.calls[0][0].join('')).not.toContain('UPDATE');
});
