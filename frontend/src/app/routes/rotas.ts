export const ROTAS = {
  login: '/login',

  // Administrador
  dashboard: '/admin/dashboard',
  configuracoes: '/admin/configuracoes',
  auditoria: '/admin/auditoria',

  // Gestor de Frota
  dashboardGestor: '/gestor/dashboard',
  veiculosGestor: '/gestor/veiculos',
  motoristasGestor: '/gestor/motoristas',

  solicitacoesGestor: '/gestor/solicitacoes',
  calendarioGestor: '/gestor/calendario',

  // Solicitante
  novaSolicitacao: '/solicitante/nova-solicitacao',
  minhasSolicitacoes: '/solicitante/minhas-solicitacoes',

  // SVO
  svoRaiz: '/svo',
  svoDashboard: '/svo/dashboard',
  svoSolicitacoes: '/svo/solicitacoes',
  svoNovaSolicitacao: '/svo/solicitacoes/nova',
  svoOrdens: '/svo/ordens',
  svoMinhasOrdens: '/svo/equipe/minhas-ordens',
} as const

export function rotaTriagemSvo(id: string | number): string {
  return `/svo/solicitacoes/${encodeURIComponent(String(id))}/triagem`
}

export function rotaOrdemSvo(id: string | number): string {
  return `/svo/ordens/${encodeURIComponent(String(id))}`
}

export function rotaExecucaoOrdemSvo(id: string | number): string {
  return `/svo/equipe/ordens/${encodeURIComponent(String(id))}/execucao`
}

export function rotaSolicitacaoSvo(id: string): string {
  return `/svo/solicitacoes/${encodeURIComponent(id)}`;
}

/** Os mesmos padrões identificam a página e o perfil permitido antes de montá-la. */
export function lerDetalheSvo(caminho: string) {
  const solicitacao = /^\/svo\/solicitacoes\/([1-9]\d*)(?:\/(triagem|historico))?$/.exec(caminho);
  if (solicitacao) return { id: solicitacao[1], tela: solicitacao[2] === 'triagem' ? 'triagem' as const : 'solicitacao' as const };
  const ordem = /^\/svo\/ordens\/([1-9]\d*)$/.exec(caminho);
  if (ordem) return { id: ordem[1], tela: 'ordem' as const };
  const equipe = /^\/svo\/equipe\/ordens\/([1-9]\d*)\/execucao$/.exec(caminho);
  return equipe ? { id: equipe[1], tela: 'execucao' as const } : null;
}

/** Monta "/base/:id" ou "/base/:id/editar". */
export function rotaSolicitacao(base: string, id: string, editar = false) {
  return `${base}/${encodeURIComponent(id)}${editar ? '/editar' : ''}`
}

/**
 * Lê caminhos com parâmetro, ex.: "/gestor/solicitacoes/TRP-1024/editar".
 * Retorna null quando o caminho não começa com a base informada.
 */
export function lerRotaSolicitacao(caminho: string, base: string) {
  if (!caminho.startsWith(base + '/')) return null
  const partes = caminho.slice(base.length + 1).split('/').filter(Boolean)
  if (partes.length === 0 || partes.length > 2) return null
  if (partes.length === 2 && partes[1] !== 'editar') return null
  let id: string
  try {
    id = decodeURIComponent(partes[0])
  } catch {
    return null
  }
  return { id, editar: partes[1] === 'editar' }
}
