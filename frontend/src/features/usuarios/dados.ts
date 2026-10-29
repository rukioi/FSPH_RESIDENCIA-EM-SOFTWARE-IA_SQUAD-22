export const PERFIS = ['ADM', 'Gestor da Frota', 'Solicitante', 'Motorista', 'Atendente SVO'] as const
export type Perfil = (typeof PERFIS)[number]

export type Usuario = {
  id: number
  nome: string
  email: string
  perfil: Perfil
  ativo: boolean
}

export const corPerfil: Record<Perfil, string> = {
  ADM: 'badge--amarelo',
  'Gestor da Frota': 'badge--marinho',
  Solicitante: 'badge--azul',
  Motorista: 'badge--verde',
  'Atendente SVO': 'badge--cinza',
}

const nomes: [string, Perfil, boolean][] = [
  ['Marina Costa', 'ADM', true],
  ['Carlos Almeida', 'Gestor da Frota', true],
  ['Juliana Ribeiro', 'Solicitante', true],
  ['Rafael Moura', 'Motorista', true],
  ['Patrícia Nunes', 'Atendente SVO', true],
  ['Eduardo Lima', 'Motorista', false],
  ['Fernanda Rocha', 'Solicitante', true],
  ['Gustavo Pereira', 'Gestor da Frota', true],
  ['Helena Duarte', 'Solicitante', false],
  ['Igor Santana', 'Motorista', true],
  ['Larissa Teixeira', 'Atendente SVO', true],
  ['Marcos Vieira', 'Motorista', true],
  ['Natália Freitas', 'Solicitante', true],
  ['Otávio Barros', 'Motorista', false],
  ['Priscila Gomes', 'Solicitante', true],
  ['Renato Cardoso', 'Atendente SVO', true],
  ['Sabrina Lopes', 'Solicitante', true],
  ['Thiago Martins', 'Motorista', true],
]

function emailDe(nome: string) {
  return (
    nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(' ', '.') + '@frota.gov.br'
  )
}

export const usuariosIniciais: Usuario[] = nomes.map(([nome, perfil, ativo], i) => ({
  id: i + 1,
  nome,
  email: emailDe(nome),
  perfil,
  ativo,
}))
