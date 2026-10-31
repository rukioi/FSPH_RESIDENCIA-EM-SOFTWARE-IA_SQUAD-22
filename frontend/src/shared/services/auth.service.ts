
import { ROTAS } from '../../app/routes/rotas'
import type { ApiSchemas } from '../api/generated/schema'
import { ApiError } from '../api/errors'
import { requestApi } from '../api/client'
import { authSchemas } from '../../../../backend/src/modules/auth/auth.schemas'

export type Credenciais = ApiSchemas['Credenciais']

// Modelo de apresentação: admite os rótulos históricos normalizados pelo adaptador.
export type UsuarioSessao = Pick<ApiSchemas['Sessao']['data'], 'id'> &
  Partial<Pick<ApiSchemas['Sessao']['data'], 'nome' | 'email'>> & { perfil: string }

export type ResultadoLogin = {
  destino: string
  usuario: UsuarioSessao
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const TOKEN_CHAVE = 'token'

function normalizarPerfil(perfil: string): string {
  const normalizado = perfil.trim().toUpperCase()

  if (normalizado === 'ADMINISTRADOR') return 'ADM'
  if (normalizado === 'GESTOR' || normalizado === 'GESTOR DA FROTA') {
    return 'GESTOR_FROTA'
  }

  return normalizado
}

export function destinoDoPerfil(perfil: string): string {
  switch (normalizarPerfil(perfil)) {
    case 'ADM':
      return ROTAS.dashboard
    case 'GESTOR_FROTA':
      return ROTAS.dashboardGestor
    case 'ATENDENTE_SVO':
      return '/svo'
    default:
      throw new Error('Este perfil não possui uma página inicial disponível.')
  }
}

function redirecionarParaLogin(): void {
  if (typeof window !== 'undefined' && window.location.pathname !== ROTAS.login) {
    window.location.replace(ROTAS.login)
  }
}

/** Adaptador legado de Bearer/401, reutilizado pelo cliente compartilhado sem duplicar estado da sessão. */
export async function fetchAutenticada(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = obterToken()

  if (!token) {
    sair()
    redirecionarParaLogin()
    throw new ApiError(401, 'NAO_AUTENTICADO', 'Sessão expirada. Faça login novamente.')
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)

  const resposta = await fetch(input, { ...init, headers })

  if (resposta.status === 401) {
    sair()
    redirecionarParaLogin()
  }

  return resposta
}

/** Valida o login público pelo transporte comum antes de persistir somente o token. */
export async function entrar(
  credenciais: Credenciais,
): Promise<ResultadoLogin> {
  const dados = await requestApi('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credenciais),
  }, value => authSchemas.Login.parse(value), false)

  if (!dados.token) throw new ApiError(200, 'RESPOSTA_INVALIDA', 'A resposta do servidor é inválida. Tente novamente.')

  const destino = destinoDoPerfil(dados.usuario.perfil)
  sessionStorage.setItem(TOKEN_CHAVE, dados.token)

  return {
    destino,
    usuario: dados.usuario,
  }
}

/** Confirma a sessão com validação runtime e normalização comum das falhas HTTP. */
export async function buscarSessao(): Promise<UsuarioSessao | null> {
  if (!obterToken()) return null

  let usuario
  try {
    const resultado = await requestApi('/api/auth/sessao', {}, value => authSchemas.Sessao.parse(value))
    usuario = resultado.data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }

  return {
    ...usuario,
    perfil: normalizarPerfil(usuario.perfil),
  }
}

export function obterToken(): string | null {
  return sessionStorage.getItem(TOKEN_CHAVE)
}

export function sair(): void {
  sessionStorage.removeItem(TOKEN_CHAVE)
}
