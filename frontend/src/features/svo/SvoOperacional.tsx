import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, navegar } from '../../app/routes/router'
import { ROTAS, rotaTriagemSvo, rotaSolicitacaoSvo, rotaOrdemSvo } from '../../app/routes/rotas'
import { useRemoteData } from '../../shared/api/useRemoteData'
import { ApiError } from '../../shared/api/errors'
import { criarSolicitacaoSvo, finalizarTriagemSvo, consultarOrdensSvo, consultarSolicitacoesSvo, consultarSolicitacaoSvo, salvarTriagemSvo } from '../../shared/services/svo.service'
import type { CriarSolicitacaoSvoResponse, DetalheSolicitacaoSvo, ListaSolicitacoesSvo, ListaOrdensSvo, FiltrosSolicitacoesSvo, FiltrosOrdensSvo, StatusTriagemSvo, StatusOrdemSvo, TriagemFinalSvoResponse } from '../../shared/types/svo'
import { NovaSolicitacaoSvo, type NovaSolicitacaoDados } from './NovaSolicitacaoSvo'
import { Pagina, Painel } from './PreviewPainel'
import './PreviewSvo.css'

import { dataCivilSvo, estadosTriagem, estadosOrdem, nomeStatusSvo } from './apresentacaoSvo'

function paginaInicial() {
  const valor=Number(new URLSearchParams(window.location.search).get('page') || '1')
  return Number.isSafeInteger(valor) && valor>0 ? valor : 1
}
function filtroInicial(chave:string, nomes:Record<string,string>) {
  const valor=new URLSearchParams(window.location.search).get(chave)
  return valor && Object.hasOwn(nomes,valor) ? valor : undefined
}
function atualizarUrl(filtros: FiltrosSolicitacoesSvo | FiltrosOrdensSvo) {
  const query=new URLSearchParams()
  for(const [nome,valor] of Object.entries(filtros)) if(valor) query.set(nome,String(valor))
  window.history.replaceState(null,'',window.location.pathname+'?'+query)
}
function Paginacao({meta, mudar}: {meta:ListaSolicitacoesSvo['meta']; mudar:(pagina:number)=>void}) {
  return <nav className="svo-acoes" aria-label="Paginação">
    <button disabled={meta.page<=1} onClick={()=>mudar(meta.page-1)}>Página anterior</button>
    <span>Página {meta.page} · {meta.total} registro(s)</span>
    <button disabled={meta.page*meta.limit>=meta.total} onClick={()=>mudar(meta.page+1)}>Próxima página</button>
  </nav>
}

/** Usa o cadastro existente e oferece uma nova consulta do servidor após o protocolo confirmado. */
export function CadastroSolicitacaoSvo() {
  const [resultado, setResultado] = useState<CriarSolicitacaoSvoResponse | null>(null)
  const ativa = useRef(true)
  useEffect(() => { ativa.current = true; return () => { ativa.current = false } }, [])
  async function cadastrar(dados: NovaSolicitacaoDados) {
    const resposta = await criarSolicitacaoSvo({
      localFalecimento: dados.localFalecimento, enderecoRemocao: dados.endereco, solicitanteNome: dados.nomeSolicitante,
      nomeFalecido: dados.nomeFalecido || undefined, solicitanteTelefone: dados.telefoneSolicitante || undefined,
      solicitanteParentesco: dados.parentesco || undefined, pontoReferencia: dados.pontoReferencia || undefined,
      observacoesMedicas: dados.observacoesMedicas || undefined, canalAtendimento: 'TELEFONE',
    })
    if (ativa.current) setResultado(resposta)
  }
  if (!resultado) return <NovaSolicitacaoSvo onConfirmar={cadastrar} onVoltar={() => navegar(ROTAS.svoSolicitacoes)} />
  return <Pagina titulo="Solicitação registrada">
    <p role="status">Solicitação {resultado.solicitacao.codigo} registrada. Aguardando triagem; nenhuma ordem de coleta foi criada.</p>
    <p>O protocolo foi retornado pelo servidor. Consulte a lista para verificar o estado atual.</p>
    <div className="svo-acoes">
      <Link className="svo-atalho" para={ROTAS.svoSolicitacoes}>Consultar solicitações</Link>
      <Link className="svo-atalho" para={rotaTriagemSvo(resultado.solicitacao.id)}>Abrir triagem</Link>
      <Link className="svo-atalho" para={ROTAS.svoDashboard}>Voltar ao dashboard</Link>
      <button type="button" onClick={() => setResultado(null)}>Novo atendimento</button>
    </div>
  </Pagina>
}

