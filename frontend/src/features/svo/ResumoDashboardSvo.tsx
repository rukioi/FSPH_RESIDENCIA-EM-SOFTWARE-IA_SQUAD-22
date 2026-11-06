import { useCallback, useState } from 'react'
import { Link } from '../../app/routes/router'
import { ROTAS, rotaTriagemSvo } from '../../app/routes/rotas'
import { useRemoteData } from '../../shared/api/useRemoteData'
import { consultarAtividadesSvo, consultarDashboardSvo, consultarFilasSvo } from '../../shared/services/svo.service'
import type { AtividadesRecentesSvo, DashboardOperacionalSvo, FilasOperacionaisSvo, PeriodoDashboardSvo } from '../../shared/types/svo'
import { GraficoAtendimentos } from './GraficoAtendimentos'
import { AtividadeRecente } from './AtividadeRecente'
import { dataCivilSvo } from './apresentacaoSvo'

const periodos: Record<PeriodoDashboardSvo,string>={hoje:'Hoje','7d':'7 dias','30d':'30 dias'}
const cards=[
  {chave:'aguardandoTriagem',nome:'Aguardando triagem',nota:'Fila atual, todas as datas',url:ROTAS.svoSolicitacoes+'?status=AGUARDANDO_TRIAGEM'},
  {chave:'confirmadasSvo',nome:'Confirmadas SVO',nota:'Decisões no período',url:ROTAS.svoSolicitacoes+'?status=CONFIRMADA_SVO'},
  {chave:'encaminhadasIml',nome:'Encaminhadas ao IML',nota:'Decisões no período',url:ROTAS.svoSolicitacoes+'?status=ENCAMINHADA_IML'},
  {chave:'ordensColeta',nome:'Ordens de coleta',nota:'Geradas por confirmação no período',url:ROTAS.svoOrdens},
] as const

/** Consulta três fontes independentes; falha nunca é convertida em contagem zero. */
export function ResumoDashboardSvo({revisao}:{revisao:number}) {
  const [periodo,setPeriodo]=useState<PeriodoDashboardSvo>(()=>{
    const valor=typeof window==='undefined' ? null : new URLSearchParams(window.location.search).get('periodo')
    return valor && Object.hasOwn(periodos,valor) ? valor as PeriodoDashboardSvo : 'hoje'
  })
  const carregarIndicadores=useCallback((signal:AbortSignal)=>consultarDashboardSvo(periodo,signal),[periodo,revisao])
  const carregarFilas=useCallback((signal:AbortSignal)=>consultarFilasSvo(signal),[revisao])
  const carregarAtividades=useCallback((signal:AbortSignal)=>consultarAtividadesSvo(signal),[revisao])
  const indicadores=useRemoteData<DashboardOperacionalSvo|null>(carregarIndicadores,null)
  const filas=useRemoteData<FilasOperacionaisSvo|null>(carregarFilas,null)
  const atividades=useRemoteData<AtividadesRecentesSvo|null>(carregarAtividades,null)
  const dados=!indicadores.loading && !indicadores.error && indicadores.data?.periodo===periodo ? indicadores.data : null
  const filaAtual=!filas.loading && !filas.error ? filas.data : null
  function selecionar(valor:PeriodoDashboardSvo) {
    setPeriodo(valor)
    const query=new URLSearchParams(window.location.search);query.set('periodo',valor)
    window.history.replaceState(null,'',window.location.pathname+'?'+query)
  }
  return <>
    <div className="svo-acoes svo-dashboard__periodos" role="group" aria-label="Período dos indicadores">
      {Object.entries(periodos).map(([valor,nome])=><button key={valor} aria-pressed={periodo===valor} onClick={()=>selecionar(valor as PeriodoDashboardSvo)}>{nome}</button>)}
      <button onClick={()=>{indicadores.retry();filas.retry();atividades.retry()}}>Atualizar dashboard</button>
    </div>
    <p className="svo-dashboard__periodo-descricao">{dados ? `Período: ${dataCivilSvo(dados.inicio)} a ${dataCivilSvo(dados.fim)}.` : 'Aguardando indicadores do servidor.'} As filas atuais não são limitadas pelo período.</p>
    {indicadores.loading && <p role="status">Carregando indicadores…</p>}
    {indicadores.error && <div className="svo-acoes"><p role="alert">Indicadores indisponíveis. {indicadores.error}</p><button onClick={indicadores.retry}>Tentar indicadores novamente</button></div>}
    <div className="svo-dashboard__kpis">{cards.map(card=><article className="svo-dashboard__card" key={card.chave}>
      <Link para={card.url}><span>{card.nome}</span></Link>
      <strong aria-hidden={!dados || undefined}>{dados ? dados.indicadores[card.chave] : '—'}</strong>
      <small>{dados ? card.nota : indicadores.loading ? 'Carregando indicador' : 'Indicador indisponível'}</small>
    </article>)}</div>
    <div className="svo-dashboard__resumo">
      <GraficoAtendimentos dados={dados?.visaoGeral ?? null} carregando={indicadores.loading}/>
      <AtividadeRecente dados={!atividades.loading && !atividades.error ? atividades.data : null} carregando={atividades.loading} erro={atividades.error} tentar={atividades.retry}/>
    </div>
    <section className="svo-dashboard__filas" aria-labelledby="svo-filas-titulo">
      <h2 id="svo-filas-titulo">Filas atuais</h2>
      {filas.loading && <p role="status">Carregando filas…</p>}
      {filas.error && <div className="svo-acoes"><p role="alert">Filas indisponíveis. {filas.error}</p><button onClick={filas.retry}>Tentar filas novamente</button></div>}
      {filaAtual && <div className="svo-dupla">
        <div><h3>Aguardando triagem: {filaAtual.aguardandoTriagem.total}</h3>
          {!filaAtual.aguardandoTriagem.itens.length ? <p>Nenhuma solicitação aguardando triagem.</p> : <ul>{filaAtual.aguardandoTriagem.itens.map(item=><li key={item.id}>
            <Link className="svo-atalho" para={rotaTriagemSvo(item.id)}>{item.codigo}</Link> <span>{dataCivilSvo(item.criadoEm)}</span>
          </li>)}</ul>}
          <Link className="svo-atalho" para={ROTAS.svoSolicitacoes+'?status=AGUARDANDO_TRIAGEM'}>Consultar fila de triagem</Link>
        </div>
        <div><h3>Aguardando despacho: {filaAtual.aguardandoDespacho.total}</h3>
          {!filaAtual.aguardandoDespacho.itens.length ? <p>Fila de despacho vazia.</p> : <ul>{filaAtual.aguardandoDespacho.itens.map(item=><li key={item.id}>
            <span>{item.codigo} · {item.solicitacaoCodigo} · Corpos: {item.quantidadeCorpos ?? 'não informado'}</span>
          </li>)}</ul>}
          <Link className="svo-atalho" para={ROTAS.svoOrdens+'?status=PENDENTE_ALOCACAO'}>Consultar fila de despacho</Link>
        </div>
      </div>}
      <p>São exibidos até 10 itens por fila. Os totais vêm do servidor.</p>
    </section>
  </>
}
