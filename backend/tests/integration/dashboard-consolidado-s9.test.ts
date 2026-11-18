import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {createApp} from '../../src/app.js';
import {prepararAnexos} from '../helpers/anexos-fixture.js';
import {dashboardConsolidadoSchemas} from '../../src/modules/dashboard/dashboard.consolidado.schemas.js';
const server=createApp();let fixture:Awaited<ReturnType<typeof prepararAnexos>>;let base:string;
beforeAll(async()=>{fixture=await prepararAnexos();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));await fixture?.limpar();});
const get=(path='/api/dashboard',ator:string|null='ADM')=>fetch(base+path,{headers:ator?{Authorization:`Bearer ${fixture.tokens[ator]}`}:{}});
const periodo='?periodo=personalizado&inicio=2098-01-01T00:00:00-03:00&fim=2098-01-02T00:00:00-03:00';
async function gestao(query=periodo){
  const response=await get('/api/dashboard'+query);expect(response.status).toBe(200);
  const {data}=dashboardConsolidadoSchemas.DashboardConsolidado.parse(await response.json());
  if(data.visao!=='GESTAO')throw new Error('Visão incorreta');return data;
}

test('IND-02 usa início real e IND-08 usa saída prevista de viagem agendada', async () => {
  const antes = await gestao();
  await fixture.sql`UPDATE public.viagem SET status='EM_TRANSPORTE',km_inicial=100,
    data_inicio='2098-01-01 08:00:00' WHERE id=92194`;
  await fixture.sql`UPDATE public.solicitacao_viagem SET status='AGENDADA',
    data_hora_saida='2098-01-01 09:00:00' WHERE id=92195`;
  const depois = await gestao();
  const [dados] = await fixture.sql`SELECT count(*)::int AS total FROM public.viagem
    WHERE data_inicio >= '2098-01-01' AND data_inicio < '2098-01-02'`;
  expect(depois.viagens).toMatchObject({ criterio: 'dataInicio', quantidade: dados.total,
    proximas: expect.arrayContaining([{ id: '92195', solicitacaoId: '92195',
      saida: '2098-01-01T09:00:00.000000-03:00', veiculoId: '92195', motoristaId: '92200',
      status: 'AGENDADA' }]) });
  expect(depois.viagens.quantidade).toBe(antes.viagens.quantidade+1);
  expect(depois.viagens.proximas.some(row=>row.id==='92194')).toBe(false);
  expect((await gestao()).viagens).toEqual(depois.viagens);
  if(process.env.CI) console.info('SCRUM-195 IND-02/08', {
    inicioRealAntes: antes.viagens.quantidade, inicioRealDepois: depois.viagens.quantidade,
    totalSql: dados.total, agendadaPresente: depois.viagens.proximas.some(row=>row.id==='92195'),
  });
});

test('documentos são estado atual e o IND-09 compartilha a coorte RF46',async()=>{
  const antes=await gestao();
  await fixture.sql`UPDATE documento_veiculo SET data_vencimento=(transaction_timestamp() AT TIME ZONE 'America/Maceio')::date-1 WHERE id=92194`;
  const depois=await gestao();expect(depois.documentos.vencidos).toBe(antes.documentos.vencidos+1);

  const [contagem]=await fixture.sql`SELECT count(*)::int AS n FROM
    (SELECT data_vencimento AS validade FROM documento_veiculo UNION ALL SELECT validade_cnh FROM motorista) d WHERE validade<(transaction_timestamp() AT TIME ZONE 'America/Maceio')::date`;
  expect(depois.documentos.vencidos).toBe(contagem.n);
  const alertas = await (await get('/api/documentos/alertas?limit=100')).json();
  expect(depois.documentos.alertas).toEqual({estado:'DISPONIVEL', valor:alertas.data.filter((r:{fase:string})=>r.fase!=='VENCIDO').length});
  if(process.env.CI) console.info('SCRUM-195 documentos', { api: depois.documentos.vencidos, sql: contagem.n, rf46: depois.documentos.alertas.estado });
});

test('dashboard reaproveita os indicadores de abastecimento do dia civil',async()=>{
  await fixture.sql`UPDATE abastecimento SET data_abastecimento='2098-01-01' WHERE id=92194`;
  const direto = await get('/api/abastecimentos/indicadores?inicio=2098-01-01&fim=2098-01-01');
  expect(direto.status).toBe(200);
  const data = await gestao();
  expect(data.abastecimentos).toEqual((await direto.json()).data);
  expect(data.abastecimentos).toMatchObject({ quantidade:1, totalLitros:'10.00', totalCusto:'60.00',
    consumoPorDistancia:{estado:'INDISPONIVEL',valor:null} });
});

test('período vazio retorna zeros reais sem apagar filas/documentos atuais',async()=>{
  const data=await gestao('?periodo=personalizado&inicio=2001-01-01T00:00:00-03:00&fim=2001-01-02T00:00:00-03:00');
  expect(data.viagens.quantidade).toBe(0);expect(data.viagens.porStatus).toEqual([]);
  expect(data.abastecimentos).toMatchObject({ estado:'SEM_ABASTECIMENTOS', quantidade:0 });
  expect(data.documentos.vencidos).toBe((await gestao()).documentos.vencidos);
});

test('SVO reutiliza SCRUM-149, não expõe gestão/documentos/CNH e não amplia outros endpoints',async()=>{
  const response=await get('/api/dashboard?periodo=30d','ATENDENTE_SVO');expect(response.status).toBe(200);
  const {data}=dashboardConsolidadoSchemas.DashboardConsolidado.parse(await response.json());
  expect(data.visao).toBe('SVO');if(data.visao!=='SVO')throw new Error('Visão incorreta');
  expect(data.operacional).toEqual(await(await get('/api/svo/dashboard?periodo=30d','ATENDENTE_SVO')).json());
  expect(data.filas).toEqual(await(await get('/api/svo/dashboard/filas','ATENDENTE_SVO')).json());
  expect(JSON.stringify(data)).not.toMatch(/numeroCnh|abastecimentos|senha|cpf|observacoes_medicas/);
  for(const path of ['/api/dashboard/gestor','/api/dashboard/graficos','/api/dashboard/pendencias'])expect((await get(path,'ATENDENTE_SVO')).status).toBe(403);
});

test('400/401/403 seguem contratos reais sem responder sucesso vazio',async()=>{
  expect((await get('/api/dashboard',null)).status).toBe(401);
  for(const perfil of ['MOTORISTA','SOLICITANTE_INTERNO'])expect((await get('/api/dashboard',perfil)).status).toBe(403);
  for(const query of ['?periodo=invalido','?periodo=hoje&periodo=7d','?inicio=2026-01-01','?extra=x'])expect((await get('/api/dashboard'+query)).status).toBe(400);
  expect((await get('/api/dashboard'+periodo,'ATENDENTE_SVO')).status).toBe(400);
});
