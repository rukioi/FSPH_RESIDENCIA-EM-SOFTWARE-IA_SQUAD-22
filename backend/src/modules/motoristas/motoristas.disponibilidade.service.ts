import type postgres from 'postgres';
import { sql } from '../../database/connection.js';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { registrarAtividades, type EventoAtividade } from '../auditoria/auditoria.service.js';
import {
  cancelarRegistro, consultaPeriodos, consultaTransicoes, criarEscala, criarImpedimento, motivoTransicao,
  motoristasDisponibilidadeSchemas as schemas,
} from './motoristas.disponibilidade.schemas.js';

/** Escala e impedimento compartilham ciclo: registrar, consultar e cancelar com motivo. */
export type TipoPeriodo = 'escalas' | 'impedimentos';
const periodos = {
  escalas: { tabela: 'escala_motorista', campo: 'situacao', entrada: criarEscala, conflito: 'escala_motorista_sem_sobreposicao',
    erro: ['ESCALA_SOBREPOSTA', 'Já existe escala vigente sobreposta a esse período.'],
    criado: 'motorista_escala_registrada', cancelado: 'motorista_escala_cancelada',
    resposta: schemas.RespostaEscalaMotorista, lista: schemas.ListaEscalasMotorista },
  impedimentos: { tabela: 'indisponibilidade_motorista', campo: 'tipo', entrada: criarImpedimento,
    conflito: 'indisponibilidade_motorista_sem_sobreposicao',
    erro: ['IMPEDIMENTO_SOBREPOSTO', 'Já existe impedimento vigente sobreposto a esse período.'],
    criado: 'motorista_impedimento_registrado', cancelado: 'motorista_impedimento_cancelado',
    resposta: schemas.RespostaImpedimentoMotorista, lista: schemas.ListaImpedimentosMotorista },
} as const;

type Linha = Record<string, unknown> & { id: string; motorista_id: string; inicio: Date; fim: Date | null; estado: string;
  autor_id: string; criado_em: Date; cancelado_por_id: string | null; cancelado_em: Date | null; motivo_cancelamento: string | null };
type LinhaTransicao = { id: string; motorista_id: string; versao: number; acao: 'INATIVACAO' | 'REATIVACAO'; motivo: string;
  autor_id: string; criado_em: Date };

const invalido = () => new ErroHttp(400, 'DADOS_INVALIDOS', 'Dados inválidos para o motorista.');
const iso = (d: Date | null) => d === null ? null : d.toISOString();
function dto(tipo: TipoPeriodo, r: Linha) {
  return { id: r.id, motoristaId: r.motorista_id, [periodos[tipo].campo]: r[periodos[tipo].campo], inicio: iso(r.inicio),
    fim: iso(r.fim), estado: r.estado, autorId: r.autor_id, criadoEm: iso(r.criado_em),
    cancelamento: r.estado === 'CANCELADA' ? { autorId: r.cancelado_por_id, em: iso(r.cancelado_em), motivo: r.motivo_cancelamento } : null };
}
const dtoTransicao = (r: LinhaTransicao) => ({ id: r.id, motoristaId: r.motorista_id, versao: r.versao, acao: r.acao,
  motivo: r.motivo, autorId: r.autor_id, criadoEm: r.criado_em.toISOString() });

/** Converte query string sem aceitar chave repetida (ambiguidade vira 400). */
function consulta(params: URLSearchParams): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const [chave, valor] of params) { if (chave in saida) throw invalido(); saida[chave] = valor; }
  return saida;
}
function validar<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, valor: unknown): T {
  const r = schema.safeParse(valor); if (!r.success) throw invalido(); return r.data;
}
/** Mesmo lock da alocação: serializa registro de impedimento com agendamento/despacho. */
async function travarMotorista(tx: postgres.TransactionSql, motoristaId: string) {
  const [m] = await tx`SELECT id FROM public.motorista WHERE id=${motoristaId} FOR UPDATE`;
  if (!m) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Motorista não encontrado.');
}
async function exigirMotorista(tx: postgres.TransactionSql, motoristaId: string) {
  const [m] = await tx`SELECT id FROM public.motorista WHERE id=${motoristaId}`;
  if (!m) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Motorista não encontrado.');
}
function codigo(erro: unknown): { code?: string; constraint_name?: string } {
  return typeof erro === 'object' && erro !== null ? erro as { code?: string; constraint_name?: string } : {};
}

/** Lista períodos do motorista, opcionalmente só os que se sobrepõem a [inicio, fim). */
export async function listarPeriodos(tipo: TipoPeriodo, motoristaId: string, params: URLSearchParams) {
  const q = validar(consultaPeriodos, consulta(params));
  const cfg = periodos[tipo];
  return sql.begin('isolation level repeatable read read only', async tx => {
    await exigirMotorista(tx, motoristaId);
    const filtro = q.inicio ? tx`AND tstzrange(inicio, fim, '[)') && tstzrange(${q.inicio}::timestamptz, ${q.fim!}::timestamptz, '[)')` : tx``;
    const rows = await tx<Linha[]>`SELECT * FROM ${tx('public.' + cfg.tabela)} WHERE motorista_id=${motoristaId} ${filtro}
      ORDER BY inicio DESC, id DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`;
    const [total] = await tx`SELECT count(*)::int AS n FROM ${tx('public.' + cfg.tabela)} WHERE motorista_id=${motoristaId} ${filtro}`;
    return cfg.lista.parse({ data: rows.map(r => dto(tipo, r)), meta: { page: q.page, limit: q.limit, total: total.n } });
  });
}

