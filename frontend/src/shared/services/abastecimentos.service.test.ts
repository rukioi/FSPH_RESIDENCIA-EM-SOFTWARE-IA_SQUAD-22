import { afterEach, expect, test, vi } from 'vitest';
import { baixarComprovanteAbastecimento, buscarAbastecimentos, registrarAbastecimento,
  buscarDetalheAbastecimento, buscarHistoricoAbastecimentos, buscarIndicadoresAbastecimentos } from './abastecimentos.service';

vi.mock('./auth.service', () => ({ fetchAutenticada: (...args: Parameters<typeof fetch>) => fetch(...args) }));
afterEach(() => vi.unstubAllGlobals());

const registro = { id: '9007199254740993', veiculo_id: '1', motorista_id: '2', posto: null,
  litragem: '12.50', valor_total: '75.00', quilometragem: 1000,
  data_abastecimento: '2026-11-09T00:00:00.000Z', criado_em: null,
  tanque_completo: true, comprovante_nome: 'comprovante.png' };
const entrada = { veiculo_id: '1', motorista_id: '2', litragem: 12.5, valor_total: 75,
  quilometragem: 1000, data_abastecimento: '2026-11-09', tanque_completo: true };

test('comprovante compartilhado aceita PDF privado de até 5 MiB', async () => {
  const mock = vi.fn().mockResolvedValue(new Response(new Uint8Array(2 * 1024 * 1024), { headers: { 'Content-Type': 'application/pdf' } }));
  vi.stubGlobal('fetch', mock);
  const arquivo = await baixarComprovanteAbastecimento('1');
  expect(arquivo.type).toBe('application/pdf');
  expect(arquivo.size).toBe(2 * 1024 * 1024);
});

test.each([null, 0])('cadastro preserva km %s sem converter ausência em zero', async quilometragem => {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {...registro, quilometragem, motorista_id: null} }), {status:201}));
  vi.stubGlobal('fetch', mock);
  const resultado = await registrarAbastecimento({...entrada, quilometragem, motorista_id: null});
  expect(JSON.parse(mock.mock.calls[0][1].body)).toMatchObject({quilometragem, motorista_id:null});
  expect(resultado.quilometragem).toBe(quilometragem);
});

test('detalhe/histórico usam endpoints publicados, paginação e cancelamento', async () => {
  const detalhe = {...registro, quilometragem:null, motorista_id:null, veiculo_placa:'SVO1234',motorista_nome:null,criado_por_id:'9'};
  const mock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({data:detalhe})))
    .mockResolvedValueOnce(new Response(JSON.stringify({data:[detalhe],meta:{page:2,limit:20,total:21}})));
  vi.stubGlobal('fetch', mock);
  const controller = new AbortController();
  expect((await buscarDetalheAbastecimento(registro.id, controller.signal)).quilometragem).toBeNull();
  expect(mock.mock.calls[0][0]).toBe(`/api/abastecimentos/${registro.id}`);
  expect((await buscarHistoricoAbastecimentos('1', {inicio:'2026-11-01',fim:'2026-11-30',pagina:2,limit:20}, controller.signal)).meta.total).toBe(21);
  expect(mock.mock.calls[1][0]).toBe('/api/veiculos/1/abastecimentos?inicio=2026-11-01&fim=2026-11-30&pagina=2&limit=20');
  expect(mock.mock.calls[1][1].signal).toBe(controller.signal);
});

