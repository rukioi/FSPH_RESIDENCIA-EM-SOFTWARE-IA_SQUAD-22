import { obterToken } from './auth.service'
import type { Perfil, Usuario } from '../../features/usuarios/dados'

const API_URL = '/api/admin/usuarios'

type UsuarioApi = {
  id: number | string
  nome: string
  email: string
  perfil: string
  ativo: boolean
}

function converterUsuario(usuario: UsuarioApi): Usuario {
  const perfis: Record<string, Perfil> = {
    ADM: 'ADM',
    GESTOR_FROTA: 'Gestor da Frota',
    SOLICITANTE: 'Solicitante',
    MOTORISTA: 'Motorista',
    ATENDENTE_SVO: 'Atendente SVO',
  }

  const perfilNormalizado = perfis[usuario.perfil.toUpperCase()]

  if (!perfilNormalizado) {
    throw new Error(`Perfil não reconhecido: ${usuario.perfil}`)
  }

  return {
    ...usuario,
    id: Number(usuario.id),
    perfil: perfilNormalizado,
  }
}

function converterPerfilParaApi(perfil: Perfil): string {
  const perfis: Record<Perfil, string> = {
    ADM: 'ADM',
    'Gestor da Frota': 'GESTOR_FROTA',
    Solicitante: 'SOLICITANTE',
    Motorista: 'MOTORISTA',
    'Atendente SVO': 'ATENDENTE_SVO',
  }

  return perfis[perfil]
}

async function requisicao<T>(caminho: string): Promise<T> {
  const token = obterToken()

  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  const resposta = await fetch(caminho, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const dados = await resposta.json()

  if (!resposta.ok) {
    const mensagem =
      dados?.error?.message ??
      dados?.error ??
      'Não foi possível consultar os usuários.'

    throw new Error(
      typeof mensagem === 'string'
        ? mensagem
        : 'Não foi possível consultar os usuários.',
    )
  }

  return dados as T
}

export async function listarUsuarios(): Promise<Usuario[]> {
  const dados = await requisicao<UsuarioApi[]>(API_URL)
  return dados.map(converterUsuario)
}

export type NovoUsuario = {
  nome: string
  email: string
  senha: string
  perfil: Perfil
}

export async function cadastrarUsuario(
  usuario: NovoUsuario,
): Promise<Usuario> {
  const token = obterToken()

  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  const resposta = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
        ...usuario,
        perfil: converterPerfilParaApi(usuario.perfil),
    }),
  })

  const dados = await resposta.json()

  if (!resposta.ok) {
    const mensagem =
      dados?.error?.message ??
      dados?.error ??
      'Não foi possível cadastrar o usuário.'

    throw new Error(
      typeof mensagem === 'string'
        ? mensagem
        : 'Não foi possível cadastrar o usuário.',
    )
  }

  return converterUsuario(dados as UsuarioApi)
}

export type DadosEdicaoUsuario = {
  nome: string
  email: string
  perfil: Perfil
  senha?: string
}

export async function editarUsuario(
  id: number,
  usuario: DadosEdicaoUsuario,
): Promise<Usuario> {
  const token = obterToken()

  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  const resposta = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(usuario),
  })

  const dados = await resposta.json()

  if (!resposta.ok) {
    const mensagem =
      dados?.error?.message ??
      dados?.error ??
      'Não foi possível editar o usuário.'

    throw new Error(
      typeof mensagem === 'string'
        ? mensagem
        : 'Não foi possível editar o usuário.',
    )
  }

  return converterUsuario(dados as UsuarioApi)
}


export async function alternarStatusUsuario(id: number): Promise<Usuario> {
  const token = obterToken()

  if (!token) {
    throw new Error('Sessão expirada. Faça login novamente.')
  }

  const resposta = await fetch(`${API_URL}/${id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const dados = await resposta.json()

  if (!resposta.ok) {
    const mensagem =
      dados?.error?.message ??
      dados?.error ??
      'Não foi possível alterar o status do usuário.'

    throw new Error(
      typeof mensagem === 'string'
        ? mensagem
        : 'Não foi possível alterar o status do usuário.',
    )
  }

  return converterUsuario(dados)
}
