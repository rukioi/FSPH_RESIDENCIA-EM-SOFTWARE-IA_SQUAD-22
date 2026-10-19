export type DashboardPeriodo = 'hoje' | '7dias' | '30dias'

export interface DashboardKpis {
  chamadosPendentes: number
  viagensHoje: number
  veiculosDisponiveis: number
  motoristasDisponiveis: number
}

export interface DashboardKpisResponse {
  data: DashboardKpis
}