/** Usa paginação e filtros realmente publicados, conservando-os na URL para recarga. */
export function ListaSolicitacoesIntegrada() {
  const [filtros,setFiltros]=useState<FiltrosSolicitacoesSvo>(()=>{
    const query=new URLSearchParams(window.location.search)
    return {page:paginaInicial(),status:filtroInicial('status',estadosTriagem) as StatusTriagemSvo|undefined,
      inicio:query.get('inicio')||undefined,fim:query.get('fim')||undefined}
  })
  const load=useCallback((signal:AbortSignal)=>consultarSolicitacoesSvo(filtros,signal),[filtros])
  const remoto=useRemoteData<ListaSolicitacoesSvo|null>(load,null)
  const [inicio, setInicio] = useState(filtros.inicio ?? '')
  const [fim, setFim] = useState(filtros.fim ?? '')
  function aplicar(proximo:FiltrosSolicitacoesSvo) {setFiltros(proximo);atualizarUrl(proximo)}
  return <Pagina titulo="Solicitações" descricao="Consulte os protocolos registrados e o estado atual da triagem."
    acao={<Link className="svo-atalho svo-atalho--primario" para={ROTAS.svoNovaSolicitacao}>Nova Solicitação</Link>}>
    <Painel titulo={filtros.status ? estadosTriagem[filtros.status] : 'Solicitações registradas'}>
      <div className="svo-filtros"><label>Status<select value={filtros.status||''} onChange={e=>aplicar({...filtros,page:1,status:e.target.value as StatusTriagemSvo||undefined})}>
        <option value="">Todos os status</option>{Object.entries(estadosTriagem).map(([codigo,nome])=><option key={codigo} value={codigo}>{nome}</option>)}
      </select></label></div>
      <form className="svo-filtros" onSubmit={e=>{
        e.preventDefault(); const dados=new FormData(e.currentTarget)
        aplicar({...filtros,page:1,inicio:String(dados.get('inicio')||'')||undefined,fim:String(dados.get('fim')||'')||undefined})
      }}>
        <label>Recebidas desde<input type="date" name="inicio" value={inicio} onChange={e=>setInicio(e.target.value)}/></label>
        <label>Recebidas até<input type="date" name="fim" value={fim} onChange={e=>setFim(e.target.value)}/></label>
        <div className="svo-acoes"><button type="submit">Aplicar período</button>
          <button type="button" onClick={()=>{setInicio('');setFim('');aplicar({page:1})}}>Limpar filtros</button>
          <button type="button" onClick={remoto.retry}>Atualizar lista</button></div>
      </form>
      <p>Período aplicado ao recebimento: {filtros.inicio ? dataCivilSvo(filtros.inicio) : 'sem início'} até {filtros.fim ? dataCivilSvo(filtros.fim) : 'sem fim'}. Filtro por canal ainda indisponível.</p>
      {remoto.loading ? <p role="status">Carregando solicitações…</p> : remoto.error ? <div className="svo-acoes"><p role="alert">{remoto.error}</p><button onClick={remoto.retry}>Tentar novamente</button></div>
        : remoto.data && <>
          <div className="svo-tabela" tabIndex={0} role="region" aria-label="Solicitações registradas"><table>
            <caption className="sr-only">Solicitações registradas</caption><thead><tr><th>Protocolo</th><th>Recebimento</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>{remoto.data.data.map(item=><tr key={item.id}><td>{/^[1-9]\d*$/.test(item.id) ? <Link className="svo-atalho" para={rotaSolicitacaoSvo(item.id)}>{item.codigo}</Link> : item.codigo}</td><td>{dataCivilSvo(item.criadoEm)}</td><td>{nomeStatusSvo(item.statusTriagem,estadosTriagem)}</td>
              <td>{/^[1-9]\d*$/.test(item.id) ? <Link className="svo-atalho" para={rotaTriagemSvo(item.id)}>{item.statusTriagem==='AGUARDANDO_TRIAGEM'?'Realizar triagem':'Consultar triagem'}</Link> : 'Consulta indisponível'}</td></tr>)}
              {!remoto.data.data.length && <tr><td colSpan={4}>Nenhum registro encontrado para os filtros desta página.</td></tr>}</tbody>
          </table></div>
          <Paginacao meta={remoto.data.meta} mudar={page=>aplicar({...filtros,page})}/>
        </>}
    </Painel>
  </Pagina>
}

