import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {createApp} from '../../src/app.js';
import {fecharBanco} from '../../src/database/connection.js';
import {dashboardSchemas} from '../../src/modules/dashboard/dashboard.schemas.js';
import {criarJwt} from '../../src/security/jwt.js';

const timezoneAnterior=process.env.TZ;
process.env.TZ='America/Fortaleza';
const sql=await verifiedSql();
const server=createApp();
let base:string;
let token:string;
const pedidos:string[]=[];const ordens:string[]=[];let recursosCriados=false;
beforeAll(async()=>{
  token=await criarJwt({id:'-27001',perfil:'ADM'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (7140001,'Fixture motorista','dashboard-7140001@example.invalid','fixture','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista(id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES (7140101,7140001,'Fixture Dashboard','DASH-7140101','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status,is_svo) VALUES
      (7140201,'S7D164A','Fixture','Dashboard',2026,'PASSEIO','DISPONIVEL',false),
      (7140202,'S7D164S','Fixture','Dashboard SVO',2026,'RABECÃO_SVO','DISPONIVEL',true)`;
  });recursosCriados=true;
});
afterAll(async()=>{
  if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
  try{await sql.begin(async tx=>{
    if(ordens.length)await tx`DELETE FROM public.ordem_coleta WHERE id=ANY(${ordens}::bigint[])`;
    if(pedidos.length){await tx`DELETE FROM public.notificacao WHERE viagem_id IN (SELECT id FROM public.viagem WHERE solicitacao_id=ANY(${pedidos}::bigint[]))`;
      await tx`DELETE FROM public.viagem WHERE solicitacao_id=ANY(${pedidos}::bigint[])`;
      await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id=ANY(${pedidos}::bigint[])`;
      await tx`DELETE FROM public.solicitacao_viagem WHERE id=ANY(${pedidos}::bigint[])`;}
    if(recursosCriados){await tx`DELETE FROM public.motorista WHERE id=7140101`;await tx`DELETE FROM public.usuario WHERE id=7140001`;await tx`DELETE FROM public.veiculo WHERE id IN (7140201,7140202)`;}
  });}finally{await sql.end();await fecharBanco();if(timezoneAnterior===undefined)delete process.env.TZ;else process.env.TZ=timezoneAnterior;}
});
function call(query='',path='gestor',auth=token){return fetch(base+'/api/dashboard/'+path+query,{headers:auth?{Authorization:'Bearer '+auth}:{}});}
const period='?periodo=personalizado&inicio=2098-01-01T00:00:00-03:00&fim=2098-01-02T00:00:00-03:00';

test('não anuncia todos os motoristas como disponíveis nem zero falso sem jornada',async()=>{
  const response=await call(period);expect(response.status).toBe(200);
  const {data}=await response.json();expect(data.motoristasDisponiveis).toBeNull();
  expect(data.motoristasDisponiveisMotivo).toMatch(/jornada|escala/i);
});

test('dashboard valida período antes da consulta e protege os dois endpoints',async()=>{
  const denied=await criarJwt({id:'-27003',perfil:'SOLICITANTE_INTERNO'});
  for(const path of ['gestor','graficos']){
    expect((await call('',path,'')).status).toBe(401);
    expect((await call('',path,denied)).status).toBe(403);
    for(const query of ['?periodo=errado','?extra=1','?periodo=personalizado&inicio=2098-01-01T00:00:00-03:00&fim=2098-02-01T00:00:00.000001-03:00','?periodo=personalizado','?inicio=2098-01-01T00:00:00Z','?periodo=hoje&periodo=7d','?periodo=personalizado&inicio=2098-01-02T00:00:00Z&fim=2098-01-01T00:00:00Z'])
      expect((await call(query,path)).status,query).toBe(400);
  }
});


