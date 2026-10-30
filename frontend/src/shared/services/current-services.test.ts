import { afterEach, expect, test, vi } from 'vitest';
import { buscarMotoristas, cadastrarMotorista } from './motoristas.service';
import { listarUsuarios, cadastrarUsuario, editarUsuario, alterarStatusUsuario } from './usuarios.service';
import { listarOrdensAguardandoSvo, listarMotoristasDisponiveis, criarSolicitacaoSvo, despacharOrdemSvo } from './svo.service';
vi.mock('./auth.service',()=>({fetchAutenticada:(...args:Parameters<typeof fetch>)=>fetch(...args)}));
afterEach(()=>vi.unstubAllGlobals());
const motorista={id:'9007199254740993',usuario_id:null,nome:'Fixture',cnh:'30000000000',categoria_cnh:'B',
  validade_cnh:'2099-01-01T00:00:00.000Z',status:'DISPONIVEL',criado_em:null,cpf:null,telefone:null};
const usuario={id:'30001',nome:'Fixture',email:'fixture@example.invalid',perfil:'SOLICITANTE_INTERNO',ativo:true,criado_em:null};
function response(body:unknown,status=200) {
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify(body),{status,headers:{'X-Request-Id':'t30'}}));
  vi.stubGlobal('fetch',mock); return mock;
}
test('motoristas preserva BIGINT, null e signal; cadastro confirma apenas o DTO retornado',async()=>{
  const signal=new AbortController().signal;
  const mock=response({data:[motorista]});
  expect(await buscarMotoristas(signal)).toEqual([motorista]);
  expect(mock.mock.calls[0][1].signal).toBe(signal);
  response({data:motorista},201);
  expect(await cadastrarMotorista({nome:'Fixture',cnh:'30000000000',categoria_cnh:'B',validade_cnh:'2099-01-01'})).toEqual(motorista);
});
test.each([{}, {data:[{id:'1'}]}, {data:[{...motorista,status:'NOVO'}]}])('motoristas rejeita resposta inválida %j',async body=>{
  response(body); await expect(buscarMotoristas()).rejects.toMatchObject({code:'RESPOSTA_INVALIDA',requestId:'t30'});
});
test('listas vazias são sucesso; filtro de disponibilidade existente é preservado',async()=>{
  response({data:[]}); expect(await buscarMotoristas()).toEqual([]);
  response([]); expect(await listarUsuarios()).toEqual([]);
  response([]); expect(await listarOrdensAguardandoSvo()).toEqual([]);
  response({data:[motorista,{...motorista,id:'2',status:'FOLGA'}]});
  expect(await listarMotoristasDisponiveis()).toEqual([motorista]);
});
test('usuários usa o mesmo perfil persistido em cadastro/edição e estado desejado explícito',async()=>{
  response([usuario]); expect((await listarUsuarios())[0]).toMatchObject({perfil:'Solicitante',id:30001});
  const input={nome:'Fixture',email:'fixture@example.invalid',perfil:'Solicitante' as const,senha:'Fixture-2026!'};
  for (const save of [()=>cadastrarUsuario(input),()=>editarUsuario(30001,input)]) {
    const mock=response(usuario,201); await save();
    expect(JSON.parse(mock.mock.calls[0][1].body).perfil).toBe('SOLICITANTE_INTERNO');
  }
  const mock=response({...usuario,ativo:false});
  expect((await alterarStatusUsuario(30001,false)).ativo).toBe(false);
  expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual({ativo:false});
});
test('usuários e SVO rejeitam resposta parcial sem completar com campos do formulário',async()=>{
  response([{...usuario,perfil:'NOVO'}]); await expect(listarUsuarios()).rejects.toMatchObject({code:'RESPOSTA_INVALIDA'});
  response({ordemColeta:{id:1}},201);
  await expect(criarSolicitacaoSvo({localFalecimento:'Fixture',enderecoRemocao:'Fixture',solicitanteNome:'Fixture'})).rejects.toMatchObject({code:'RESPOSTA_INVALIDA'});
});
test.each([401,403,409])('compartilha erros HTTP %i, código e correlação',async status=>{
  response({error:{code:'FIXTURE',message:'Confira a solicitação.'}},status);
  await expect(buscarMotoristas()).rejects.toMatchObject({status,code:'FIXTURE',requestId:'t30'});
  response({erro:'Conflito de despacho.'},status);
  await expect(despacharOrdemSvo('30001',30001,30001)).rejects.toMatchObject({status,message:'Conflito de despacho.'});
});
test('ordens preserva identificadores e cancela resposta antiga',async()=>{
  const controller=new AbortController();
  const mock=vi.fn().mockImplementation(async()=>{controller.abort(); return new Response('[]');});
  vi.stubGlobal('fetch',mock);
  await expect(listarOrdensAguardandoSvo(controller.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(mock.mock.calls[0][0]).toBe('/api/svo/ordens-coleta?status=AGUARDANDO_DESPACHO');
});
