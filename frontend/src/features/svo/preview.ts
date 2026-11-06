/** Destinos navegáveis da apresentação local. “exemplo” abre só a estrutura do detalhe. */
export const PREVIEW_SVO = {
  dashboard: '/svo-preview/dashboard',
  nova: '/svo-preview/nova-solicitacao',
  solicitacoes: '/svo-preview/solicitacoes',
  triagem: '/svo-preview/solicitacoes/exemplo/triagem',
  ordens: '/svo-preview/ordens',
  detalhe: '/svo-preview/ordens/exemplo',
  despacho: '/svo-preview/ordens/exemplo/despacho',
  equipe: '/svo-preview/equipe/minhas-ordens',
  execucao: '/svo-preview/equipe/ordens/exemplo/execucao',
} as const

export type TelaPreview = keyof typeof PREVIEW_SVO

/** Reconhece apenas os caminhos de preview, exclusivamente em desenvolvimento. */
export function telaPreviewSvo(caminho: string): TelaPreview | null {
  if (!import.meta.env.DEV) return null
  if (caminho === '/svo-preview') return 'nova'
  for (const [tela, url] of Object.entries(PREVIEW_SVO)) {
    if (url === caminho) return tela as TelaPreview
  }
  if (/^\/svo-preview\/solicitacoes\/[^/]+\/triagem$/.test(caminho)) return 'triagem'
  if (/^\/svo-preview\/ordens\/[^/]+\/despacho$/.test(caminho)) return 'despacho'
  if (/^\/svo-preview\/ordens\/[^/]+$/.test(caminho)) return 'detalhe'
  if (/^\/svo-preview\/equipe\/ordens\/[^/]+\/execucao$/.test(caminho)) return 'execucao'
  return null
}
