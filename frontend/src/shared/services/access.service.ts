import { ROTAS } from '../../app/routes/rotas'

const perfisPorRota: Record<string, string[]> = {
  [ROTAS.dashboard]: ['ADM'],
  [ROTAS.configuracoes]: ['ADM'],
  [ROTAS.auditoria]: ['ADM'],
  [ROTAS.dashboardGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.veiculosGestor]: ['ADM', 'GESTOR_FROTA'],
  [ROTAS.motoristasGestor]: ['ADM', 'GESTOR_FROTA'],
  '/svo': ['ATENDENTE_SVO'],
}

export function perfilPodeAcessar(caminho: string, perfil: string): boolean {
  return perfisPorRota[caminho]?.includes(perfil) ?? false
}