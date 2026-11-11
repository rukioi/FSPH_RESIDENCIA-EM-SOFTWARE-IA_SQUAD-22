// Tipos e regras de negócio das solicitações (sem dependência de tela).

export type StatusSolicitacao =
  | 'Pendente'
  | 'Aprovada'
  | 'Recusada'
  | 'Agendada'
  | 'Em andamento'
  | 'Concluída'
  | 'Cancelada'
  | 'Não informado'

export const STATUS: StatusSolicitacao[] = [
  'Pendente',
  'Aprovada',
  'Recusada',
  'Agendada',
  'Em andamento',
  'Concluída',
  'Cancelada',
]

export type PerfilTela = 'gestor' | 'solicitante'

export type Comentario = {
  id: string
  autor: string
  cargo: string
  data: string // dd/mm/aaaa hh:mm
  texto: string
}

export type Solicitacao = {
  id: string // TRP-1024
  solicitante: string
  instituicao: string
  data: string // aaaa-mm-dd
  horario: string // hh:mm
  origem: string
  destino: string
  passageiros: number
  finalidade: string
  observacao: string
  documentos: string
  status: StatusSolicitacao
  criadaEm: string // dd/mm/aaaa hh:mm
  motorista?: string
  veiculo?: string
  comentarios: Comentario[]
}

/** Campos que o formulário (nova/edição) manipula. */
export type ValoresFormulario = {
  instituicao: string
  solicitante: string
  data: string
  horario: string
  origem: string
  destino: string
  passageiros: string
  finalidade: string
  observacao: string
  documentos: string
}

export type ErrosFormulario = Partial<Record<keyof ValoresFormulario, string>>

// ---------- Timeline ----------
export const ETAPAS = ['Solicitada', 'Aprovada', 'Agendada', 'Em andamento', 'Concluída'] as const

/** Índice (0–4) da última etapa alcançada. Recusada/Cancelada param em "Solicitada". */
export function etapaAlcancada(status: StatusSolicitacao): number {
  switch (status) {
    case 'Aprovada':
      return 1
    case 'Agendada':
      return 2
    case 'Em andamento':
      return 3
    case 'Concluída':
      return 4
    default:
      return 0
  }
}

export function fluxoInterrompido(status: StatusSolicitacao) {
  return status === 'Recusada' || status === 'Cancelada'
}

// ---------- Permissões por perfil e status ----------
export function podeEditar(perfil: PerfilTela, status: StatusSolicitacao) {
  if (perfil === 'solicitante') return false
  return status === 'Pendente' || status === 'Aprovada'
}

export function podeCancelar(perfil: PerfilTela, status: StatusSolicitacao) {
  if (perfil === 'solicitante') return status === 'Pendente' || status === 'Aprovada'
  return status === 'Pendente' || status === 'Aprovada' || status === 'Agendada'
}

export function podeAnalisar(perfil: PerfilTela, status: StatusSolicitacao) {
  return perfil === 'gestor' && status === 'Pendente'
}

// ---------- Validação local ----------
export function validarSolicitacao(v: ValoresFormulario): ErrosFormulario {
  const erros: ErrosFormulario = {}
  if (!v.data) erros.data = 'Informe a data.'
  if (!v.horario) erros.horario = 'Informe o horário.'
  if (!v.origem.trim()) erros.origem = 'Informe a origem.'
  if (!v.destino.trim()) erros.destino = 'Informe o destino.'
  else if (v.destino.trim().toLowerCase() === v.origem.trim().toLowerCase())
    erros.destino = 'O destino deve ser diferente da origem.'
  const qtd = Number(v.passageiros)
  if (!v.passageiros) erros.passageiros = 'Informe a quantidade.'
  else if (!Number.isInteger(qtd) || qtd < 1 || qtd > 50)
    erros.passageiros = 'Use um número entre 1 e 50.'
  if (!v.finalidade.trim()) erros.finalidade = 'Descreva a finalidade.'
  return erros
}

// ---------- Utilidades de exibição ----------
export function formatarData(iso: string) {
  const [a, m, d] = iso.split('-')
  return a && m && d ? `${d}/${m}/${a}` : iso
}

export function paraFormulario(s: Solicitacao): ValoresFormulario {
  return {
    instituicao: s.instituicao,
    solicitante: s.solicitante,
    data: s.data,
    horario: s.horario,
    origem: s.origem,
    destino: s.destino,
    passageiros: String(s.passageiros),
    finalidade: s.finalidade,
    observacao: s.observacao,
    documentos: s.documentos,
  }
}