async function criarPedido(saida:string){
  const solicitante=await criarJwt({id:'-27003',perfil:'SOLICITANTE_INTERNO'});
  const response=await fetch(base+'/api/solicitacoes-viagem',{method:'POST',headers:{Authorization:'Bearer '+solicitante,'Content-Type':'application/json'},
    body:JSON.stringify({origem:'Fixture Dashboard',destino:'Unidade',finalidade:'Validação real',dataHoraSaida:saida,qtdPassageiros:1})});
  expect(response.status).toBe(201);const {data}=await response.json();pedidos.push(data.id);return data.id as string;
}
function agir(id:string,acao:string,body?:unknown){return fetch(base+'/api/solicitacoes-viagem/'+id+'/'+acao,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}

test('coorte vazia retorna zeros reais e fila atual independente do período',async()=>{
  const {data}=dashboardSchemas.DashboardGestorIndicadores.parse(await (await call(period)).json());
  expect(data.solicitacoesPorStatus).toEqual([]);expect(data.proximasViagens).toEqual([]);
  expect(data.indicadores.aprovadas).toBe(0);expect(data.indicadores.reprovadas).toBe(0);
  expect(data.indicadores.atividadeRecente).toEqual([]);
  const [pending]=await sql`SELECT count(*)::int AS total FROM public.solicitacao_viagem WHERE status='PENDENTE'`;
  expect(data.indicadores.pendentes).toBe(pending.total);
  expect(data.indicadores.indicadoresIndisponiveis.map(r=>r.indicador)).toEqual(['IND-02','IND-08','IND-09']);
});

test('HTTP e SQL conferem dois pendentes, aprovação/recusa reais, limites de período e atividades',async()=>{
  await criarPedido('2098-01-01T03:00:00Z');
  await criarPedido('2098-01-01T08:00:00-03:00');
  const aprovado=await criarPedido('2098-01-01T09:00:00-03:00');
  const recusado=await criarPedido('2098-01-02T02:59:59.999999Z');
  expect((await agir(aprovado,'aprovar')).status).toBe(200);
  expect((await agir(recusado,'rejeitar',{motivo:'Justificativa real do teste'})).status).toBe(200);
  const fora=await criarPedido('2098-01-02T03:00:00Z');
  const {data}=dashboardSchemas.DashboardGestorIndicadores.parse(await (await call(period)).json());
  expect(Object.fromEntries(data.solicitacoesPorStatus.map(r=>[r.status,r.total]))).toEqual({PENDENTE:2,APROVADA:1,REPROVADA:1});
  expect(data.indicadores.aprovadas).toBe(1);expect(data.indicadores.reprovadas).toBe(1);
  expect(data.indicadores.decisoesRecentes.map(r=>r.solicitacaoId)).toEqual([recusado,aprovado]);
  expect(data.indicadores.atividadeRecente).toHaveLength(6);
  expect(data.indicadores.atividadeRecente.some(r=>r.solicitacaoId===fora)).toBe(false);
  const rows=await sql`SELECT l.id::text FROM public.log_atividade l JOIN public.solicitacao_viagem s ON s.id=l.solicitacao_viagem_id
    WHERE s.data_hora_saida>='2098-01-01' AND s.data_hora_saida<'2098-01-02' ORDER BY l.data_hora DESC NULLS LAST,l.id DESC LIMIT 10`;
  expect(data.indicadores.atividadeRecente.map(r=>r.id)).toEqual(rows.map(r=>r.id));
  expect(data.indicadores.atividadeRecente.every(r=>r.dataHora===null||!/[Z]|[+-][0-9]{2}:[0-9]{2}$/.test(r.dataHora))).toBe(true);
  const graph=dashboardSchemas.GraficosPeriodo.parse(await (await call(period,'graficos')).json());
  expect(graph.data.solicitacoesPorStatus).toEqual(data.solicitacoesPorStatus);
  expect(data.periodo).toMatchObject({criterio:'dataHoraSaida',fuso:'America/Maceio',inicio:'2098-01-01T00:00:00.000000-03:00',fim:'2098-01-02T00:00:00.000000-03:00'});
});

test('recursos ocupados institucional/SVO não contam; CNH válida não substitui jornada',async()=>{
  const antes=dashboardSchemas.DashboardGestorIndicadores.parse(await (await call(period)).json()).data;
  const aprovado={id:await criarPedido('2098-01-01T09:00:00-03:00')};
  expect((await agir(aprovado.id,'aprovar')).status).toBe(200);
  expect((await agir(aprovado.id,'agendar',{motoristaId:'7140101',veiculoId:'7140201',dataHoraRetornoPrevisto:'2098-01-01T17:00:00-03:00'})).status).toBe(200);
  const ocupado=dashboardSchemas.DashboardGestorIndicadores.parse(await (await call(period)).json()).data;
  expect(ocupado.indicadores.veiculosDisponiveis).toBe(antes.indicadores.veiculosDisponiveis-1);
  expect(ocupado.motoristasDisponiveis).toBeNull();expect(ocupado.proximasViagens.some(r=>r.id===aprovado.id)).toBe(true);
  const outro=period.replaceAll('2098-01-02','2098-01-03').replaceAll('2098-01-01','2098-01-02');
  const livre=dashboardSchemas.DashboardGestorIndicadores.parse(await (await call(outro)).json()).data;
  expect(livre.indicadores.veiculosDisponiveis).toBe(antes.indicadores.veiculosDisponiveis);
  const limite='?periodo=personalizado&inicio=2098-01-01T08:00:00-03:00&fim=2098-01-01T09:00:00-03:00';
  for(let n=0;n<2;n++){
    const adjacente=dashboardSchemas.DashboardGestorIndicadores.parse(await (await call(limite)).json()).data;
    expect(adjacente.indicadores.veiculosDisponiveis).toBe(antes.indicadores.veiculosDisponiveis);
  }
  const [ordem]=await sql`INSERT INTO public.ordem_coleta(motorista_id,veiculo_id,status,quantidade_corpos)
    VALUES (7140101,7140201,'EM_TRANSPORTE',1) RETURNING id::text`;ordens.push(ordem.id);
  const bloqueado=dashboardSchemas.DashboardGestorIndicadores.parse(await (await call(outro)).json()).data;
  expect(bloqueado.indicadores.veiculosDisponiveis).toBe(livre.indicadores.veiculosDisponiveis-1);
});

test.each([['hoje',1],['7d',7],['30d',30]] as const)('período %s usa dias institucionais completos',async(periodo,dias)=>{
  const {data}=dashboardSchemas.GraficosPeriodo.parse(await (await call('?periodo='+periodo,'graficos')).json());
  expect(data.periodo.inicio).toMatch(/T00:00:00.000000-03:00$/);
  expect(Date.parse(data.periodo.fim)-Date.parse(data.periodo.inicio)).toBe(dias*86400000);
});


test.each([
  ['2098-06-01T08:00:00.000001-03:00','2098-06-01T08:00:00.000002-03:00'],
  ['2098-06-01T11:00:00.123456Z','2098-06-01T13:00:00.123457+02:00'],
  ['2098-06-01T08:00:00.0000004-03:00','2098-06-01T08:00:00.0000006-03:00'],
])('dashboard aceita intervalo positivo na precisão PostgreSQL: %s até %s',async(inicio,fim)=>{
  const response=await call('?'+new URLSearchParams({periodo:'personalizado',inicio,fim}));
  expect(response.status).toBe(200);
  const {data}=dashboardSchemas.DashboardGestorIndicadores.parse(await response.json());
  const [expected]=await sql`SELECT
    to_char(${inicio}::text::timestamptz AT TIME ZONE 'America/Maceio','YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS inicio,
    to_char(${fim}::text::timestamptz AT TIME ZONE 'America/Maceio','YYYY-MM-DD"T"HH24:MI:SS.US')||'-03:00' AS fim`;
  expect(data.periodo).toMatchObject(expected);
});


test.each([
  ['2098-06-01T08:00:00.000002-03:00','2098-06-01T08:00:00.000001-03:00'],
  ['2098-06-01T08:00:00-03:00','2098-06-01T13:00:00+02:00'],
  ['2098-06-01T08:00:00.0000004-03:00','2098-06-01T08:00:00.00000049-03:00'],
  ['2098-01-01T00:00:00.000001-03:00','2098-02-01T00:00:00.000002-03:00'],
])('dashboard recusa intervalo inválido na precisão persistida: %s / %s',async(inicio,fim)=>{
  const response=await call('?'+new URLSearchParams({periodo:'personalizado',inicio,fim}));
  expect(response.status).toBe(400);expect((await response.json()).error.code).toBe('DADOS_INVALIDOS');
});
