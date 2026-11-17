import {expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>{const tx=vi.fn();return {tx,begin:vi.fn(async (_isolation:string,fn:(query:typeof tx)=>Promise<unknown>)=>fn(tx))};});
vi.mock('../../src/database/connection.js',()=>({sql:{begin:mocks.begin}}));
import {executarViagem} from '../../src/modules/viagens/viagens.repository.js';
test('motorista que perdeu atribuicao recebe 404 apos bloqueio',async()=>{
  mocks.tx.mockResolvedValueOnce([{solicitacao_id:'12'}]).mockResolvedValueOnce([{status:'AGENDADA',motorista_id:'22',veiculo_id:'33'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([{quilometragem_atual:0}]).mockResolvedValueOnce([{status:'AGENDADA',motorista_id:'22',veiculo_id:'33'}]);
  await expect(executarViagem('1','42','iniciar',0,{nome:'foto.png',tipo:'image/png',dadosBase64:'fixture'})).rejects.toMatchObject({status:404,code:'NAO_ENCONTRADO'});
});
