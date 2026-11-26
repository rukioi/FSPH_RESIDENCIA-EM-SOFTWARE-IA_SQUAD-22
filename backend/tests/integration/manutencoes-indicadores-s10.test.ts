import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createApp } from '../../src/app.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { indicadoresManutencao } from '../../src/modules/manutencoes/manutencoes.schemas.js';

const app = createApp();
const a = '-23430001';
const b = '-23430002';
const vazio = '-23430003';
const grande = '9007199254741234';
const veiculos = [a,b,vazio,grande];
let db: Awaited<ReturnType<typeof verifiedSql>>;
let base: string, admin: string, gestor: string, svo: string;
let hoje: string, ontem: string, dia6: string, dia7: string;
let criado = false;

beforeAll(async () => {
  db = await verifiedSql(true);
  [admin,gestor,svo] = await Promise.all(['-27001','-27002','-27005'].map(id => criarJwt({id,perfil:'ADM'})));
  await db.begin(async tx => {
    const [dias] = await tx`SELECT hoje::text, (hoje-1)::text AS ontem,
      (hoje+6)::text AS dia6, (hoje+7)::text AS dia7
      FROM (SELECT (statement_timestamp() AT TIME ZONE 'America/Maceio')::date AS hoje) r`;
    ({hoje,ontem,dia6,dia7} = dias as {hoje:string;ontem:string;dia6:string;dia7:string});
    for (const [i,id] of veiculos.entries()) await tx`
      INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status)
      VALUES (${id},${'T34A00'+i},'Fixture','Indicador SCRUM-234',2026,'PASSEIO',
        ${i<2 ? 'EM_MANUTENCAO' : 'DISPONIVEL'}::public.status_veiculo)`;
    for (const [id,status,tipo,entrada,previsao,custo] of [
      [-23430101,'AGENDADA','PREVENTIVA','2026-11-01','2026-11-02','500.00'],
      [-23430102,'EM_ANDAMENTO','CORRETIVA','2026-11-01','2026-11-02',null],
      [-23430103,'CONCLUIDA','CORRETIVA','2026-11-01','2026-11-02','0.00'],
      [-23430104,'CANCELADA','CORRETIVA','2026-11-01','2026-11-02','88000'],
      [-23430105,'EM_ANDAMENTO','PREVENTIVA',ontem,hoje,'9007199254740993.1234567'],
    ] as const) {
      await tx`INSERT INTO public.manutencao_veiculo
        (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,custo,
          iniciada_em,concluida_em,cancelada_em,criado_por_id,atualizado_por_id)
        VALUES (${id},${a},${tipo}::public.tipo_manutencao_veiculo,'Fixture indicador S234',
          ${entrada}::date::timestamp AT TIME ZONE 'America/Maceio',
          ${previsao}::date::timestamp AT TIME ZONE 'America/Maceio',0,${status}::public.status_manutencao_veiculo,${custo}::numeric,
          CASE WHEN ${status}::text IN ('CONCLUIDA','EM_ANDAMENTO') THEN (${entrada}::date + time '08:00') AT TIME ZONE 'America/Maceio' END,
          CASE WHEN ${status}::text = 'CONCLUIDA' THEN '2026-12-01T03:00:00Z'::timestamptz END,
          CASE WHEN ${status}::text = 'CANCELADA' THEN '2026-11-01T12:00:00Z'::timestamptz END,-27001,-27001)`;
    }
    await tx`INSERT INTO public.manutencao_veiculo
      (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
      SELECT -23430200+i,${grande},'PREVENTIVA','Fixture de alertas S234',
        d::timestamp AT TIME ZONE 'America/Maceio',d::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',-27001,-27001
      FROM (SELECT i, CASE WHEN i <= 1 THEN ${ontem}::date WHEN i <= 23 THEN ${hoje}::date
        WHEN i=24 THEN ${dia6}::date ELSE ${dia7}::date END AS d FROM generate_series(1,25) i) datas`;
  });
  criado = true;
  await new Promise<void>(resolve => app.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+(app.address() as AddressInfo).port;
});

afterAll(async () => {
  if(app.listening) await new Promise<void>(resolve => app.close(()=>resolve()));
  if(!db) return;
  try {
    if(criado) await db.begin(async tx => {
      await tx`DELETE FROM public.manutencao_veiculo_historico WHERE manutencao_id IN
        (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id=ANY(${veiculos}::bigint[]))`;
      await tx`DELETE FROM public.manutencao_alerta_revisao WHERE manutencao_id IN
        (SELECT id FROM public.manutencao_veiculo WHERE veiculo_id=ANY(${veiculos}::bigint[]))`;
      await tx`DELETE FROM public.manutencao_veiculo WHERE veiculo_id=ANY(${veiculos}::bigint[])`;
      await tx`DELETE FROM public.veiculo WHERE id=ANY(${veiculos}::bigint[])`;
    });
  } finally {await db.end();}
});

function get(query='', token=admin, method='GET') {
  return fetch(base+'/api/manutencoes/indicadores'+query,{method,headers:token?{Authorization:'Bearer '+token}:{}});
}
async function dados(query='', token=admin) {
  const res=await get(query,token);
  const body=await res.json();
  expect(res.status,JSON.stringify(body)).toBe(200);
  expect(res.headers.get('x-request-id')).toBeTruthy();
  return indicadoresManutencao.parse(body).data;
}

test('rota literal protege perfis e valida query estrita antes da consulta',async()=>{
  expect((await get('','')).status).toBe(401);
  expect((await get('',svo)).status).toBe(403);
  expect((await get('',admin,'POST')).status).toBe(405);
  for(const q of ['inicio=2026-02-29','inicio=0000-01-01','fim=','inicio=2026-11-02&fim=2026-11-01',
    'veiculoId=9223372036854775808','veiculoId=','tipo=','tipo=OUTRA','inicio=2026-11-01&inicio=2026-11-01',
    'status=AGENDADA','q=a','page=1','limit=20']) expect((await get('?'+q)).status,q).toBe(400);
  expect((await get('?veiculoId=-23439999')).status).toBe(404);
  expect((await dados('?veiculoId='+vazio,gestor)).estoqueAtual).toEqual({veiculosEmManutencao:0,agendadas:0,emAndamento:0,atrasadas:0});
});

test('estoque deduplica status manual e ocorrências; filtros e ciclos preservam os recortes',async()=>{
  const atual=await dados('?veiculoId='+a+'&inicio=2026-12-01&fim=2026-12-01');
  expect(atual.estoqueAtual).toMatchObject({veiculosEmManutencao:1,agendadas:1,emAndamento:2});
  expect(atual.periodo).toMatchObject({concluidas:1,fimExclusivo:'2026-12-02T03:00:00Z'});
  expect((await dados('?veiculoId='+b)).estoqueAtual.veiculosEmManutencao).toBe(1);
  expect((await dados('?veiculoId='+b+'&tipo=CORRETIVA')).estoqueAtual.veiculosEmManutencao).toBe(0);
  expect((await dados('?veiculoId='+a+'&tipo=PREVENTIVA')).estoqueAtual.emAndamento).toBe(1);
  const registro=await fetch(base+'/api/manutencoes/-23430103',{headers:{Authorization:'Bearer '+admin}});
  const resposta=await fetch(base+'/api/manutencoes/-23430103/status',{method:'PATCH',
    headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json','If-Match':registro.headers.get('etag')!},
    body:JSON.stringify({acao:'REABRIR',destino:'AGENDADA',alteracoes:{entrada:dia7,conclusaoPrevista:dia7}})});
  expect(resposta.status).toBe(200);
  try {
    const posterior=await dados('?veiculoId='+a+'&inicio=2026-12-01&fim=2026-12-01');
    expect(posterior.periodo.concluidas).toBe(0);
    expect(posterior.estoqueAtual.agendadas).toBe(2);
    const [hist]=await db`SELECT count(*)::int AS total FROM public.manutencao_veiculo_historico WHERE manutencao_id=-23430103`;
    expect(hist.total).toBe(1);
  } finally {
    await db`DELETE FROM public.log_atividade WHERE tipo_evento='manutencao_reabrir' AND strpos(descricao,'Manutenção ID -23430103 — ')=1`;
    await db`UPDATE public.manutencao_veiculo SET status='CONCLUIDA',entrada_em='2026-11-01T03:00:00Z',
      conclusao_prevista_em='2026-11-02T03:00:00Z',iniciada_em='2026-11-01T11:00:00Z',
      concluida_em='2026-12-01T03:00:00Z' WHERE id=-23430103`;
  }
});

test('custo preserva escala e separa zero de desconhecido; fim civil inclui um dia completo',async()=>{
  const novembro=await dados('?veiculoId='+a+'&inicio=2026-11-01&fim=2026-11-01');
  expect(novembro.periodo).toMatchObject({concluidas:0,criterioCusto:'ENTRADA_PLANEJADA',
    custo:{totalConhecido:'500.00',comCustoInformado:2,comCustoDesconhecido:1}});
  expect((await dados('?veiculoId='+a+'&fim=2026-11-01')).periodo.custo).toEqual(novembro.periodo.custo);
  expect((await dados('?veiculoId='+a+'&inicio=2026-12-01')).periodo).toMatchObject({fimExclusivo:null,concluidas:1});
  expect((await dados('?veiculoId='+a+'&tipo=PREVENTIVA&inicio='+ontem+'&fim='+ontem)).periodo.custo.totalConhecido)
    .toBe('9007199254740993.1234567');
  expect((await dados('?veiculoId='+grande+'&inicio='+hoje+'&fim='+hoje)).periodo.custo)
    .toMatchObject({totalConhecido:null,comCustoInformado:0,comCustoDesconhecido:22});
  expect((await dados('?veiculoId='+vazio+'&fim=9999-12-31')).periodo.fimExclusivo).toMatch(/^\+010000-01-01T/);
});

test('janela dos alertas independe do período; total excede 20 e ordenação é estável; GET não grava',async()=>{
  const [antes]=await db`SELECT count(*)::text AS avisos FROM public.notificacao`;
  const atual=await dados('?veiculoId='+grande+'&inicio=2020-01-01&fim=2020-01-01');
  const {preventivasProximos7Dias:p,atrasos}=atual.alertas;
  expect(p).toMatchObject({inicio:hoje,fimExclusivo:dia7,total:23,limite:20});
  expect(p.itens.map(item=>item.id)).toEqual(Array.from({length:20},(_,i)=>String(-23430198+i)));
  expect(p.itens.every(item=>item.entrada===hoje && item.veiculo.id===grande)).toBe(true);
  expect(atrasos).toMatchObject({total:1,itens:[{id:'-23430199',entrada:ontem}]});
  expect(atual.estoqueAtual.atrasadas).toBe(atrasos.total);
  expect((await dados('?veiculoId='+grande+'&tipo=CORRETIVA')).alertas.preventivasProximos7Dias.total).toBe(0);
  const [depois]=await db`SELECT count(*)::text AS avisos FROM public.notificacao`;
  expect(depois).toEqual(antes);
});


test('agregado mantém leitura consistente enquanto outra conexão grava uma fixture',async()=>{
  const query='?veiculoId='+vazio+'&inicio='+hoje+'&fim='+hoje;
  await db.begin(async tx=>{
    await tx`UPDATE public.veiculo SET status='EM_MANUTENCAO' WHERE id=${vazio}`;
    await tx`INSERT INTO public.manutencao_veiculo
      (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,custo,criado_por_id,atualizado_por_id)
      VALUES (-23430301,${vazio},'PREVENTIVA','Snapshot S234',${hoje}::date::timestamp AT TIME ZONE 'America/Maceio',
        ${hoje}::date::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',0.00,-27001,-27001)`;
    const anterior=await dados(query);
    expect(anterior.estoqueAtual).toMatchObject({veiculosEmManutencao:0,agendadas:0});
    expect(anterior.periodo.custo).toEqual({totalConhecido:null,comCustoInformado:0,comCustoDesconhecido:0});
    expect(anterior.alertas.preventivasProximos7Dias.total).toBe(0);
  });
  const posterior=await dados(query);
  expect(posterior.estoqueAtual).toMatchObject({veiculosEmManutencao:1,agendadas:1});
  expect(posterior.periodo.custo).toEqual({totalConhecido:'0.00',comCustoInformado:1,comCustoDesconhecido:0});
  expect(posterior.alertas.preventivasProximos7Dias.total).toBe(1);
});

test('falha real da soma NUMERIC retorna 500 genérico e preserva o identificador da requisição',async()=>{
  await db`INSERT INTO public.manutencao_veiculo
    (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,custo,criado_por_id,atualizado_por_id)
    SELECT -23430400+i,${b},'CORRETIVA','Limite NUMERIC S234',
      ${hoje}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${hoje}::date::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',repeat('9',131072)::numeric,-27001,-27001
    FROM generate_series(1,2) i`;
  try {
    const res=await get('?veiculoId='+b);
    expect(res.status).toBe(500);
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(await res.json()).toEqual({error:{code:'ERRO_INTERNO',message:'Não foi possível concluir a requisição.'}});
  } finally {
    await db`DELETE FROM public.manutencao_veiculo WHERE id IN (-23430399,-23430398) AND veiculo_id=${b}`;
  }
});
