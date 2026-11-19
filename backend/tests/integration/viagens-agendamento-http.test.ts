import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { criarJwt } from '../../src/security/jwt.js';
import { createApp } from '../../src/app.js';
import { fecharBanco } from '../../src/database/connection.js';

const sql = await verifiedSql();
const server = createApp();
let base = '', token = '', created = false;
const primeiro = '8830201', segundo = '8830202', duplicado = '8830203', legado = '8830204', iniciada = '8830205';
const agendar = { motoristaId: '8830101', veiculoId: '8830111', dataHoraRetornoPrevisto: '2099-12-01T12:00:00-03:00' };
const novo = { motoristaId: '8830102', veiculoId: '8830112', dataHoraSaida: '2099-12-02T08:00:00-03:00', dataHoraRetornoPrevisto: '2099-12-02T12:00:00-03:00' };
function post(id: string, acao: string, dados: unknown) {
  return fetch(`${base}/api/solicitacoes-viagem/${id}/${acao}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
}
beforeAll(async () => {
  await sql.begin(async tx => {
    await tx`INSERT INTO public.usuario(id,nome,email,senha_hash,perfil,ativo) VALUES (8830001,'Fixture motorista','viagens-e2-8830001@example.invalid','fixture','MOTORISTA',true),(8830002,'Fixture motorista','viagens-e2-8830002@example.invalid','fixture','MOTORISTA',true)`;
    await tx`INSERT INTO public.motorista (id,usuario_id,nome,cnh,categoria_cnh,validade_cnh,status) VALUES
      (8830101,8830001,'S8 etapa 2 A','S8-E2-CNH-A','D','2099-12-31','DISPONIVEL'),(8830102,8830002,'S8 etapa 2 B','S8-E2-CNH-B','D','2099-12-31','DISPONIVEL')`;
    await tx`INSERT INTO public.veiculo (id,placa,marca,modelo,ano,tipo,status,capacidade_passageiros) VALUES
      (8830111,'S8E2001','Teste','A',2026,'PASSEIO','DISPONIVEL',5),(8830112,'S8E2002','Teste','B',2026,'PASSEIO','DISPONIVEL',5)`;
    await tx`INSERT INTO public.solicitacao_viagem (id,codigo,solicitante_id,origem,destino,finalidade,data_hora_saida,status,motorista_id,veiculo_id,data_hora_retorno_previsto) VALUES
      (8830201,'S8-E2-201',-27003,'A','B','Teste','2099-12-01 08:00','APROVADA',NULL,NULL,NULL),
      (8830202,'S8-E2-202',-27003,'A','B','Teste','2099-12-01 08:00','APROVADA',NULL,NULL,NULL),
      (8830203,'S8-E2-203',-27003,'A','B','Teste','2099-12-01 08:00','APROVADA',NULL,NULL,NULL),
      (8830204,'S8-E2-204',-27003,'A','B','Teste','2099-12-03 08:00','AGENDADA',8830101,8830111,'2099-12-03 12:00'),
      (8830205,'S8-E2-205',-27003,'A','B','Teste','2099-12-05 08:00','AGENDADA',8830101,8830111,'2099-12-05 12:00')`;
    await tx`INSERT INTO public.viagem (id,solicitacao_id,motorista_id,veiculo_id,status) VALUES (8830303,8830203,8830101,8830111,'AGENDADA')`;
    await tx`INSERT INTO public.viagem (id,solicitacao_id,motorista_id,veiculo_id,status,data_inicio,km_inicial) VALUES (8830305,8830205,8830101,8830111,'EM_TRANSPORTE','2099-12-05 08:00',100)`;
  });
  created = true;
  token = await criarJwt({ id: '-27002', perfil: 'GESTOR_FROTA' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
  try {
    if (created) await sql.begin(async tx => {
      await tx`DELETE FROM public.notificacao WHERE descricao IN ('Solicitação #S8-E2-201','Solicitação #S8-E2-202','Solicitação #S8-E2-203','Solicitação #S8-E2-204')`;
      await tx`DELETE FROM public.log_atividade WHERE solicitacao_viagem_id IN (8830201,8830202,8830203,8830204,8830205)`;
      await tx`DELETE FROM public.viagem WHERE solicitacao_id IN (8830201,8830202,8830203,8830204,8830205)`;
      await tx`DELETE FROM public.solicitacao_viagem WHERE id IN (8830201,8830202,8830203,8830204,8830205)`;
      await tx`DELETE FROM public.motorista WHERE id IN (8830101,8830102)`;
      await tx`DELETE FROM public.usuario WHERE id IN (8830001,8830002)`;
      await tx`DELETE FROM public.veiculo WHERE id IN (8830111,8830112)`;
    });
  } finally { await sql.end(); await fecharBanco(); }
});
test('agendamento concorrente cria uma viagem e repetições ou conflitos não duplicam', async () => {
  const responses = await Promise.all([post(primeiro,'agendar',agendar),post(primeiro,'agendar',agendar)]);
  expect(responses.map(r=>r.status).sort()).toEqual([200,409]);
  const rows = await sql`SELECT motorista_id::text,veiculo_id::text,status,data_inicio,data_fim FROM public.viagem WHERE solicitacao_id=${primeiro}`;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ motorista_id: agendar.motoristaId, veiculo_id: agendar.veiculoId, status:'AGENDADA', data_inicio:null, data_fim:null });
  expect((await post(segundo,'agendar',agendar)).status).toBe(409);
  expect((await post(primeiro,'agendar',agendar)).status).toBe(409);
});
test('reagendamento atualiza recursos e horários vinculados; conflito preserva a reserva anterior', async () => {
  expect((await post(primeiro,'reagendar',novo)).status).toBe(200);
  const [row] = await sql`SELECT v.motorista_id::text AS motorista,v.veiculo_id::text AS veiculo,
    to_char(s.data_hora_saida,'YYYY-MM-DD HH24:MI') AS saida,to_char(s.data_hora_retorno_previsto,'YYYY-MM-DD HH24:MI') AS retorno
    FROM public.viagem v JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id WHERE s.id=${primeiro}`;
  expect(row).toMatchObject({motorista:novo.motoristaId,veiculo:novo.veiculoId,saida:'2099-12-02 08:00',retorno:'2099-12-02 12:00'});
  expect((await post(segundo,'agendar',agendar)).status).toBe(200);
  expect((await post(primeiro,'reagendar',{...novo,motoristaId:agendar.motoristaId,veiculoId:agendar.veiculoId,dataHoraSaida:'2099-12-01T08:00:00-03:00',dataHoraRetornoPrevisto:agendar.dataHoraRetornoPrevisto})).status).toBe(409);
  const [depois] = await sql`SELECT motorista_id::text,veiculo_id::text FROM public.viagem WHERE solicitacao_id=${primeiro}`;
  expect(depois).toMatchObject({motorista_id:novo.motoristaId,veiculo_id:novo.veiculoId});
});
test('viagem preexistente impede agendamento e reverte pedido e auditoria', async () => {
  const livre = { ...agendar, motoristaId:novo.motoristaId,veiculoId:novo.veiculoId };
  expect((await post(duplicado,'agendar',livre)).status).toBe(409);
  const [row] = await sql`SELECT status,motorista_id,veiculo_id FROM public.solicitacao_viagem WHERE id=${duplicado}`;
  expect(row).toMatchObject({status:'APROVADA',motorista_id:null,veiculo_id:null});
  const [logs] = await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${duplicado}`;
  expect(logs.total).toBe(0);
});
test('reagendamento de solicitação legada sem viagem não cria registro histórico', async () => {
  expect((await post(legado,'reagendar',{...novo,dataHoraSaida:'2099-12-04T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-12-04T12:00:00-03:00'})).status).toBe(200);
  const rows = await sql`SELECT id FROM public.viagem WHERE solicitacao_id=${legado}`;
  expect(rows).toHaveLength(0);
});

