import { useCaminho } from '../../app/routes/router'
import { SvoLayout } from '../../layouts/svo/SvoLayout'
import { NovaSolicitacaoPreview } from './NovaSolicitacaoPreview'
import { ListaPreview, SolicitacoesSvo } from './SolicitacoesSvo'
import { DashboardPreview } from './DashboardPreview'
import { DespachoPreview, ExecucaoPreview, OrdemPreview, TriagemPreview } from './DetalhesPreview'
import { PREVIEW_SVO, telaPreviewSvo } from './preview'
import './PreviewSvo.css'

/** Renderiza apenas telas locais, sem montar o dashboard ou os serviços autenticados. */
export function PreviewSvo() {
  const caminho = useCaminho()
  const tela = telaPreviewSvo(caminho)
  if (!tela) return null
  const telas = {
    dashboard: <DashboardPreview/>, nova: <NovaSolicitacaoPreview onVoltar={() => window.location.assign(PREVIEW_SVO.solicitacoes)}/>,
    solicitacoes: <SolicitacoesSvo/>, triagem: <TriagemPreview/>, ordens: <ListaPreview tipo="ordens"/>,
    detalhe: <OrdemPreview/>, despacho: <DespachoPreview/>, equipe: <ListaPreview tipo="equipe"/>, execucao: <ExecucaoPreview/>,
  }
  return <SvoLayout><div key={caminho}>{telas[tela]}</div></SvoLayout>
}
