import { afterEach, expect, test, vi } from 'vitest';
import { buscarVeiculos, cadastrarVeiculo } from './veiculos.service';
vi.mock('./auth.service',()=>({fetchAutenticada:(...args:Parameters<typeof fetch>)=>fetch(...args)}));
afterEach(()=>vi.unstubAllGlobals());
const row = {id:'9007199254740993',placa:'T32DTO',modelo:'Fixture',marca:'Fixture',ano:2026,tipo:'PASSEIO',capacidade_obitos:0,
  quilometragem_atual:0,status:null,is_svo:null,criado_em:null,capacidade_passageiros:null,vinculo:'PROPRIO',fornecedor_locacao:null};
test('valida lista completa sem converter BIGINT/nullable e transmite signal',async()=>{
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[row]})));
  vi.stubGlobal('fetch',mock);
  const controller=new AbortController();
  expect(await buscarVeiculos(controller.signal)).toEqual([row]);
  expect(mock.mock.calls[0][1].signal).toBe(controller.signal);
});
test.each([{data:[{id:1}]},{data:{}},{data:[{...row,status:'NOVO_ESTADO'}]}])('rejeita resposta fora do contrato %j',async body=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(body),{headers:{'X-Request-Id':'t32-correlation'}})));
  await expect(buscarVeiculos()).rejects.toMatchObject({code:'RESPOSTA_INVALIDA',requestId:'t32-correlation'});
});
test('cadastro serializa o binding e só retorna DTO validado após confirmação',async()=>{
  const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:row}),{status:201}));
  vi.stubGlobal('fetch',mock);
  const input={placa:'T32DTO',marca:'Fixture',modelo:'Fixture',ano:2026};
  expect(await cadastrarVeiculo(input)).toEqual(row);
  expect(mock.mock.calls[0][1].method).toBe('POST');
  expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual(input);
});
