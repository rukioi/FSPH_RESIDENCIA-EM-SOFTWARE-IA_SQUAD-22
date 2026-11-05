import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';
import {sql as applicationSql,fecharBanco} from '../../src/database/connection.js';
import {createApp} from '../../src/app.js';
import {criarJwt} from '../../src/security/jwt.js';

const sql=await verifiedSql();
const server=createApp();
const previousTZ=process.env.TZ;
const pedidos:string[]=[];
let base:string,solicitante:string,gestor:string,fixtures=false;
const motoristaId='7150101',veiculoId='7150201';
const day=(n:number)=>String(n).padStart(2,'0');

beforeAll(async()=>{
  await sql.begin(async tx=>{
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES
      (7150001,'Fixture Temporal Solicitante','s7-temporal-a@example.invalid','sem-login','SOLICITANTE_INTERNO',true),
      (7150002,'Fixture Temporal Gestor','s7-temporal-g@example.invalid','sem-login','GESTOR_FROTA',true)`;
    await tx`INSERT INTO public.motorista(id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES
      (7150101,'Fixture Temporal','TEMP-7150101','D','2099-12-31','DISPONIVEL'),
      (7150102,'Fixture Temporal Legado','TEMP-7150102','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status) VALUES
      (7150201,'S7T001A','Fixture','Temporal',2026,'PASSEIO','DISPONIVEL'),
      (7150202,'S7T002A','Fixture','Temporal Legado',2026,'PASSEIO','DISPONIVEL')`;
  });fixtures=true;
  solicitante=await criarJwt({id:'7150001',perfil:'SOLICITANTE_INTERNO'});
  gestor=await criarJwt({id:'7150002',perfil:'GESTOR_FROTA'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+(server.address() as AddressInfo).port;
});

afterAll(async()=>{
  try{
    if(server.listening)await new Promise<void>(resolve=>server.close(()=>resolve()));
    if(fixtures)await sql.begin(async tx=>{
      await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id=ANY(${pedidos}::bigint[])`;
      await tx`DELETE FROM public.solicitacao_viagem WHERE id=ANY(${pedidos}::bigint[])`;
      await tx`DELETE FROM public.motorista WHERE id IN(7150101,7150102)`;
      await tx`DELETE FROM public.veiculo WHERE id IN(7150201,7150202)`;
      await tx`DELETE FROM public.usuario WHERE id IN(7150001,7150002)`;
    });
  }finally{
    if(previousTZ===undefined)delete process.env.TZ;else process.env.TZ=previousTZ;
    await sql.end();await fecharBanco();
  }
});

function call(path:string,method='GET',body?:unknown,token=gestor){
  return fetch(base+'/api/solicitacoes-viagem'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
}
async function criar(saida:string){
  const response=await call('','POST',{origem:'Fixture Temporal',destino:'Unidade',finalidade:'Validação temporal real',dataHoraSaida:saida,qtdPassageiros:1},solicitante);
  expect(response.status).toBe(201);const {data}=await response.json();pedidos.push(data.id);return data;
}
async function armazenado(id:string){
  const [row]=await sql`SELECT to_char(data_hora_saida,'YYYY-MM-DD"T"HH24:MI:SS.US') AS saida,
    to_char(data_hora_retorno_previsto,'YYYY-MM-DD"T"HH24:MI:SS.US') AS retorno FROM public.solicitacao_viagem WHERE id=${id}`;
  return row;
}
const query=(inicio:string,fim:string)=>'?'+new URLSearchParams({inicio,fim,limit:'100'});
const disponibilidade=(inicio:string,fim:string)=>'/disponibilidade?'+new URLSearchParams({inicio,fim});

for(const tz of ['UTC','America/Fortaleza']){
  test('cadastro e edição preservam microssegundos em consultas repetidas com TZ='+tz,async()=>{
    process.env.TZ=tz;
    for(let n=1;n<=7;n++){
      const date='2099-07-'+day(n);
      const pedido=await criar(date+'T13:00:00.123456+02:00');
      expect(pedido.dataHoraSaida).toBe(date+'T08:00:00.123456-03:00');
      expect((await armazenado(pedido.id)).saida).toBe(date+'T08:00:00.123456');
      const edit=await call('/'+pedido.id,'PATCH',{dataHoraSaida:date+'T14:15:00.654321+03:00'});
      expect(edit.status).toBe(200);expect((await edit.json()).data.dataHoraSaida).toBe(date+'T08:15:00.654321-03:00');
      expect((await armazenado(pedido.id)).saida).toBe(date+'T08:15:00.654321');
    }
  },20000);

  test('reserva gravada coincide com validação, agenda, disponibilidade e conflitos com TZ='+tz,async()=>{
    process.env.TZ=tz;
    for(let n=1;n<=7;n++){
      // Datas diferentes por fuso evitam que o próprio teste gere reservas sobrepostas.
      const date='2099-'+(tz==='UTC'?'08':'09')+'-'+day(n);
      const next='2099-'+(tz==='UTC'?'08':'09')+'-'+day(n+10);
      const pedido=await criar(date+'T13:00:00.123456+02:00');
      expect((await call('/'+pedido.id+'/aprovar','POST')).status).toBe(200);
      const scheduled=await call('/'+pedido.id+'/agendar','POST',{motoristaId,veiculoId,dataHoraRetornoPrevisto:date+'T22:00:00.987654+02:00'});
      expect(scheduled.status).toBe(200);
      expect((await scheduled.json()).data).toMatchObject({dataHoraSaida:date+'T08:00:00.123456-03:00',dataHoraRetornoPrevisto:date+'T17:00:00.987654-03:00'});
      expect(await armazenado(pedido.id)).toEqual({saida:date+'T08:00:00.123456',retorno:date+'T17:00:00.987654'});
      const rebook=await call('/'+pedido.id+'/reagendar','POST',{motoristaId,veiculoId,dataHoraSaida:next+'T07:00:00.111111-04:00',dataHoraRetornoPrevisto:next+'T20:00:00.222222Z'});
      expect(rebook.status).toBe(200);
      expect((await rebook.json()).data).toMatchObject({dataHoraSaida:next+'T08:00:00.111111-03:00',dataHoraRetornoPrevisto:next+'T17:00:00.222222-03:00'});
      expect(await armazenado(pedido.id)).toEqual({saida:next+'T08:00:00.111111',retorno:next+'T17:00:00.222222'});
      for(let repeat=0;repeat<2;repeat++){
        const agenda=await call('/agenda'+query(next+'T08:00:00.111111-03:00',next+'T08:00:00.111112-03:00'));
        expect(agenda.status).toBe(200);const body=await agenda.json();
        expect(body.data.some((r:{id:string})=>r.id===pedido.id)).toBe(true);expect(body.meta.total).toBeGreaterThan(0);
        const free=await call(disponibilidade(next+'T08:00:00.111111-03:00',next+'T08:00:00.111112-03:00'));
        expect(free.status).toBe(200);const resources=(await free.json()).data;
        expect(resources.motoristas.some((r:{id:string})=>r.id===motoristaId)).toBe(false);
        expect(resources.veiculos.some((r:{id:string})=>r.id===veiculoId)).toBe(false);
        const adjacent=await call('/agenda'+query(next+'T17:00:00.222222-03:00',next+'T17:00:00.222223-03:00'));
        expect(adjacent.status).toBe(200);expect((await adjacent.json()).data.some((r:{id:string})=>r.id===pedido.id)).toBe(false);
        const after=await call(disponibilidade(next+'T17:00:00.222222-03:00',next+'T17:00:00.222223-03:00'));
        expect(after.status).toBe(200);expect((await after.json()).data.veiculos.some((r:{id:string})=>r.id===veiculoId)).toBe(true);
      }
      const conflict=await criar(next+'T08:30:00.333333-03:00');
      expect((await call('/'+conflict.id+'/aprovar','POST')).status).toBe(200);
      expect((await call('/'+conflict.id+'/agendar','POST',{motoristaId,veiculoId,dataHoraRetornoPrevisto:next+'T09:00:00.444444-03:00'})).status).toBe(409);
    }
  },30000);
}

test('consultas preservam horários e finalidade null dos registros existentes',async()=>{
  process.env.TZ='America/Fortaleza';
  const [legacy]=await sql`INSERT INTO public.solicitacao_viagem(codigo,solicitante_id,origem,destino,data_hora_saida,data_hora_retorno_previsto,status,motorista_id,veiculo_id)
    VALUES ('S7-TEMP-LEGADO',7150001,'Fixture Temporal Antiga','Unidade','2099-10-27 08:15:30.123456','2099-10-27 17:00:00.654321','AGENDADA',7150102,7150202) RETURNING id::text`;
  pedidos.push(legacy.id);
  const before=await armazenado(legacy.id);
  for(let n=0;n<7;n++){
    const response=await call('/'+legacy.id);expect(response.status).toBe(200);
    expect((await response.json()).data).toMatchObject({finalidade:null,dataHoraSaida:'2099-10-27T08:15:30.123456-03:00',dataHoraRetornoPrevisto:'2099-10-27T17:00:00.654321-03:00'});
    const agenda=await call('/agenda'+query('2099-10-27T08:15:30.123455-03:00','2099-10-27T08:15:30.123457-03:00'));
    expect(agenda.status).toBe(200);expect((await agenda.json()).data.some((r:{id:string})=>r.id===legacy.id)).toBe(true);
  }
  expect(await armazenado(legacy.id)).toEqual(before);
});

test('agendamento e reagendamento aceitam reserva positiva de um microssegundo',async()=>{
  process.env.TZ='America/Fortaleza';
  const pedido=await criar('2099-11-27T08:00:00.000001-03:00');
  expect((await call('/'+pedido.id+'/aprovar','POST')).status).toBe(200);
  expect((await call('/'+pedido.id+'/agendar','POST',{motoristaId,veiculoId,dataHoraRetornoPrevisto:'2099-11-27T08:00:00.000002-03:00'})).status).toBe(200);
  expect((await call('/'+pedido.id+'/reagendar','POST',{motoristaId,veiculoId,dataHoraSaida:'2099-11-27T08:00:00.000004-03:00',dataHoraRetornoPrevisto:'2099-11-27T08:00:00.000005-03:00'})).status).toBe(200);
  expect(await armazenado(pedido.id)).toEqual({saida:'2099-11-27T08:00:00.000004',retorno:'2099-11-27T08:00:00.000005'});
});

test('PostgreSQL confirma reutilização das consultas preparadas nos caminhos reais',async()=>{
  const connections=[];
  try{
    for(let n=0;n<applicationSql.options.max;n++)connections.push(await applicationSql.reserve());
    const batches=await Promise.all(connections.map(c=>c`SELECT statement,parameter_types::text AS types,(generic_plans+custom_plans)::int AS executions FROM pg_prepared_statements`));
    const rows=batches.flat();
    for(const pattern of ['INSERT INTO public.solicitacao_viagem','UPDATE public.solicitacao_viagem SET','SET motorista_id=','SET data_hora_saida=','WHERE s.status=']){
      const matching=rows.filter(r=>r.statement.includes(pattern)&&r.executions>=2);
      expect(matching.length,pattern).toBeGreaterThan(0);
      for(const row of matching)expect(row.types,pattern).not.toMatch(/timestamp/);
    }
  }finally{for(const c of connections)await c.release();}
});
