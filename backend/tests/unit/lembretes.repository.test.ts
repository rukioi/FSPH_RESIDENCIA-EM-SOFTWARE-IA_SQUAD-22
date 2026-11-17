import {expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>{const tx=vi.fn().mockResolvedValue([]);return{tx,begin:vi.fn(async(fn:(query:typeof tx)=>Promise<unknown>)=>fn(tx))};});
vi.mock('../../src/database/connection.js',()=>({sql:{begin:mocks.begin}}));
import {gerarLembretes} from '../../src/modules/notificacoes/lembretes.repository.js';
test('limita espera por bloqueio e duracao de consulta no lote',async()=>{
  expect(await gerarLembretes(30)).toBe(0);
  const queries=mocks.tx.mock.calls.map(([parts])=>parts.join('?'));
  expect(queries[0]).toMatch(/SET LOCAL lock_timeout/i);
  expect(queries[1]).toMatch(/SET LOCAL statement_timeout/i);
});
