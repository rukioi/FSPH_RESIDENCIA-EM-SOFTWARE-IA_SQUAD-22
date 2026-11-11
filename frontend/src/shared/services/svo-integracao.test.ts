import { afterEach, expect, test, vi } from 'vitest'
import { criarSolicitacaoSvo, finalizarTriagemSvo, listarSolicitacoesSvo, salvarTriagemSvo, consultarSolicitacoesSvo, consultarOrdensSvo, consultarSolicitacaoSvo, consultarDashboardSvo, consultarFilasSvo, consultarAtividadesSvo } from './svo.service'
vi.mock('./auth.service', () => ({ fetchAutenticada: (...args: Parameters<typeof fetch>) => fetch(...args) }))
afterEach(() => vi.unstubAllGlobals())
function resposta(body: unknown, status = 200) {
  const mock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', mock)
  return mock
}
const protocolo = { id: '9007199254740993', codigo: '#SVO-9007199254740993', status_triagem: 'AGUARDANDO_TRIAGEM', criado_em: null }
const resultado = { solicitacao: { id: protocolo.id, codigo: protocolo.codigo, statusTriagem: 'CONFIRMADA_SVO', triadoPorId: '42', triadoEm: '2026-11-05T12:00:00.000Z' },
  ordemColeta: { id: '43', codigo: '#OC-43', status: 'PENDENTE_ALOCACAO', quantidadeCorpos: 2 }, atividades: [] }
test('lista preserva BIGINT e status legado; envia somente o filtro suportado e o cancelamento', async () => {
  const registros = [protocolo, { ...protocolo, id: '44', status_triagem: null }]
  const mock = resposta(registros)
  const signal = new AbortController().signal
  expect(await listarSolicitacoesSvo('AGUARDANDO_TRIAGEM', signal)).toEqual(registros)
  expect(mock.mock.calls[0][0]).toBe('/api/svo/solicitacoes?status=AGUARDANDO_TRIAGEM')
  expect(mock.mock.calls[0][1].signal).toBe(signal)
})
test('rascunho usa PATCH, mantém pendente e não envia decisão', async () => {
  const body = { triagemObservacoes: 'Observação de teste' }
  const retorno = { solicitacaoId: protocolo.id, statusTriagem: 'AGUARDANDO_TRIAGEM', ...body, atividades: [] }
  const mock = resposta(retorno)
  expect(await salvarTriagemSvo(protocolo.id, body)).toEqual(retorno)
  expect(mock.mock.calls[0][1].method).toBe('PATCH')
  expect(JSON.parse(mock.mock.calls[0][1].body)).toEqual(body)
})
test('finalização SVO exige e preserva a ordem retornada; IML aceita somente ausência de ordem', async () => {
  const mock = resposta(resultado)
  expect(await finalizarTriagemSvo(protocolo.id, { decisao: 'CONFIRMADA_SVO', triagemObservacoes: 'Teste', quantidadeCorpos: 2 })).toEqual(resultado)
  expect(mock.mock.calls[0][0]).toBe(`/api/svo/solicitacoes/${protocolo.id}/triagem`)
  expect(mock.mock.calls[0][1].method).toBe('POST')
  const iml = { ...resultado, solicitacao: { ...resultado.solicitacao, statusTriagem: 'ENCAMINHADA_IML' }, ordemColeta: null }
  resposta(iml)
  expect(await finalizarTriagemSvo(protocolo.id, { decisao: 'ENCAMINHADA_IML', triagemObservacoes: 'Teste' })).toEqual(iml)
})
test.each([
  { ...resultado, ordemColeta: null },
  { ...resultado, solicitacao: { ...resultado.solicitacao, id: '99' } },
  { ...resultado, solicitacao: { ...resultado.solicitacao, statusTriagem: 'ENCAMINHADA_IML' } },
])('rejeita resposta de finalização incompatível sem montar resultado local', async retorno => {
  resposta(retorno)
  await expect(finalizarTriagemSvo(protocolo.id, { decisao: 'CONFIRMADA_SVO', triagemObservacoes: 'Teste', quantidadeCorpos: 2 })).rejects.toMatchObject({ code: 'RESPOSTA_INVALIDA' })
})
test.each([400,401,403,404,409])('triagem propaga erro HTTP %i sem transformá-lo em sucesso', async status => {
  resposta({ error: { code: `HTTP_${status}`, message: 'Operação recusada.' } }, status)
  await expect(salvarTriagemSvo(protocolo.id, {triagemObservacoes:'Teste'})).rejects.toMatchObject({status})
  await expect(finalizarTriagemSvo(protocolo.id, {decisao:'ENCAMINHADA_IML',triagemObservacoes:'Teste'})).rejects.toMatchObject({status})
})
test('cadastro rejeita espaços nos campos obrigatórios antes de enviar', async () => {
  const mock = resposta({})
  await expect(criarSolicitacaoSvo({localFalecimento:' ',enderecoRemocao:'Rua',solicitanteNome:'Teste'})).rejects.toMatchObject({code:'DADOS_INVALIDOS'})
  expect(mock).not.toHaveBeenCalled()
})

