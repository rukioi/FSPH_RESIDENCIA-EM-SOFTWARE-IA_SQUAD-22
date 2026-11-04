import { requestApi } from '../api/client'
import { auditoriaSchemas } from '../../../../backend/src/modules/auditoria/auditoria.schemas'

export type AtividadeAuditoria = {
  id: string
  usuarioId: string | null
  descricao: string
  dataHora: string | null
  usuarioNome: string | null
}

export type PaginaAuditoria = {
  data: AtividadeAuditoria[]
  meta: {
    page: number
    limit: number
    total: number
  }
}

/**
 * Consulta uma página de atividades da auditoria.
 * A autenticação é feita pelo cliente HTTP compartilhado.
 */
export async function listarAtividades(
  page: number,
  limit = 20,
): Promise<PaginaAuditoria> {
  const resposta = await requestApi(
    `/api/admin/auditoria/logs?page=${page}&limit=${limit}`,
    {},
    value => auditoriaSchemas.Auditoria.parse(value),
  )

  if (Array.isArray(resposta)) {
    throw new Error('A resposta da auditoria não está no formato paginado esperado.')
  }

  return resposta as PaginaAuditoria
}