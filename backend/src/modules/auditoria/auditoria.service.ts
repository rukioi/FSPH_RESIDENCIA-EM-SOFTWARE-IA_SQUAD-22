
import type postgres from 'postgres';
import { consultarAtividades, inserirAtividades, type PaginacaoAtividades } from './auditoria.repository.js';

export type EventoAtividade =
  | { operacao: 'usuario_criado' | 'usuario_editado'; recursoId: string }
  | { operacao: 'usuario_status'; recursoId: string; ativo: boolean }
  | { operacao: 'solicitacao_confirmada' | 'solicitacao_registrada'; recursoId: string }
  | { operacao: 'solicitacao_viagem_criada'; recursoId: string }
  | { operacao: 'solicitacao_viagem_aprovada' | 'solicitacao_viagem_reprovada'; recursoId: string }
  | { operacao: 'solicitacao_viagem_agendada'; recursoId: string }
  | { operacao: 'solicitacao_viagem_editada'; recursoId: string }
  | { operacao: 'solicitacao_viagem_reagendada'; recursoId: string }
  | { operacao: 'triagem_rascunho_salvo' | 'triagem_confirmada_svo' | 'triagem_encaminhada_iml'; recursoId: string }
  | { operacao: 'ordem_gerada'; recursoId: string; solicitacaoId: string }
  | { operacao: 'ordem_despachada'|'ordem_iniciada'|'ordem_transporte'|'ordem_concluida'|'ordem_cancelada'; recursoId: string };

export interface AtividadeDto {
  id: string;
  usuarioId: string | null;
  descricao: string;
  dataHora: string | null;
  usuarioNome: string | null;
}

function identificador(valor: string): string {
  if (!/^-?[0-9]+$/.test(valor) || BigInt(valor) < -9223372036854775808n || BigInt(valor) > 9223372036854775807n) {
    throw new Error('Identificador de atividade inválido.');
  }
  return BigInt(valor).toString();
}

function descrever(evento: EventoAtividade): string {
  const id = identificador(evento.recursoId);
  switch (evento.operacao) {
    case 'usuario_criado': return `Criou o usuário ID ${id}`;
    case 'usuario_editado': return `Atualizou os dados do usuário ID ${id}`;
    case 'usuario_status':
      if (typeof evento.ativo !== 'boolean') throw new Error('Estado de atividade inválido.');
      return `Alterou o status do usuário ID ${id} para ${evento.ativo ? 'Ativo' : 'Inativo'}`;

    case 'solicitacao_registrada': return `Solicitação #SVO-${id} registrada por telefone`;
    case 'solicitacao_confirmada': return `Solicitação #SVO-${id} confirmada na ligação`;

    case 'triagem_rascunho_salvo': return `Rascunho da triagem de #SVO-${id} atualizado`;
    case 'triagem_confirmada_svo': return `Triagem de #SVO-${id} confirmada como SVO`;
    case 'triagem_encaminhada_iml': return `Triagem de #SVO-${id} encaminhada ao IML`;

    case 'solicitacao_viagem_criada': return `Criou a solicitação de transporte ID ${id}`;
    case 'solicitacao_viagem_aprovada': return `Aprovou a solicitação de transporte ID ${id}`;
    case 'solicitacao_viagem_reprovada': return `Reprovou a solicitação de transporte ID ${id}`;
    case 'solicitacao_viagem_agendada': return `Agendou a solicitação de transporte ID ${id}`;
    case 'solicitacao_viagem_editada': return `Editou a solicitação de transporte ID ${id}`;
    case 'solicitacao_viagem_reagendada': return `Reagendou a solicitação de transporte ID ${id}`;

    case 'ordem_gerada': return `Ordem de coleta #OC-${id} gerada para #SVO-${identificador(evento.solicitacaoId)}`;
    case 'ordem_despachada': return `Ordem de coleta #OC-${id} despachada`;
    case 'ordem_iniciada': return `Ordem de coleta #OC-${id} iniciada`;
    case 'ordem_transporte': return `Ordem de coleta #OC-${id} entrou em transporte`;
    case 'ordem_concluida': return `Ordem de coleta #OC-${id} concluída`;
    case 'ordem_cancelada': return `Ordem de coleta #OC-${id} cancelada`;
    default: throw new Error('Operação de atividade inválida.');
  }
}

/** Registra apenas os eventos existentes, sem interpolar payload, nome ou contato pessoal. */
export async function registrarAtividades(tx: postgres.TransactionSql, usuarioId: string, eventos: EventoAtividade[]): Promise<string[]> {
  const descricoes = eventos.map(descrever);
  const solicitacoes = eventos.map(evento => {
    switch (evento.operacao) {
      case 'solicitacao_viagem_criada':
      case 'solicitacao_viagem_aprovada':
      case 'solicitacao_viagem_reprovada':
      case 'solicitacao_viagem_editada':
      case 'solicitacao_viagem_agendada':
      case 'solicitacao_viagem_reagendada':
        return identificador(evento.recursoId);
      default:
        return null;
    }
  });

  if (descricoes.length) {
    await inserirAtividades(
      tx,
      identificador(usuarioId),
      descricoes,
      solicitacoes.some(id => id !== null) ? solicitacoes : undefined
    );
  }
  return descricoes;
}

/** Valida parâmetros técnicos sem truncar, aceitar duplicatas ou perder precisão no offset. */
export function lerPaginacaoAtividades(params: URLSearchParams): PaginacaoAtividades | null | undefined {
  if (!params.has('page') && !params.has('limit')) return undefined;
  const value = (key: string, padrao: number) => {
    if (!params.has(key)) return padrao;
    const raw = params.get(key)!;
    return params.getAll(key).length === 1 && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : NaN;
  };
  const page = value('page', 1);
  const limit = value('limit', 20);
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)) return null;
  return { page, limit };
}

/** Mantém o array legado sem parâmetros; consumidores paginados recebem DTO mínimo camelCase. */
export async function listarAtividades(paginacao?: PaginacaoAtividades) {
  const { rows, total } = await consultarAtividades(paginacao);
  if (!paginacao) return rows.map(row => ({ ...row, data_hora: row.data_hora?.toISOString() ?? null }));
  const data: AtividadeDto[] = rows.map(row => ({
    id: row.id, usuarioId: row.usuario_id, descricao: row.descricao,
    dataHora: row.data_hora?.toISOString() ?? null, usuarioNome: row.usuario_nome,
  }));
  return { data, meta: { ...paginacao, total } };
}