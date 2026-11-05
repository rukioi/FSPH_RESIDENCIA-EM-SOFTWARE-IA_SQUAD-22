// DADOS DE DEMONSTRAÇÃO — substituir pelas respostas da API na integração.
// As telas só usam as funções abaixo, então basta trocar o corpo delas.
import type { Solicitacao } from './regras'

const SOLICITACOES: Solicitacao[] = [
  {
    id: 'TRP-1024', solicitante: 'Fernanda Lima', instituicao: 'Hemose',
    data: '2026-09-24', horario: '14:00', origem: 'Hemose', destino: 'Hospital Universitário',
    passageiros: 3, finalidade: 'Transporte de equipe técnica',
    observacao: 'Equipe levará caixas térmicas com amostras.', documentos: 'Caixas térmicas (2)',
    status: 'Pendente', criadaEm: '23/09/2026 16:42', comentarios: [],
  },
  {
    id: 'TRP-1025', solicitante: 'Paulo Menezes', instituicao: 'Laboratório Central',
    data: '2026-09-25', horario: '09:30', origem: 'Laboratório Central', destino: 'Unidade Messejana',
    passageiros: 2, finalidade: 'Entrega de laudos', observacao: '', documentos: 'Envelopes lacrados',
    status: 'Pendente', criadaEm: '23/09/2026 10:05', comentarios: [],
  },
  {
    id: 'TRP-1022', solicitante: 'Rita Barbosa', instituicao: 'Hemose',
    data: '2026-09-24', horario: '13:30', origem: 'Hemose', destino: 'Hospital Universitário',
    passageiros: 4, finalidade: 'Reunião técnica', observacao: '', documentos: '',
    status: 'Em andamento', criadaEm: '20/09/2026 08:12',
    motorista: 'Carlos Henrique', veiculo: 'POQ-4A21 · Administrativo',
    comentarios: [
      { id: 'c1', autor: 'Carlos Almeida', cargo: 'Gestor de Frota', data: '21/09/2026 09:10', texto: 'Motorista e veículo confirmados.' },
    ],
  },
  {
    id: 'TRP-1021', solicitante: 'Marina Duarte', instituicao: 'Hemose',
    data: '2026-09-24', horario: '16:20', origem: 'Hemose', destino: 'Unidade Messejana',
    passageiros: 1, finalidade: 'Visita de supervisão', observacao: 'Retorno no mesmo dia.', documentos: '',
    status: 'Agendada', criadaEm: '19/09/2026 14:30',
    motorista: 'Ana Paula', veiculo: 'RTA-8C14 · Administrativo', comentarios: [],
  },
  {
    id: 'TRP-1020', solicitante: 'Igor Nascimento', instituicao: 'Laboratório Central',
    data: '2026-09-24', horario: '17:00', origem: 'Laboratório Central', destino: 'Hospital Regional',
    passageiros: 2, finalidade: 'Coleta de material', observacao: '', documentos: 'Material biológico',
    status: 'Agendada', criadaEm: '18/09/2026 11:00',
    motorista: 'Marcos Lima', veiculo: 'SAB-2D09 · Administrativo', comentarios: [],
  },
  {
    id: 'TRP-1018', solicitante: 'Cláudia Reis', instituicao: 'Hemose',
    data: '2026-09-24', horario: '08:00', origem: 'Hemose', destino: 'Hospital Regional',
    passageiros: 3, finalidade: 'Capacitação', observacao: '', documentos: '',
    status: 'Concluída', criadaEm: '15/09/2026 09:00',
    motorista: 'Marcos Lima', veiculo: 'SAB-2D09 · Administrativo', comentarios: [],
  },
  {
    id: 'TRP-1017', solicitante: 'Sérgio Pontes', instituicao: 'Unidade Messejana',
    data: '2026-09-24', horario: '07:10', origem: 'Unidade Messejana', destino: 'Hemose',
    passageiros: 2, finalidade: 'Entrega de insumos', observacao: '', documentos: 'Insumos hospitalares',
    status: 'Concluída', criadaEm: '14/09/2026 15:20',
    motorista: 'Ana Paula', veiculo: 'RTA-8C14 · Administrativo', comentarios: [],
  },
  {
    id: 'TRP-1016', solicitante: 'Fernanda Lima', instituicao: 'Hemose',
    data: '2026-09-22', horario: '10:00', origem: 'Hemose', destino: 'Secretaria de Estado da Saúde',
    passageiros: 1, finalidade: 'Entrega de documentos', observacao: '', documentos: 'Ofícios',
    status: 'Recusada', criadaEm: '12/09/2026 10:40',
    comentarios: [
      { id: 'c2', autor: 'Carlos Almeida', cargo: 'Gestor de Frota', data: '13/09/2026 08:30', texto: 'Sem veículo disponível na data. Favor reagendar.' },
    ],
  },
  {
    id: 'TRP-1015', solicitante: 'Fernanda Lima', instituicao: 'Hemose',
    data: '2026-09-30', horario: '08:30', origem: 'Hemose', destino: 'Centro Administrativo',
    passageiros: 2, finalidade: 'Reunião de planejamento', observacao: '', documentos: '',
    status: 'Aprovada', criadaEm: '22/09/2026 13:15', comentarios: [],
  },
]

/** Nome usado no "usuário logado" do Solicitante quando a sessão não traz instituição. */
export const INSTITUICAO_DEMO = 'Hemose'

export function listarSolicitacoes(): Solicitacao[] {
  return SOLICITACOES
}

export function listarDoSolicitante(nome: string): Solicitacao[] {
  // Demonstração: se o nome da sessão não tiver registros, mostra os da Fernanda.
  const minhas = SOLICITACOES.filter((s) => s.solicitante === nome)
  return minhas.length ? minhas : SOLICITACOES.filter((s) => s.solicitante === 'Fernanda Lima')
}

export function buscarSolicitacao(id: string): Solicitacao | undefined {
  return SOLICITACOES.find((s) => s.id === id)
}