test('viagem já iniciada impede reagendamento e preserva pedido e auditoria', async () => {
  const response = await post(iniciada,'reagendar',{...novo,dataHoraSaida:'2099-12-06T08:00:00-03:00',dataHoraRetornoPrevisto:'2099-12-06T12:00:00-03:00'});
  expect(response.status).toBe(409);
  const [row] = await sql`SELECT motorista_id::text,veiculo_id::text,to_char(data_hora_saida,'YYYY-MM-DD HH24:MI') AS saida FROM public.solicitacao_viagem WHERE id=${iniciada}`;
  expect(row).toMatchObject({motorista_id:'8830101',veiculo_id:'8830111',saida:'2099-12-05 08:00'});
  const [logs] = await sql`SELECT count(*)::int AS total FROM public.log_atividade WHERE solicitacao_viagem_id=${iniciada}`;
  expect(logs.total).toBe(0);
});

test('POST de viagem retorna a existente e recusa legado sem viagem',async()=>{
  const enviar=(body:unknown,auth:string|null=token)=>fetch(base+'/api/viagens',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body)});
  expect((await enviar({solicitacaoId:primeiro},null)).status).toBe(401);
  const solicitante=await criarJwt({id:'-27003',perfil:'SOLICITANTE_INTERNO'});
  expect((await enviar({solicitacaoId:primeiro},solicitante)).status).toBe(403);
  expect((await enviar({solicitacaoId:''})).status).toBe(400);
  expect((await enviar({solicitacaoId:'999999999'})).status).toBe(404);
  expect((await enviar({solicitacaoId:legado})).status).toBe(409);
  const respostas=await Promise.all([enviar({solicitacaoId:primeiro}),enviar({solicitacaoId:primeiro})]);
  expect(respostas.map(r=>r.status)).toEqual([200,200]);
  const bodies=await Promise.all(respostas.map(r=>r.json())) as {data:{id:string,solicitacaoId:string}}[];
  expect(bodies[0].data.solicitacaoId).toBe(primeiro);expect(bodies[1].data.id).toBe(bodies[0].data.id);
  const [row]=await sql`SELECT count(*)::int AS total FROM public.viagem WHERE solicitacao_id=${primeiro}`;expect(row.total).toBe(1);
});
