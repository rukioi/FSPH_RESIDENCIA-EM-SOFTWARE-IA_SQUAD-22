import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';
import { criarJwt } from '../../src/security/jwt.js';
import { respostaRelatorioSchema } from '../../src/modules/relatorios/relatorios.schemas.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let token: string;
let criado = false;
const prefixo = '/api/relatorios';
beforeAll(async()=>{
  token = await criarJwt({id:'-27001',perfil:'ADM'});
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.motorista(id,nome,cnh,categoria_cnh,validade_cnh) VALUES (7199101,'Fixture relatório','REL-7199101','D','2099-12-31')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo) VALUES (7199201,'REL9A01','Fixture','Relatório',2026,'PASSEIO')`;
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,origem,destino,data_hora_saida,status,veiculo_id,motorista_id) VALUES
      (7199301,'REL-7199301','Fixture','Destino','2098-05-01 08:00','CONCLUIDA',7199201,7199101),
      (7199302,'REL-7199302','Fixture','Destino','2098-05-01 10:00','AGENDADA',7199201,7199101)`;
    await tx`INSERT INTO public.viagem(id,solicitacao_id,veiculo_id,motorista_id,status,km_inicial,km_final,data_inicio,data_fim) VALUES
      (7199401,7199301,7199201,7199101,'CONCLUIDA',100,140,'2098-05-02 00:00','2098-05-02 01:00')`;
  });
  criado = true;
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base = 'http://127.0.0.1:'+(server.address() as AddressInfo).port;
});
afterAll(async()=>{
  if(server.listening) await new Promise<void>(resolve=>server.close(()=>resolve()));
  try {
    if(criado) await sql.begin(async tx=>{
      await tx`DELETE FROM public.viagem WHERE id=7199401`;
      await tx`DELETE FROM public.solicitacao_viagem WHERE id IN (7199301,7199302)`;
      await tx`DELETE FROM public.veiculo WHERE id=7199201`;
      await tx`DELETE FROM public.motorista WHERE id=7199101`;
    });
  } finally {await sql.end();await fecharBanco();}
});
function call(query: string, auth = token, path = prefixo) {
  return fetch(base+path+query,{headers:auth?{Authorization:'Bearer '+auth}:{}});
}
test('401/403 antecedem consulta e SVO permanece separado por perfil efetivo',async()=>{
  const negado = await criarJwt({id:'-27003',perfil:'ADM'});
  expect((await call('','')).status).toBe(401);
  expect((await call('',negado)).status).toBe(403);
  expect((await call('',token,'/api/svo/relatorios')).status).toBe(403);
  expect((await call('',negado,prefixo+'/recursos')).status).toBe(403);
});
test('entrada inválida retorna 400, método inválido retorna 405',async()=>{
  expect((await call('?tipo=viagens&inicio=2098-02-30&fim=2098-03-01')).status).toBe(400);
  expect((await call('?tipo=viagens&inicio=2098-05-01&fim=2098-05-02&veiculoId=abc')).status).toBe(400);
  expect((await fetch(base+prefixo,{method:'POST'})).status).toBe(405);
});
test('SQL real usa início executado, inclui data final e mantém total coerente',async()=>{
  const filtros='&veiculoId=7199201&motoristaId=7199101';
  const response=await call('?tipo=viagens&inicio=2098-05-02&fim=2098-05-02'+filtros);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const {data}=respostaRelatorioSchema.parse(await response.json());
  expect(data.linhas).toHaveLength(1);
  expect(data.linhas[0]).toMatchObject({codigo:'REL-7199301',data:'2098-05-02T00:00:00',kmPercorridos:40});
  expect(data.resumo).toEqual({registros:1,kmConcluidos:40,semQuilometragem:0});
  const vazio=respostaRelatorioSchema.parse(await (await call('?tipo=viagens&inicio=2098-05-01&fim=2098-05-01'+filtros)).json());
  expect(vazio.data.linhas).toEqual([]);
  const demandas=respostaRelatorioSchema.parse(await (await call('?tipo=veiculos&inicio=2098-05-01&fim=2098-05-01'+filtros)).json());
  expect(demandas.data.linhas).toHaveLength(2);
  expect(demandas.data.resumo.kmConcluidos).toBe(40);
});
