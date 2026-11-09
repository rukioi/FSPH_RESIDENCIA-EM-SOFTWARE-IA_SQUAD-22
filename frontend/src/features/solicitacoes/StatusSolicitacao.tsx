import type { StatusSolicitacao as Status } from './regras'

// Usa as classes .badge do tema.css.
const COR: Record<Status, string> = {
  Pendente: 'badge--amarelo',
  Aprovada: 'badge--verde',
  Recusada: 'badge--vermelho',
  Agendada: 'badge--azul',
  'Em andamento': 'badge--marinho',
  Concluída: 'badge--verde',
  Cancelada: 'badge--cinza',
  'Não informado': 'badge--cinza',
}

export function StatusSolicitacao({ status }: { status: Status }) {
  return <span className={`badge ${COR[status]}`}>{status}</span>
}
