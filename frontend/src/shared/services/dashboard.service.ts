import type {
  DashboardKpisResponse,
  DashboardPeriodo,
} from '../types/dashboard'
import { fetchAutenticada } from './auth.service'

export async function buscarDashboardKpis(
  periodo: DashboardPeriodo,
): Promise<DashboardKpisResponse> {
  const response = await fetchAutenticada(`/api/dashboard/kpis?periodo=${periodo}`, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(
      `Não foi possível carregar os indicadores. Status: ${response.status}`,
    )
  }

  return response.json()
}