import { fetchAutenticada } from './auth.service'
import type { Perfil, Usuario } from '../../features/usuarios/dados'

const API_URL = '/api/admin/usuarios'

function converterUsuario(valor: unknown): Usuario {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Resposta de usuário inválida.');
  const usuario = valor as Record<string, unknown>
  if (typeof usuario.nome !== 'string' || typeof usuario.email !== 'string' ||
      typeof usuario.perfil !== 'string' || typeof usuario.ativo !== 'boolean' ||
      (typeof usuario.id !== 'number' && typeof usuario.id !== 'string') ||
      !Number.isSafeInteger(Number(usuario.id))) throw new Error('Resposta de usuário inválida.');
  const perfis: Record<string, Perfil> = {
    ADM: 'ADM',
    GESTOR_FROTA: 'Gestor da Frota',
    SOLICITANTE_INTERNO: 'Solicitante',
    MOTORISTA: 'Motorista',
    ATENDENTE_SVO: 'Atendente SVO',
  }

  const perfilNormalizado = perfis[usuario.perfil.toUpperCase()]

  if (!perfilNormalizado) {
    throw new Error(`Perfil não reconhecido: ${usuario.perfil}`)
  }

  return {
    nome: usuario.nome,
    email: usuario.email,
    ativo: usuario.ativo,
    id: Number(usuario.id),
    perfil: perfilNormalizado,
  }
}

function converterPerfilParaApi(perfil: Perfil): string {
  const perfis: Record<Perfil, string> = {
    ADM: 'ADM',
    'Gestor da Frota': 'GESTOR_FROTA',
    Solicitante: 'SOLICITANTE_INTERNO',
    Motorista: 'MOTORISTA',
    'Atendente SVO': 'ATENDENTE_SVO',
  }

  return perfis[perfil]
}

async function requisicao<T>(caminho: string): Promise<T> {
  const resposta = await fetchAutenticada(caminho)

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

/** Valida a lista recebida e traduz códigos persistidos para rótulos visuais. */
export async function listarUsuarios(): Promise<Usuario[]> {
  const dados = await requisicao<unknown>(API_URL)
  if (!Array.isArray(dados)) throw new Error('Lista de usuários inválida.');
  return dados.map(converterUsuario)
}

export type NovoUsuario = {
  nome: string
  email: string
  senha: string
  perfil: Perfil
}

/** Envia perfil persistido e retorna apenas os campos de apresentação confirmados. */
export async function cadastrarUsuario(
  usuario: NovoUsuario,
): Promise<Usuario> {
  const resposta = await fetchAutenticada(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  return converterUsuario(dados)
}

export type DadosEdicaoUsuario = {
  nome: string
  email: string
  perfil: Perfil
  senha?: string
}

/** Aplica na edição o mesmo mapeamento de perfil usado no cadastro. */
export async function editarUsuario(
  id: number,
  usuario: DadosEdicaoUsuario,
): Promise<Usuario> {
  const resposta = await fetchAutenticada(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...usuario, perfil: converterPerfilParaApi(usuario.perfil) }),
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

  return converterUsuario(dados)
}


/** Solicita um estado explícito; só devolve o usuário após confirmação da API. */
export async function alterarStatusUsuario(id: number, ativo: boolean): Promise<Usuario> {
  const resposta = await fetchAutenticada(`${API_URL}/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ativo }),
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