/** Lista todas as situações publicadas sem inventar elegibilidade ou datas ausentes. */
export function ListaOrdensIntegrada() {
  const [filtros,setFiltros]=useState<FiltrosOrdensSvo>(()=>({page:paginaInicial(),status:filtroInicial('status',estadosOrdem) as StatusOrdemSvo|undefined}))
  const load=useCallback((signal:AbortSignal)=>consultarOrdensSvo(filtros,signal),[filtros])
  const remoto=useRemoteData<ListaOrdensSvo|null>(load,null)
  function aplicar(proximo:FiltrosOrdensSvo) {setFiltros(proximo);atualizarUrl(proximo)}
  return <Pagina titulo="Ordens de Coleta" descricao="Ordens geradas após confirmação SVO">
    <Painel titulo="Consultar ordens">
      <div className="svo-filtros"><label>Status da ordem<select value={filtros.status||''} onChange={e=>aplicar({page:1,status:e.target.value as StatusOrdemSvo||undefined})}>
        <option value="">Todos os status</option>{Object.entries(estadosOrdem).map(([codigo,nome])=><option key={codigo} value={codigo}>{nome}</option>)}
      </select></label><div className="svo-acoes"><button onClick={()=>aplicar({page:1})}>Limpar filtro</button><button onClick={remoto.retry}>Atualizar ordens</button></div></div>
      {remoto.loading ? <p role="status">Carregando ordens…</p> : remoto.error ? <div className="svo-acoes"><p role="alert">{remoto.error}</p><button onClick={remoto.retry}>Tentar novamente</button></div>
        : remoto.data && <><div className="svo-tabela" tabIndex={0} role="region" aria-label="Ordens de coleta"><table><thead><tr><th>Ordem</th><th>Solicitação</th><th>Quantidade de corpos</th><th>Status</th></tr></thead>
          <tbody>{remoto.data.data.map(item=><tr key={item.id}><td>{/^[1-9]\d*$/.test(item.id) ? <Link className="svo-atalho" para={rotaOrdemSvo(item.id)}>{item.codigo}</Link> : item.codigo}</td><td>{/^[1-9]\d*$/.test(item.solicitacaoId) ? <Link className="svo-atalho" para={rotaSolicitacaoSvo(item.solicitacaoId)}>{item.solicitacaoCodigo}</Link> : item.solicitacaoCodigo}</td><td>{item.quantidadeCorpos ?? 'Não informada'}</td><td>{nomeStatusSvo(item.status,estadosOrdem)}</td></tr>)}
          {!remoto.data.data.length && <tr><td colSpan={4}>Nenhuma ordem encontrada para o filtro desta página.</td></tr>}</tbody></table></div>
          <Paginacao meta={remoto.data.meta} mudar={page=>aplicar({...filtros,page})}/></>}

    </Painel>
  </Pagina>
}

