import { expect, test, vi } from 'vitest';
import type postgres from 'postgres';
vi.mock('../../src/database/connection.js',()=>({sql:{}}));
import { validarContaMotorista } from '../../src/modules/solicitacoes/solicitacoes.repository.js';

test('conta ativa e bloqueada durante a transacao', async()=>{
  const tx=vi.fn().mockResolvedValueOnce([{usuario_id:'42'}]).mockResolvedValueOnce([{ativo:true}]);
  await expect(validarContaMotorista(tx as unknown as postgres.TransactionSql,'12')).resolves.toBeUndefined();
  expect(tx.mock.calls[0][0].join('?')).toContain('FOR UPDATE');
  expect(tx.mock.calls[1][0].join('?')).toContain('FOR SHARE');
  expect(tx.mock.calls[1][1]).toBe('42');
});
test.each([
  ['sem vinculo',[{usuario_id:null}],undefined],
  ['motorista ausente',[],undefined],
  ['usuario ausente',[{usuario_id:'42'}],[]],
  ['conta inativa',[{usuario_id:'42'}],[{ativo:false}]],
])('%s impede confirmacao',async(_descricao,motorista,usuario)=>{
  const tx=vi.fn().mockResolvedValueOnce(motorista);
  if(usuario)tx.mockResolvedValueOnce(usuario);
  await expect(validarContaMotorista(tx as unknown as postgres.TransactionSql,'12')).rejects.toMatchObject({status:409,code:'MOTORISTA_SEM_CONTA_ATIVA'});
});
