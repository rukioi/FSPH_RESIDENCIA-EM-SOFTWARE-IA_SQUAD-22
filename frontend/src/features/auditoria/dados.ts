// Logs fictícios. Não incluem senhas, tokens ou outros segredos.
export const TIPOS_EVENTO = [
  'Login',
  'Tentativa de acesso',
  'Cadastro de usuário',
  'Edição de usuário',
  'Alteração de permissões',
  'Desativação de conta',
  'Logout',
] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]
export type Resultado = 'Sucesso' | 'Falha' | 'Negado'

export type EventoAuditoria = {
  id: number
  dataHora: string // ISO
  usuario: string
  perfil: string
  evento: TipoEvento
  modulo: string
  resultado: Resultado
  detalhes: string
}

const base: Omit<EventoAuditoria, 'id' | 'dataHora'>[] = [
  { usuario: 'Marina Costa', perfil: 'ADM', evento: 'Login', modulo: 'Autenticação', resultado: 'Sucesso', detalhes: 'Acesso pelo navegador Chrome' },
  { usuario: 'Marina Costa', perfil: 'ADM', evento: 'Cadastro de usuário', modulo: 'Configurações', resultado: 'Sucesso', detalhes: 'Conta criada para Thiago Martins (Motorista)' },
  { usuario: 'Carlos Almeida', perfil: 'Gestor da Frota', evento: 'Login', modulo: 'Autenticação', resultado: 'Sucesso', detalhes: 'Acesso pelo navegador Firefox' },
  { usuario: 'Eduardo Lima', perfil: 'Motorista', evento: 'Tentativa de acesso', modulo: 'Autenticação', resultado: 'Falha', detalhes: 'Senha incorreta (3ª tentativa)' },
  { usuario: 'Marina Costa', perfil: 'ADM', evento: 'Alteração de permissões', modulo: 'Configurações', resultado: 'Sucesso', detalhes: 'Perfil Solicitante: + Calendário' },
  { usuario: 'Juliana Ribeiro', perfil: 'Solicitante', evento: 'Tentativa de acesso', modulo: 'Relatórios', resultado: 'Negado', detalhes: 'Perfil sem permissão para o módulo' },
  { usuario: 'Marina Costa', perfil: 'ADM', evento: 'Desativação de conta', modulo: 'Configurações', resultado: 'Sucesso', detalhes: 'Conta de Otávio Barros desativada' },
  { usuario: 'Patrícia Nunes', perfil: 'Atendente SVO', evento: 'Login', modulo: 'Autenticação', resultado: 'Sucesso', detalhes: 'Acesso pelo navegador Edge' },
  { usuario: 'Gustavo Pereira', perfil: 'Gestor da Frota', evento: 'Edição de usuário', modulo: 'Configurações', resultado: 'Negado', detalhes: 'Ação restrita ao perfil ADM' },
  { usuario: 'Rafael Moura', perfil: 'Motorista', evento: 'Logout', modulo: 'Autenticação', resultado: 'Sucesso', detalhes: 'Sessão encerrada pelo usuário' },
  { usuario: 'Marina Costa', perfil: 'ADM', evento: 'Edição de usuário', modulo: 'Configurações', resultado: 'Sucesso', detalhes: 'Perfil de Larissa Teixeira alterado' },
  { usuario: 'Helena Duarte', perfil: 'Solicitante', evento: 'Tentativa de acesso', modulo: 'Autenticação', resultado: 'Negado', detalhes: 'Conta inativa' },
]

const agora = new Date()
export const eventosAuditoria: EventoAuditoria[] = Array.from({ length: 36 }, (_, i) => {
  const d = new Date(agora)
  d.setMinutes(d.getMinutes() - i * 197 - (i % 5) * 13)
  return { ...base[i % base.length], id: i + 1, dataHora: d.toISOString() }
})
