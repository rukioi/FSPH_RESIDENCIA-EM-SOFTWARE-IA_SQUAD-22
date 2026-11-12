import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {createApp} from '../../src/app.js';
import {prepararAnexos} from '../helpers/anexos-fixture.js';
import {dashboardConsolidadoSchemas} from '../../src/modules/dashboard/dashboard.consolidado.schemas.js';
const server=createApp();let fixture:Awaited<ReturnType<typeof prepararAnexos>>;let base:string;
beforeAll(async()=>{fixture=await prepararAnexos();await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;});
afterAll(async()=>{await new Promise<void>(r=>server.close(()=>r()));await fixture?.limpar();});
const get=(path='/api/dashboard',ator:string|null='ADM')=>fetch(base+path,{headers:ator?{Authorization:`Bearer ${fixture.tokens[ator]}`}:{}});
const periodo='?periodo=personalizado&inicio=2026-12-01T00:00:00-03:00&fim=2026-12-02T00:00:00-03:00';
async function gestao(query=periodo){
  const response=await get('/api/dashboard'+query);expect(response.status).toBe(200);
  const {data}=dashboardConsolidadoSchemas.DashboardConsolidado.parse(await response.json());
  if(data.visao!=='GESTAO')throw new Error('Visão incorreta');return data;
}

test('viagens do período são registros de viagem reais; totais coincidem com SQL e sobrevivem à reconsulta',async()=>{
  const antes=await gestao();
  const [sql]=await fixture.sql`SELECT count(*)::int AS n FROM viagem v JOIN solicitacao_viagem s ON s.id=v.solicitacao_id
    WHERE s.data_hora_saida>='2026-12-01 00:00:00' AND s.data_hora_saida<'2026-12-02 00:00:00'`;
  expect(antes.viagens.quantidade).toBe(sql.n);
  await fixture.sql`UPDATE viagem SET status='CANCELADA' WHERE id=92194`;
  const depois=await gestao();expect(depois.viagens.porStatus.find(r=>r.status==='CANCELADA')?.total)
    .toBe((antes.viagens.porStatus.find(r=>r.status==='CANCELADA')?.total??0)+1);
  expect((await gestao()).viagens).toEqual(depois.viagens);
});

test('documentos são estado atual e não viram alertas RF46 inventados',async()=>{
  const antes=await gestao();
  await fixture.sql`UPDATE documento_veiculo SET data_vencimento=CURRENT_DATE-1 WHERE id=92194`;
  const depois=await gestao();expect(depois.documentos.vencidos).toBe(antes.documentos.vencidos+1);
  expect(depois.documentos.alertas).toEqual({estado:'INDISPONIVEL',valor:null,motivo:'REGRA_RF46_PENDENTE'});
  const [contagem]=await fixture.sql`SELECT count(*)::int AS n FROM
    (SELECT data_vencimento AS validade FROM documento_veiculo UNION ALL SELECT validade_cnh FROM motorista) d WHERE validade<CURRENT_DATE`;
  expect(depois.documentos.vencidos).toBe(contagem.n);
});

test('combustível usa agregador existente, período civil e consumo permanece indisponível',async()=>{
  await fixture.sql`UPDATE abastecimento SET data_abastecimento='2026-12-01' WHERE id=92194`;
  const data=await gestao();
  const direto=await get('/api/abastecimentos/indicadores?inicio=2026-12-01&fim=2026-12-01');
  expect(data.abastecimentos).toEqual((await direto.json()).data);
  expect(data.abastecimentos.consumoPorDistancia).toEqual({valor:null,estado:'INDISPONIVEL',motivo:'REGRA_DE_NEGOCIO_PENDENTE'});
  expect(data.abastecimentos.quantidade).toBeGreaterThanOrEqual(1);
});

test('período vazio retorna zeros reais sem apagar filas/documentos atuais',async()=>{
  const data=await gestao('?periodo=personalizado&inicio=2001-01-01T00:00:00-03:00&fim=2001-01-02T00:00:00-03:00');
  expect(data.viagens.quantidade).toBe(0);expect(data.viagens.porStatus).toEqual([]);
  expect(data.abastecimentos).toMatchObject({quantidade:0,totalLitros:'0.00',totalCusto:'0.00',custoPorLitro:null});
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
