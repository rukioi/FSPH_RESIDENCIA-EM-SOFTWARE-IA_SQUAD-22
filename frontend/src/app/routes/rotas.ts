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
} as const

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
  return { id: decodeURIComponent(partes[0]), editar: partes[1] === 'editar' }
}