/** Registra período informado; autor e instante vêm da sessão/banco; auditoria na mesma transação. */
export async function registrarPeriodo(tipo: TipoPeriodo, usuario: UsuarioAutenticado, motoristaId: string, body: unknown) {
  const cfg = periodos[tipo];
  const entrada = validar<Record<string, string | null | undefined>>(cfg.entrada, body);
  return sql.begin(async tx => {
    await travarMotorista(tx, motoristaId);
    let linha: Linha;
    try {
      [linha] = await tx<Linha[]>`INSERT INTO ${tx('public.' + cfg.tabela)}
        ${tx({ motorista_id: motoristaId, [cfg.campo]: entrada[cfg.campo], inicio: entrada.inicio, fim: entrada.fim ?? null, autor_id: usuario.id })}
        RETURNING *`;
    } catch (erro) {
      if (codigo(erro).code === '23P01' && codigo(erro).constraint_name === cfg.conflito) throw new ErroHttp(409, cfg.erro[0], cfg.erro[1]);
      throw erro;
    }
    await registrarAtividades(tx, usuario.id, [{ operacao: cfg.criado, recursoId: linha.id, motoristaId } as EventoAtividade]);
    return cfg.resposta.parse({ data: dto(tipo, linha) });
  });
}

/** Cancela somente registro VIGENTE do motorista; nunca apaga nem reescreve o período. */
export async function cancelarPeriodo(tipo: TipoPeriodo, usuario: UsuarioAutenticado, motoristaId: string, registroId: string, body: unknown) {
  const cfg = periodos[tipo];
  const { motivo } = validar(cancelarRegistro, body);
  return sql.begin(async tx => {
    await travarMotorista(tx, motoristaId);
    const [linha] = await tx<Linha[]>`UPDATE ${tx('public.' + cfg.tabela)}
      SET estado='CANCELADA', cancelado_por_id=${usuario.id}, cancelado_em=clock_timestamp(), motivo_cancelamento=${motivo}
      WHERE id=${registroId} AND motorista_id=${motoristaId} AND estado='VIGENTE' RETURNING *`;
    if (!linha) {
      const [existe] = await tx`SELECT 1 FROM ${tx('public.' + cfg.tabela)} WHERE id=${registroId} AND motorista_id=${motoristaId}`;
      if (!existe) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Registro não encontrado para o motorista.');
      throw new ErroHttp(409, 'REGISTRO_JA_CANCELADO', 'O registro já foi cancelado.');
    }
    await registrarAtividades(tx, usuario.id, [{ operacao: cfg.cancelado, recursoId: linha.id, motoristaId } as EventoAtividade]);
    return cfg.resposta.parse({ data: dto(tipo, linha) });
  });
}

/** Histórico append-only e situação derivada da última transição. */
export async function listarTransicoes(motoristaId: string, params: URLSearchParams) {
  const q = validar(consultaTransicoes, consulta(params));
  return sql.begin('isolation level repeatable read read only', async tx => {
    await exigirMotorista(tx, motoristaId);
    const rows = await tx<LinhaTransicao[]>`SELECT id, motorista_id, versao, acao, motivo, autor_id, criado_em
      FROM public.motorista_transicao_profissional WHERE motorista_id=${motoristaId}
      ORDER BY versao DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`;
    const [resumo] = await tx`SELECT count(*)::int AS n, coalesce(max(versao) % 2 = 1, false) AS inativo
      FROM public.motorista_transicao_profissional WHERE motorista_id=${motoristaId}`;
    return schemas.ListaTransicoesMotorista.parse({ data: rows.map(dtoTransicao),
      meta: { page: q.page, limit: q.limit, total: resumo.n }, situacao: { motoristaId, inativo: resumo.inativo } });
  });
}

/**
 * Inativa ou reativa profissionalmente. Não altera conta, status operacional nem reservas
 * existentes (sem regra homologada para cancelá-las); novas alocações passam a ser recusadas.
 */
export async function registrarTransicao(acao: 'INATIVACAO' | 'REATIVACAO', usuario: UsuarioAutenticado, motoristaId: string, body: unknown) {
  const { motivo } = validar(motivoTransicao, body);
  return sql.begin(async tx => {
    await travarMotorista(tx, motoristaId);
    const [ultima] = await tx<{ versao: number; acao: string }[]>`SELECT versao, acao FROM public.motorista_transicao_profissional
      WHERE motorista_id=${motoristaId} ORDER BY versao DESC LIMIT 1`;
    const inativo = ultima?.acao === 'INATIVACAO';
    if (acao === 'INATIVACAO' && inativo) throw new ErroHttp(409, 'MOTORISTA_JA_INATIVO', 'O motorista já está inativado.');
    if (acao === 'REATIVACAO' && !inativo) throw new ErroHttp(409, 'MOTORISTA_NAO_INATIVO', 'O motorista não está inativado.');
    const versao = (ultima?.versao ?? 0) + 1;
    const [linha] = await tx<LinhaTransicao[]>`INSERT INTO public.motorista_transicao_profissional
      ${tx({ motorista_id: motoristaId, versao, versao_anterior: ultima?.versao ?? null, acao, motivo, autor_id: usuario.id })}
      RETURNING id, motorista_id, versao, acao, motivo, autor_id, criado_em`;
    await registrarAtividades(tx, usuario.id, [{ operacao: acao === 'INATIVACAO' ? 'motorista_inativado' : 'motorista_reativado', recursoId: motoristaId }]);
    return schemas.RespostaTransicaoMotorista.parse({ data: dtoTransicao(linha) });
  });
}
