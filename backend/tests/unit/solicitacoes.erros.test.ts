import {expect,test} from 'vitest';
import {ErroHttp} from '../../src/shared/http/errors.js';
import {comValidacaoTemporal} from '../../src/modules/solicitacoes/solicitacoes.erros.js';

for(const code of ['22007','22008'])test('data rejeitada pelo PostgreSQL vira 400 sem detalhes: '+code,async()=>{
  const erro=Object.assign(new Error('detalhe SQL privado'),{code});
  await expect(comValidacaoTemporal(async()=>{throw erro;})).rejects.toMatchObject({status:400,code:'DADOS_INVALIDOS'});
});
for(const erro of [new Error('falha técnica'),Object.assign(new Error('falha de auditoria'),{code:'23514'}),new ErroHttp(409,'CONFLITO','Conflito')])test('outras falhas preservadas: '+erro.message,async()=>{
  await expect(comValidacaoTemporal(async()=>{throw erro;})).rejects.toBe(erro);
});
test('operação bem-sucedida preserva resultado',async()=>{const resultado={id:'1'};expect(await comValidacaoTemporal(async()=>resultado)).toBe(resultado);});
