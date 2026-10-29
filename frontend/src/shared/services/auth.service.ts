
export type Credenciais = {
  email: string
  senha: string
}

export type UsuarioAutenticado = {
  id: string
  nome: string
  email: string
  perfil: string
}

type RespostaLogin = {
  token: string
  usuario: UsuarioAutenticado
}

export type ResultadoLogin = {
  destino: string
  usuario: UsuarioAutenticado
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const TOKEN_CHAVE = 'token'
const USUARIO_CHAVE = 'usuario'

function obterDestino(perfil: string): string {
  switch (perfil.toUpperCase()) {
    case 'ADM':
      return '/admin/dashboard'

    case 'GESTOR':
    case 'GESTOR_FROTA':
    case 'GESTOR DA FROTA':
      return '/gestor/dashboard'

    default:
      throw new Error(
        `O perfil "${perfil}" ainda não possui uma tela inicial configurada.`,
      )
  }
}

export async function entrar(
  credenciais: Credenciais,
): Promise<ResultadoLogin> {
  const resposta = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credenciais),
  })

  const dados = (await resposta.json()) as
    | RespostaLogin
    | { error?: string }

  if (!resposta.ok) {
    const mensagem =
      'error' in dados && dados.error
        ? dados.error
        : 'Não foi possível realizar o login.'

    throw new Error(mensagem)
  }

  if (!('token' in dados) || !dados.token || !('usuario' in dados)) {
    throw new Error('A resposta da API de login está incompleta.')
  }

  const destino = obterDestino(dados.usuario.perfil)

  // Guarda os dados apenas durante a sessão da aba do navegador.
  sessionStorage.setItem(TOKEN_CHAVE, dados.token)
  sessionStorage.setItem(USUARIO_CHAVE, JSON.stringify(dados.usuario))

  return {
    destino,
    usuario: dados.usuario,
  }
}

export function obterToken(): string | null {
  return sessionStorage.getItem(TOKEN_CHAVE)
}

export function obterUsuario(): UsuarioAutenticado | null {
  const dados = sessionStorage.getItem(USUARIO_CHAVE)

  if (!dados) return null

  try {
    return JSON.parse(dados) as UsuarioAutenticado
  } catch {
    sessionStorage.removeItem(USUARIO_CHAVE)
    return null
  }
}

export function sair(): void {
  sessionStorage.removeItem(TOKEN_CHAVE)
  sessionStorage.removeItem(USUARIO_CHAVE)
}
