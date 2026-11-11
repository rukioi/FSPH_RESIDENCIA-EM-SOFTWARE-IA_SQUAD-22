import { afterEach, expect, test, vi } from 'vitest';
import { buscarNotificacoes, lerNotificacoes, sincronizarNotificacoes } from './notificacoes.service';
import { consultaNotificacoes } from '../../../../backend/src/modules/notificacoes/notificacoes.schemas';
vi.mock('./auth.service',()=>({fetchAutenticada:(...args:Parameters<typeof fetch>)=>fetch(...args)}));
afterEach(()=>vi.unstubAllGlobals());
const aviso = {id:'9007199254740993',titulo:'Solicitação aprovada',descricao:'Solicitação #TRP-10',categoria:'sucesso',criadoEm:'2026-11-09T12:00:00Z',lidaEm:null};
test('caixa preserva BIGINT, filtro, contadores e sinal de cancelamento',async()=>{
  const body = {data:[aviso],meta:{page:2,limit:20,total:21,naoLidas:4}};
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
  vi.stubGlobal('fetch',mock);
  const controller=new AbortController();
  expect(await buscarNotificacoes('nao-lidas',2,controller.signal)).toEqual(body);
  expect(mock.mock.calls[0][0]).toBe('/api/notificacoes?filtro=nao-lidas&page=2&limit=20');
  expect(mock.mock.calls[0][1].signal).toBe(controller.signal);
});
test.each([{data:[{...aviso,categoria:'desconhecida'}]},{data:[aviso],meta:{total:-1}},{data:[{...aviso,criadoEm:'ontem'}]}])('rejeita resposta inválida antes de aplicá-la',async body=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
  await expect(buscarNotificacoes('todas',1)).rejects.toMatchObject({code:'RESPOSTA_INVALIDA'});
});
test('leitura e sincronização usam POST e os bindings do contrato',async()=>{
  const mock = vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({data:{atualizadas:1}}))));
  vi.stubGlobal('fetch',mock);
  await lerNotificacoes('101');await lerNotificacoes();await sincronizarNotificacoes();
  expect(mock.mock.calls.map(args=>[args[0],args[1].method])).toEqual([
    ['/api/notificacoes/101/ler','POST'],['/api/notificacoes/ler-todas','POST'],['/api/notificacoes/sincronizar','POST'],
  ]);
});
test('filtros rejeitam coerções, duplicatas e valores fora do limite',()=>{
  for (const page of ['0','1.0','1e2',' 1','0x10','1000001']) expect(consultaNotificacoes.safeParse({page}).success).toBe(false);
  expect(consultaNotificacoes.safeParse({usuarioId:'outro'}).success).toBe(false);
  expect(consultaNotificacoes.parse({})).toEqual({page:1,limit:20,filtro:'todas'});
});
