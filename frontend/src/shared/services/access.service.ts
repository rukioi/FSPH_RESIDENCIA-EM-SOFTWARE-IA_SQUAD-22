import { ROTAS, lerRotaSolicitacao } from '../../app/routes/rotas'

const perfisPorRota: Record<string, string[]> = {
  [ROTAS.dashboard]: ['ADM'],
  [ROTAS.configuracoes]: ['ADM'],
  [ROTAS.auditoria]: ['ADM'],
  [ROTAS.dashboardGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.veiculosGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.motoristasGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.solicitacoesGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.calendarioGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.novaSolicitacao]: ['SOLICITANTE_INTERNO'],
  [ROTAS.minhasSolicitacoes]: ['SOLICITANTE_INTERNO'],
  '/svo': ['ATENDENTE_SVO'],
}

/** Autoriza as telas conhecidas e os detalhes e edição de solicitações do Gestor. */
export function perfilPodeAcessar(caminho: string, perfil: string): boolean {
  const solicitacao = lerRotaSolicitacao(caminho, ROTAS.solicitacoesGestor)
  if (solicitacao && /^[0-9]+$/.test(solicitacao.id)) {
    return perfisPorRota[ROTAS.solicitacoesGestor].includes(perfil)
  }
  return perfisPorRota[caminho]?.includes(perfil) ?? false
}