/** Recupera a triagem persistida; somente PATCH/POST explícitos alteram o atendimento. */
export function TriagemSvo({ id }: { id: string }) {
  const [destino, setDestino] = useState<'' | 'CONFIRMADA_SVO' | 'ENCAMINHADA_IML'>('')
  const [observacoes, setObservacoes] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [bloqueio, setBloqueio] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [resultado, setResultado] = useState<TriagemFinalSvoResponse | null>(null)
  const editada = useRef(false)
  const envio = useRef(false)
  const ativa = useRef(true)
  const dialog = useRef<HTMLDialogElement>(null)
  const [erroAcesso, setErroAcesso] = useState('')
  const [formularioPronto, setFormularioPronto] = useState(false)
  const limparOcorrencia = useCallback(() => {
    setObservacoes(''); setDestino(''); setQuantidade(''); setResultado(null)
    setFeedback(''); setErro(''); editada.current = false
    setFormularioPronto(false)
  }, [])
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const registro = await consultarSolicitacaoSvo(id, signal)
      if (!signal.aborted) setErroAcesso('')
      return registro
    } catch (error) {
      if (!signal.aborted && error instanceof ApiError && [403, 404].includes(error.status)) {
        limparOcorrencia()
        setErroAcesso(`Erro ${error.status}: ${error.message}`)
        // Resolve sem registro para descartar também os dados remotos anteriormente autorizados.
        return null
      }
      throw error
    }
  }, [id, limparOcorrencia])
  const remoto = useRemoteData<DetalheSolicitacaoSvo | null>(load, null)
  const item = remoto.loading || remoto.error || erroAcesso ? null : remoto.data
  useEffect(() => { ativa.current = true; return () => { ativa.current = false } }, [])
  useEffect(()=>{
    if(!item) return
    if(!(editada.current && item.statusTriagem==='AGUARDANDO_TRIAGEM')) {
      setObservacoes(item.triagemObservacoes ?? '')
      setDestino(item.statusTriagem==='CONFIRMADA_SVO'||item.statusTriagem==='ENCAMINHADA_IML' ? item.statusTriagem : '')
      setQuantidade(item.ordemColeta?.quantidadeCorpos?.toString() ?? '')
    }
    setFormularioPronto(true)
  },[item])
  const bloqueada = enviando || bloqueio || !formularioPronto || remoto.loading || !!remoto.error || !!erroAcesso || !item || item.statusTriagem !== 'AGUARDANDO_TRIAGEM' || !!resultado
  const notasValidas = observacoes.trim().length > 0 && observacoes.trim().length <= 2000
  const quantidadeValida = Number.isInteger(Number(quantidade)) && Number(quantidade) >= 1 && Number(quantidade) <= 4
  async function salvar(final: boolean) {
    if (envio.current || bloqueada || !notasValidas || (final && (!destino || (destino === 'CONFIRMADA_SVO' && !quantidadeValida)))) return
    envio.current = true; setEnviando(true); setErro(''); setFeedback('')
    try {
      if (final && destino) {
        const resposta = await finalizarTriagemSvo(id, destino === 'CONFIRMADA_SVO'
          ? {decisao: destino, triagemObservacoes: observacoes.trim(), quantidadeCorpos: Number(quantidade)}
          : {decisao: destino, triagemObservacoes: observacoes.trim()})
        if (!ativa.current) return
        setResultado(resposta)
        remoto.setData(registro => registro ? {...registro,statusTriagem:resposta.solicitacao.statusTriagem} : registro)
      } else {
        const resposta = await salvarTriagemSvo(id, {triagemObservacoes: observacoes.trim()})
        if (!ativa.current) return
        setObservacoes(resposta.triagemObservacoes)
        setFeedback('Andamento salvo pelo servidor. A solicitação continua aguardando triagem, sem ordem de coleta.')
      }
      editada.current=false
      remoto.retry()
    } catch (error) {
      if (!ativa.current) return
      const status = error instanceof ApiError ? error.status : 0
      if ([403,404].includes(status)) {
        limparOcorrencia()
        setErroAcesso(`Erro ${status}: ${error instanceof Error ? error.message : 'Consulta não autorizada.'}`)
        remoto.setData(null)
      }
      setErro(`${status ? `Erro ${status}: ` : ''}${error instanceof Error ? error.message : 'Não foi possível salvar a triagem.'}`)
      if ([403,404,409].includes(status)) { setBloqueio(true); remoto.retry() }
    } finally {
      envio.current = false
      if (ativa.current) { setEnviando(false); dialog.current?.close() }
    }
  }
  if (erroAcesso) return <Pagina titulo="Triagem">
    <p role="alert">{erroAcesso}</p>
    <button type="button" disabled={remoto.loading} onClick={()=>{setBloqueio(false);remoto.retry()}}>Tentar novamente</button>
  </Pagina>
  return <Pagina titulo="Triagem" descricao="Decisão SVO/IML vinculada ao protocolo consultado."
    acao={<Link className="svo-atalho" para={ROTAS.svoSolicitacoes}>Voltar às solicitações</Link>}>
    <p className="svo-aviso">Salvar andamento mantém a solicitação aguardando triagem. A decisão final é confirmada separadamente e somente SVO gera ordem de coleta.</p>
    {remoto.loading && <p role="status">Consultando o estado da solicitação…</p>}
    {remoto.error && <div className="svo-acoes"><p role="alert">{remoto.error}</p><button onClick={remoto.retry}>Tentar novamente</button></div>}
    {!remoto.loading && !remoto.error && !item && <p role="alert">Não foi possível recuperar o protocolo. Nenhuma decisão será enviada.</p>}
    {item && <Painel titulo="Identificação"><p>Protocolo: {item.codigo}</p><p>Status: {nomeStatusSvo(item.statusTriagem,estadosTriagem)}</p>
      <p>Recebimento: {dataCivilSvo(item.criadoEm)}</p>
      <dl className="svo-campos">{Object.entries({
        'Canal':item.canalAtendimento, 'Solicitante':item.solicitanteNome, 'Contato':item.solicitanteTelefone,
        'Parentesco':item.solicitanteParentesco, 'Pessoa falecida':item.nomeFalecido, 'Local do falecimento':item.localFalecimento,
        'Endereço de remoção':item.enderecoRemocao, 'Referência':item.pontoReferencia, 'Informações da ligação':item.observacoesMedicas,
      }).map(([nome,valor])=><div key={nome}><dt>{nome}</dt><dd>{valor || 'Não informado'}</dd></div>)}</dl>
      {item.triadoEm && <p>Decisão registrada em {dataCivilSvo(item.triadoEm)}</p>}
      {item.ordemColeta && <p>Ordem vinculada: <Link className="svo-atalho" para={rotaOrdemSvo(item.ordemColeta.id)}>{item.ordemColeta.codigo}</Link> · {nomeStatusSvo(item.ordemColeta.status,estadosOrdem)}</p>}
      {item.statusTriagem==='ENCAMINHADA_IML' && !item.ordemColeta && <p>Encaminhada ao IML, sem ordem de coleta SVO.</p>}
    </Painel>}
    {resultado && <p role="status">{resultado.ordemColeta ? `Confirmada SVO. Ordem ${resultado.ordemColeta.codigo} gerada pelo servidor, aguardando despacho.` : 'Encaminhada ao IML. Nenhuma ordem de coleta SVO foi criada.'}</p>}
    {(resultado?.ordemColeta || item?.ordemColeta) && <Link className="svo-atalho" para={ROTAS.svoOrdens}>Consultar ordens de coleta</Link>}
    {item && item.statusTriagem !== 'AGUARDANDO_TRIAGEM' && <p>Somente leitura. {item.statusTriagem==='CONFIRMADA_SVO'||item.statusTriagem==='ENCAMINHADA_IML' ? 'Decisões finais não podem ser alteradas nesta tela.' : 'O status recebido não permite decisão de triagem.'}</p>}
    <Painel titulo="Decisão da triagem">
      <fieldset className="svo-decisao" disabled={bloqueada}><legend>Destino</legend>
        <label><input type="radio" name="destino" checked={destino === 'CONFIRMADA_SVO'} onChange={() => {editada.current=true;setDestino('CONFIRMADA_SVO')}} />SVO</label>
        <label><input type="radio" name="destino" checked={destino === 'ENCAMINHADA_IML'} onChange={() => {editada.current=true;setDestino('ENCAMINHADA_IML')}} />IML</label>
      </fieldset>
      {destino === 'CONFIRMADA_SVO' && <label className="svo-campo">Quantidade de corpos (1 a 4)<input type="number" min={1} max={4} step={1} required disabled={bloqueada} value={quantidade} onChange={e => {editada.current=true;setQuantidade(e.target.value)}} /></label>}
      <label className="svo-campo">Observações da triagem<textarea rows={4} maxLength={2000} required readOnly={bloqueada} value={observacoes} onChange={e => {editada.current=true;setObservacoes(e.target.value)}} /></label>
      {enviando && <p role="status">Salvando triagem…</p>}{feedback && <p role="status">{feedback}</p>}{erro && <p role="alert">{erro}</p>}
      {bloqueio && <p>Atualize a lista e consulte o estado atual antes de continuar.</p>}
      <div className="svo-acoes"><button disabled={bloqueada || !notasValidas} onClick={() => void salvar(false)}>Salvar andamento</button>
        <button disabled={bloqueada || !notasValidas || !destino || (destino === 'CONFIRMADA_SVO' && !quantidadeValida)} onClick={() => dialog.current?.showModal()}>Concluir triagem</button></div>
      <dialog ref={dialog} className="svo-confirmacao" aria-labelledby="triagem-confirmacao" onCancel={e => { if (envio.current) e.preventDefault() }}>
        <h2 id="triagem-confirmacao">Confirmar decisão da triagem</h2><p>{destino === 'CONFIRMADA_SVO' ? `Confirmar SVO com ${quantidade} corpo(s) gera uma ordem de coleta.` : 'Encaminhar ao IML não gera ordem de coleta SVO.'} Esta decisão é definitiva.</p>
        <div className="svo-acoes"><button disabled={enviando} onClick={() => dialog.current?.close()}>Voltar à triagem</button>
          <button disabled={enviando} onClick={() => void salvar(true)}>{destino === 'CONFIRMADA_SVO' ? 'Confirmar SVO' : 'Encaminhar IML'}</button></div>
      </dialog>
    </Painel>
  </Pagina>
}
