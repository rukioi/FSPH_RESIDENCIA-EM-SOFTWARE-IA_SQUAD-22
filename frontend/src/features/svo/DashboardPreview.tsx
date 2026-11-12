import { useState } from 'react'
import { Atalho, Pagina, Painel } from './PreviewPainel'
import { PREVIEW_SVO } from './preview'

const indicadores = [
  { nome: 'Aguardando triagem', destino: PREVIEW_SVO.solicitacoes, icone: 'M5 3h14 M5 21h14 M7 3v4l5 5-5 5v4 M17 3v4l-5 5 5 5v4' },
  { nome: 'Confirmadas SVO', destino: PREVIEW_SVO.solicitacoes, icone: 'M12 2l8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5z M8 12l3 3 5-6' },
  { nome: 'Encaminhadas ao IML', destino: PREVIEW_SVO.solicitacoes, icone: 'M4 12h16 M14 6l6 6-6 6' },
  { nome: 'Aguardando despacho', destino: PREVIEW_SVO.ordens, icone: 'M5 3h14 M5 21h14 M7 3v4l5 5-5 5v4 M17 3v4l-5 5 5 5v4' },
  { nome: 'Ordens de coleta', destino: PREVIEW_SVO.ordens, icone: 'M8 4H5v17h14V4h-3 M9 3h6v3H9z M8 11h8 M8 15h8' },
  { nome: 'Prontas para iniciar', destino: PREVIEW_SVO.ordens, icone: 'M2 5h12v12H2z M14 9h4l4 5v3h-8 M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4' },
]

/** Mostra os períodos e destinos do painel sem gerar indicadores locais. */
export function DashboardPreview() {
  const [periodo, setPeriodo] = useState('Hoje')
  return <Pagina titulo="Dashboard SVO" descricao="Visão geral dos atendimentos" acao={
    <div className="svo-acoes">
      <div className="svo-periodos" role="group" aria-label="Período">
        {['Hoje', '7 dias', '30 dias'].map(valor => <button type="button" key={valor}
          aria-pressed={periodo === valor} onClick={() => setPeriodo(valor)}>{valor}</button>)}
      </div>
      <Atalho href={PREVIEW_SVO.nova} primario>+ Nova solicitação</Atalho>
    </div>
  }>
    <p className="svo-aviso">Indicadores indisponíveis. A consulta por período depende da integração com o backend; selecionar um período nesta prévia não consulta dados.</p>
    <div className="svo-indicadores">{indicadores.map(({ nome, destino, icone }) =>
      <a key={nome} href={destino}><svg aria-hidden="true" viewBox="0 0 24 24"><path d={icone}/></svg>
        <div><h2>{nome}</h2><strong aria-hidden="true">—</strong><p>Dados indisponíveis no momento</p>
          <small>{nome === 'Aguardando triagem' ? 'Fila atual · independente do período'
            : nome === 'Aguardando despacho' || nome === 'Prontas para iniciar' ? 'Fila atual' : `Período: ${periodo}`}</small></div></a>)}</div>
    <div className="svo-dupla">
      <Painel titulo="Visão geral dos atendimentos"><small>{periodo}</small>
        <div className="svo-resumo-grafico"><span className="svo-anel" aria-hidden="true">—</span>
          <div><p>Dados indisponíveis no momento</p><small>Aguardando triagem · Confirmadas SVO · Encaminhadas ao IML</small></div></div>
      </Painel>
      <Painel titulo="Atividade recente"><p>Histórico de atividades indisponível no momento.</p></Painel>
      <Painel titulo="Aguardando despacho"><p>Consulta de ordens indisponível.</p><Atalho href={PREVIEW_SVO.ordens}>Ver ordens de coleta</Atalho></Painel>
      <Painel titulo="Ordens de coleta recentes"><p>Dados indisponíveis no momento.</p><Atalho href={PREVIEW_SVO.ordens}>Ver todas</Atalho></Painel>
    </div>
  </Pagina>
}