test('consultas paginadas enviam apenas filtros publicados e preservam total e BIGINT',async()=>{
  const lista={data:[{id:protocolo.id,codigo:protocolo.codigo,statusTriagem:null,criadoEm:'2026-11-05T01:10:00.123456'}],meta:{page:2,limit:20,total:21}}
  const mock=resposta(lista)
  expect(await consultarSolicitacoesSvo({page:2,status:'AGUARDANDO_TRIAGEM',inicio:'2026-11-01',fim:'2026-11-05'})).toEqual(lista)
  expect(mock.mock.calls[0][0]).toBe('/api/svo/solicitacoes/paginadas?page=2&limit=20&status=AGUARDANDO_TRIAGEM&inicio=2026-11-01&fim=2026-11-05')
  const ordens=resposta({data:[],meta:{page:1,limit:20,total:0}})
  await consultarOrdensSvo({page:1,status:'EM_DESLOCAMENTO'})
  expect(ordens.mock.calls[0][0]).toBe('/api/svo/ordens-coleta/paginadas?page=1&limit=20&status=EM_DESLOCAMENTO')
})
const detalhe={id:protocolo.id,codigo:protocolo.codigo,statusTriagem:'AGUARDANDO_TRIAGEM',criadoEm:'2026-11-05T01:10:00.123456',
  triagemObservacoes:'Rascunho persistido de teste',triadoPorId:null,triadoEm:null,localFalecimento:'Local de teste',enderecoRemocao:'Rua de teste',pontoReferencia:null,
  canalAtendimento:'TELEFONE',solicitanteNome:'Pessoa de teste',solicitanteParentesco:null,solicitanteTelefone:null,nomeFalecido:null,observacoesMedicas:null,ordemColeta:null}
test('detalhe recupera rascunho por GET sem decidir e rejeita resposta de outro protocolo',async()=>{
  const mock=resposta(detalhe)
  expect(await consultarSolicitacaoSvo(protocolo.id)).toEqual(detalhe)
  expect(mock.mock.calls[0][1].method).toBe('GET')
  resposta({...detalhe,id:'99'})
  await expect(consultarSolicitacaoSvo(protocolo.id)).rejects.toMatchObject({code:'RESPOSTA_INVALIDA'})
})
const indicadores={periodo:'7d',inicio:'2026-10-30',fim:'2026-11-05',indicadores:{aguardandoTriagem:5,confirmadasSvo:7,ordensColeta:7,encaminhadasIml:2},visaoGeral:{aguardandoTriagem:0,confirmadasSvo:1,encaminhadasIml:0,semClassificacao:1}}
test('dashboard conserva agregações distintas e não aceita outro período ou resposta incompleta',async()=>{
  const mock=resposta(indicadores)
  expect(await consultarDashboardSvo('7d')).toEqual(indicadores)
  expect(mock.mock.calls[0][0]).toBe('/api/svo/dashboard?periodo=7d')
  await expect(consultarDashboardSvo('hoje')).rejects.toMatchObject({code:'RESPOSTA_INVALIDA'})
  resposta({periodo:'7d'})
  await expect(consultarDashboardSvo('7d')).rejects.toMatchObject({code:'RESPOSTA_INVALIDA'})
})
test('filas e atividades não recebem período nem usam contadores locais',async()=>{
  const filas={aguardandoTriagem:{total:5,itens:[]},aguardandoDespacho:{total:3,itens:[]}}
  const mock=resposta(filas)
  expect(await consultarFilasSvo()).toEqual(filas)
  expect(mock.mock.calls[0][0]).toBe('/api/svo/dashboard/filas')
  const atividades={data:[{id:'1',descricao:'Evento persistido de teste',dataHora:'2026-11-05T00:01:00.000000',usuarioId:null,usuarioNome:null}]}
  const consulta=resposta(atividades)
  expect(await consultarAtividadesSvo()).toEqual(atividades)
  expect(consulta.mock.calls[0][0]).toBe('/api/svo/dashboard/atividades?limite=10')
})
