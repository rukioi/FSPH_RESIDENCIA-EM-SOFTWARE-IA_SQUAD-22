import {afterAll,beforeAll,expect,test,vi} from 'vitest';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
vi.mock('../../src/modules/dashboard/dashboard.repository.js',()=>({consultarIndicadores:vi.fn(async()=>{throw new Error('SENTINELA_PRIVADA_DASHBOARD');})}));
import {dashboardGestorController,dashboardGraficosController} from '../../src/modules/dashboard/dashboard.controller.js';
const server=createServer((req,res)=>void(req.url==='/gestor'?dashboardGestorController(res):dashboardGraficosController(res)));
let base:string;
beforeAll(async()=>{await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+(server.address() as AddressInfo).port;});
afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));});

test.each(['gestor','graficos'])('falha de %s não vira contagem zero nem expõe detalhe técnico',async(path)=>{
  const logger=vi.spyOn(console,'error').mockImplementation(()=>{});
  try{
    const response=await fetch(base+'/'+path);expect(response.status).toBe(500);
    const body=await response.json();expect(body).not.toHaveProperty('data');
    expect(JSON.stringify(body)).not.toContain('SENTINELA_PRIVADA_DASHBOARD');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('SENTINELA_PRIVADA_DASHBOARD');
  }finally{logger.mockRestore();}
});
