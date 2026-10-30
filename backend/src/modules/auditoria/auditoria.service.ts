import type postgres from 'postgres';
import { consultarAtividades, inserirAtividades, type PaginacaoAtividades } from './auditoria.repository.js';

export type EventoAtividade =
  | { operacao: 'usuario_criado' | 'usuario_editado'; recursoId: string }
  | { operacao: 'usuario_status'; recursoId: string; ativo: boolean }
  | { operacao: 'solicitacao_confirmada'; recursoId: string }
  | { operacao: 'ordem_gerada'; recursoId: string; solicitacaoId: string };

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
    case 'solicitacao_confirmada': return `Solicitação #SVO-${id} confirmada na ligação`;
    case 'ordem_gerada': return `Ordem de coleta #OC-${id} gerada para #SVO-${identificador(evento.solicitacaoId)}`;
    default: throw new Error('Operação de atividade inválida.');
  }
}

/** Registra apenas os eventos existentes, sem interpolar payload, nome ou contato pessoal. */
export async function registrarAtividades(tx: postgres.TransactionSql, usuarioId: string, eventos: EventoAtividade[]): Promise<string[]> {
  const descricoes = eventos.map(descrever);
  if (descricoes.length) await inserirAtividades(tx, identificador(usuarioId), descricoes);
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
