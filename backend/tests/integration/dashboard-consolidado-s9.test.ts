import {afterAll,beforeAll,expect,test} from 'vitest';
import type {AddressInfo} from 'node:net';
import {createApp} from '../../src/app.js';
import {prepararAnexos} from '../helpers/anexos-fixture.js';
import {dashboardConsolidadoSchemas} from '../../src/modules/dashboard/dashboard.consolidado.schemas.js';
import { svoSchemas } from '../../src/modules/svo/svo.schemas.js';
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
    consumoPorDistancia:{estado:'DADOS_INSUFICIENTES',valor:null} });
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

test('IND-10 a IND-14 refletem cadastro, triagem e ordem de coleta persistidos pela API', async () => {
  const ator = 'ATENDENTE_SVO';
  const solicitacoes: string[] = [];
  const post = (path: string, payload: object) => fetch(base + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + fixture.tokens[ator], 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const painel = async () => {
    const response = await get('/api/dashboard?periodo=7d', ator);
    expect(response.status).toBe(200);
    const { data } = dashboardConsolidadoSchemas.DashboardConsolidado.parse(await response.json());
    if (data.visao !== 'SVO') throw new Error('Visão incorreta');
    return data;
  };

  const antes = await painel();
  try {
    for (const nome of ['Cenário SVO isolado', 'Cenário IML isolado']) {
      const response = await post('/api/svo/solicitacoes', {
        localFalecimento: 'Local de teste', enderecoRemocao: 'Endereço de teste', solicitanteNome: nome,
      });
      expect(response.status).toBe(201);
      const { solicitacao } = svoSchemas.SolicitacaoSvo.parse(await response.json());
      solicitacoes.push(solicitacao.id);
    }

    const cadastradas = await painel();
    expect(cadastradas.operacional.indicadores.aguardandoTriagem).toBe(antes.operacional.indicadores.aguardandoTriagem + 2);
    expect(cadastradas.operacional.visaoGeral.aguardandoTriagem).toBe(antes.operacional.visaoGeral.aguardandoTriagem + 2);

    const confirmada = await post('/api/svo/solicitacoes/' + solicitacoes[0] + '/triagem', {
      decisao: 'CONFIRMADA_SVO', quantidadeCorpos: 1, triagemObservacoes: 'Triagem de teste SVO',
    });
    expect(confirmada.status).toBe(200);
    const confirmacao = svoSchemas.TriagemFinalSvo.parse(await confirmada.json());
    const encaminhada = await post('/api/svo/solicitacoes/' + solicitacoes[1] + '/triagem', {
      decisao: 'ENCAMINHADA_IML', triagemObservacoes: 'Triagem de teste IML',
    });
    expect(encaminhada.status).toBe(200);
    expect(svoSchemas.TriagemFinalSvo.parse(await encaminhada.json()).ordemColeta).toBeNull();

    const registros = await fixture.sql`
      SELECT so.id::text AS id, so.status_triagem, so.triado_em IS NOT NULL AS triada,
        oc.id::text AS "ordemId", oc.status AS "ordemStatus"
      FROM public.solicitacao_obito so
      LEFT JOIN public.ordem_coleta oc ON oc.solicitacao_obito_id = so.id
      WHERE so.id = ANY(${solicitacoes}::bigint[])
      ORDER BY so.id
    `;
    expect(confirmacao.ordemColeta).not.toBeNull();
    expect(registros).toEqual([
      { id: solicitacoes[0], status_triagem: 'CONFIRMADA_SVO', triada: true,
        ordemId: confirmacao.ordemColeta?.id, ordemStatus: 'PENDENTE_ALOCACAO' },
      { id: solicitacoes[1], status_triagem: 'ENCAMINHADA_IML', triada: true, ordemId: null, ordemStatus: null },
    ]);

    const depois = await painel();
    const indicadores = antes.operacional.indicadores;
    const coorte = antes.operacional.visaoGeral;
    expect(depois.operacional.indicadores).toEqual({
      aguardandoTriagem: indicadores.aguardandoTriagem,
      confirmadasSvo: indicadores.confirmadasSvo + 1,
      ordensColeta: indicadores.ordensColeta + 1,
      encaminhadasIml: indicadores.encaminhadasIml + 1,
    });
    expect(depois.operacional.visaoGeral).toEqual({
      ...coorte, confirmadasSvo: coorte.confirmadasSvo + 1, encaminhadasIml: coorte.encaminhadasIml + 1,
    });
    expect(depois.filas.aguardandoTriagem.total).toBe(antes.filas.aguardandoTriagem.total);
    expect(depois.filas.aguardandoDespacho.total).toBe(antes.filas.aguardandoDespacho.total + 1);
    expect(depois.atividades.some(atividade => atividade.descricao ===
      'Ordem de coleta ' + confirmacao.ordemColeta?.codigo + ' gerada para ' + confirmacao.solicitacao.codigo)).toBe(true);
    if (process.env.CI) console.info('SCRUM-195 IND-10–14 HTTP/SQL', {
      cadastroHttp: 201, triagemHttp: 200, dashboardHttp: 200, registros,
      antes: indicadores, aposCadastro: cadastradas.operacional.indicadores, depois: depois.operacional.indicadores,
    });
  } finally {
    if (solicitacoes.length) {
      await fixture.admin.begin(async tx => {
        await tx`DELETE FROM public.ordem_coleta WHERE solicitacao_obito_id = ANY(${solicitacoes}::bigint[])`;
        await tx`DELETE FROM public.solicitacao_obito WHERE id = ANY(${solicitacoes}::bigint[])`;
      });
    }
  }
});

test('400/401/403 seguem contratos reais sem responder sucesso vazio',async()=>{
  expect((await get('/api/dashboard',null)).status).toBe(401);
  for(const perfil of ['MOTORISTA','SOLICITANTE_INTERNO'])expect((await get('/api/dashboard',perfil)).status).toBe(403);
  for(const query of ['?periodo=invalido','?periodo=hoje&periodo=7d','?inicio=2026-01-01','?extra=x'])expect((await get('/api/dashboard'+query)).status).toBe(400);
  expect((await get('/api/dashboard'+periodo,'ATENDENTE_SVO')).status).toBe(400);
});
