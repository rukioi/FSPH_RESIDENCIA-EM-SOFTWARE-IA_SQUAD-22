import type {
  DashboardKpisResponse,
  DashboardPeriodo,
} from '../types/dashboard'

export async function buscarDashboardKpis(
  periodo: DashboardPeriodo,
  token: string,
): Promise<DashboardKpisResponse> {
  const response = await fetch(`/api/dashboard/kpis?periodo=${periodo}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar os indicadores. Status: ${response.status}`,
    )
  }

  return response.json()
}