test('indicadores preservam zero real, consumo indisponível e não substituem erro por zero', async () => {
  const data = {estado:'SEM_ABASTECIMENTOS',quantidade:0,totalLitros:'0.00',totalCusto:'0.00',custoPorLitro:null,
    periodoObservado:{inicio:null,fim:null},kmObservadosPorVeiculo:[],
    consumoPorDistancia:{valor:null,estado:'INDISPONIVEL',motivo:'REGRA_DE_NEGOCIO_PENDENTE'}};
  const mock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data})))
    .mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'ERRO_INTERNO',message:'Falha'}}),{status:500}));
  vi.stubGlobal('fetch', mock);
  expect(await buscarIndicadoresAbastecimentos({veiculoId:'1',inicio:'',fim:''})).toEqual(data);
  expect(mock.mock.calls[0][0]).toBe('/api/abastecimentos/indicadores?veiculoId=1');
  await expect(buscarIndicadoresAbastecimentos({})).rejects.toMatchObject({status:500});
});

test.each([400,401,403,404,413,415])('preserva erro HTTP %s do comprovante protegido', async status => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:'FALHA',message:'Falha esperada'}}),{status})));
  await expect(baixarComprovanteAbastecimento('1')).rejects.toMatchObject({status});
});

test('download recusa PDF acima de 5 MiB', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(new Uint8Array(5 * 1024 * 1024 + 1),{headers:{'Content-Type':'application/pdf'}})));
  await expect(baixarComprovanteAbastecimento('1')).rejects.toMatchObject({code:'RESPOSTA_INVALIDA'});
});

test('lista preserva BIGINT e transmite cancelamento sem expor conteúdo de comprovantes', async () => {
  const row = { ...registro, veiculo_placa: 'ABC1D23', motorista_nome: 'Fixture' };
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [row] })));
  vi.stubGlobal('fetch', mock);
  const controller = new AbortController();
  expect(await buscarAbastecimentos(controller.signal)).toEqual([row]);
  expect(mock.mock.calls[0][1].signal).toBe(controller.signal);
});

test('cadastro envia tanque/comprovante e só resolve após confirmação válida', async () => {
  let confirmar!: (response: Response) => void;
  const mock = vi.fn().mockImplementation(() => new Promise<Response>(resolve => { confirmar = resolve; }));
  vi.stubGlobal('fetch', mock);
  const body = { ...entrada, comprovante: { nome: 'comprovante.png', tipo: 'image/png' as const, dadosBase64: 'iVBORw0KGgo=' } };
  let concluido = false;
  const pendente = registrarAbastecimento(body).then(value => { concluido = true; return value; });
  expect(concluido).toBe(false);
  expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual(body);
  confirmar(new Response(JSON.stringify({ data: registro }), { status: 201 }));
  expect(await pendente).toEqual(registro);
});

test('resposta inválida não confirma cadastro e preserva correlação', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: '1' } }),
    { status: 201, headers: { 'X-Request-Id': 'abastecimento-fixture' } })));
  await expect(registrarAbastecimento(entrada)).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA', requestId: 'abastecimento-fixture' });
});

test('download autenticado aceita imagem e mantém BIGINT no caminho', async () => {
  const mock = vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }));
  vi.stubGlobal('fetch', mock);
  expect((await baixarComprovanteAbastecimento(registro.id)).type).toBe('image/png');
  expect(mock.mock.calls[0][0]).toBe('/api/abastecimentos/9007199254740993/comprovante');
});

test('download não apresenta HTML de erro nem sucesso inválido como comprovante', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>privado</html>', { status: 403,
    headers: { 'Content-Type': 'text/html', 'X-Request-Id': 'fixture' } })));
  await expect(baixarComprovanteAbastecimento('1')).rejects.toMatchObject({ status: 403, code: 'HTTP_403', requestId: 'fixture' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>privado</html>', { headers: { 'Content-Type': 'text/html' } })));
  await expect(baixarComprovanteAbastecimento('1')).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA' });
});

test('download cancelado ou identificador inválido não produz arquivo', async () => {
  const controller = new AbortController();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
    controller.abort();
    return new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'image/png' } });
  }));
  await expect(baixarComprovanteAbastecimento('1', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  await expect(baixarComprovanteAbastecimento('../1')).rejects.toMatchObject({ code: 'DADOS_INVALIDOS' });
});
