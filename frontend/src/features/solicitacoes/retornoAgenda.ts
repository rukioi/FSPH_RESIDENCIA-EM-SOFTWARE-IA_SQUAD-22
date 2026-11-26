import { navegar } from '../../app/routes/router'
import { ROTAS } from '../../app/routes/rotas'

export type RetornoAgenda = {
  caminho: typeof ROTAS.calendarioGestor
  selecionado: string
  visao: 'mes' | 'semana' | 'dia'
  mostrarFinsDeSemana: boolean
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Contexto de navegação da aba atual; não contém dados operacionais ou credenciais. */
export function lerRetornoAgenda(): RetornoAgenda | null {
  if (typeof window === 'undefined') return null
  const estado: unknown = window.history.state
  if (!objeto(estado)) return null
  const retorno = estado['retornoAgenda']
  if (!objeto(retorno)) return null
  const caminho = retorno['caminho']
  const selecionado = retorno['selecionado']
  const visao = retorno['visao']
  const mostrarFinsDeSemana = retorno['mostrarFinsDeSemana']
  if (caminho !== ROTAS.calendarioGestor || typeof selecionado !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/.test(selecionado)
    || !Number.isFinite(Date.parse(`${selecionado}T00:00:00-03:00`))
    || (visao !== 'mes' && visao !== 'semana' && visao !== 'dia')
    || typeof mostrarFinsDeSemana !== 'boolean') return null
  return { caminho, selecionado, visao, mostrarFinsDeSemana }
}

/** Mantém o período da agenda na entrada atual para refresh e voltar/avançar. */
export function guardarRetornoAgenda(retorno: RetornoAgenda) {
  const estado: unknown = window.history.state
  window.history.replaceState({ ...(objeto(estado) ? estado : {}), retornoAgenda: retorno }, '')
}

/** Continua usando o roteador existente, incluindo os aliases ADM já aplicados. */
export function navegarComRetornoAgenda(destino: string, retorno: RetornoAgenda | null) {
  if (retorno) guardarRetornoAgenda(retorno)
  navegar(destino)
  if (retorno) guardarRetornoAgenda(retorno)
}
