import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
vi.mock('../../src/modules/usuarios/usuarios.repository.js', () => ({ consultarIdentidade: vi.fn() }));
import { consultarIdentidade } from '../../src/modules/usuarios/usuarios.repository.js';
import { criarJwt } from '../../src/security/jwt.js';
import { buscarSessao } from '../../src/security/session.js';
import { createApp } from '../../src/app.js';
const repository=vi.mocked(consultarIdentidade);
const server=createApp();
let base:string;
beforeAll(async()=>{
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});
beforeEach(()=>repository.mockReset());
test('JWT ausente ou subject inválido não consulta identidade',async()=>{
  expect(await buscarSessao(undefined)).toBeNull();
  const token=await criarJwt({id:'identidade-inválida',perfil:'ADM'});
  expect(await buscarSessao(`Bearer ${token}`)).toBeNull();
  expect(repository).not.toHaveBeenCalled();
});
test('perfil desconhecido ou ativo null/false não produz sessão nem fallback ao JWT',async()=>{
  const token=await criarJwt({id:'42',perfil:'ADM'});
  for(const dados of [{perfil:'SUPERADMIN',ativo:true},{perfil:'ADM',ativo:null},{perfil:'ADM',ativo:false}]) {
    repository.mockResolvedValueOnce({id:42,nome:'Fixture',email:'fixture@example.invalid',...dados});
    expect(await buscarSessao(`Bearer ${token}`)).toBeNull();
  }
  expect(repository).toHaveBeenCalledTimes(3);
});
test('falha de consulta retorna 500 seguro e não autoriza com claims antigos',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
    repository.mockRejectedValueOnce(new Error('SENTINELA_PRIVADA_SESSAO'));
    const token=await criarJwt({id:'42',perfil:'ADM'});
    const response=await fetch(base+'/api/admin/usuarios',{headers:{Authorization:`Bearer ${token}`}});
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('SENTINELA_PRIVADA_SESSAO');
    expect(JSON.stringify(log.mock.calls)).not.toContain('SENTINELA_PRIVADA_SESSAO');
    expect(repository).toHaveBeenCalledTimes(1);
  } finally {log.mockRestore();}
});
