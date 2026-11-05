import type { z } from 'zod';
import type { criarSolicitacaoSchema, listarSolicitacoesSchema, statusSolicitacao, agendarSolicitacaoSchema, agendamentoSolicitacao, editarSolicitacaoSchema } from './solicitacoes.schemas.js';
import { verificarDisponibilidade } from '../alocacao/alocacao.repository.js';
import { sql } from '../../database/connection.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import { ErroHttp } from '../../shared/http/errors.js';

export interface NovaSolicitacao {
  solicitanteId: string;
  dados: z.infer<typeof criarSolicitacaoSchema>;
  status: 'PENDENTE';
}

export type EscopoSolicitacoes =
  | { tipo: 'proprias'; solicitanteId: string }
  | { tipo: 'gestao' };

export interface ConsultaSolicitacoes {
  filtros: z.infer<typeof listarSolicitacoesSchema>;
  escopo: EscopoSolicitacoes;
}

export interface LinhaSolicitacao {
  id: string; codigo: string; solicitante_id: string | null; solicitante_nome: string | null;
  origem: string; destino: string; finalidade: string | null; data_hora_saida: string;
  qtd_passageiros: number | null;
  status: z.infer<typeof statusSolicitacao> | null;
}

export type DecisaoSolicitacao =
  | { status: 'APROVADA'; motivo: null }
  | { status: 'REPROVADA'; motivo: string };

/** Serializa edição e transições na linha; campos omitidos são preservados, aprovação exige nova análise. */
export async function editarSolicitacao(id: string, responsavelId: string, dados: z.infer<typeof editarSolicitacaoSchema>): Promise<LinhaSolicitacao> {
  return sql.begin('isolation level read committed', async tx => {
    const [atual] = await tx`SELECT status FROM public.solicitacao_viagem WHERE id=${id} FOR UPDATE`;
    if (!atual) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Solicitação não encontrada.');
    if (!['PENDENTE','APROVADA'].includes(atual.status)) {
      throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'Somente solicitações pendentes ou aprovadas podem ser editadas.');
    }
    const [row] = await tx<LinhaSolicitacao[]>`UPDATE public.solicitacao_viagem SET
      origem=COALESCE(${dados.origem ?? null}::text, origem),
      destino=COALESCE(${dados.destino ?? null}::text, destino),
      finalidade=COALESCE(${dados.finalidade ?? null}::text, finalidade),
      data_hora_saida=COALESCE((${dados.dataHoraSaida ?? null}::timestamptz AT TIME ZONE 'America/Maceio'), data_hora_saida),
      qtd_passageiros=COALESCE(${dados.qtdPassageiros ?? null}::integer, qtd_passageiros), status='PENDENTE'
      WHERE id=${id} AND status IN ('PENDENTE','APROVADA')
      RETURNING id::text, codigo, solicitante_id::text, origem, destino, finalidade,
        to_char(data_hora_saida, 'YYYY-MM-DD"T"HH24:MI:SS.US') || '-03:00' AS data_hora_saida,
        qtd_passageiros, status`;
    if (!row) throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'A solicitação não pode mais ser editada.');
    const [usuario] = await tx`SELECT nome FROM public.usuario WHERE id=${row.solicitante_id}`;
    await registrarAtividades(tx, responsavelId, [{ operacao:'solicitacao_viagem_editada', recursoId:id }]);
    return { ...row, solicitante_nome: usuario?.nome ?? null };
  });
}

/** Agenda somente pedido aprovado, serializando reservas com o despacho SVO. */
export async function agendarSolicitacao(id: string, responsavelId: string, dados: z.infer<typeof agendarSolicitacaoSchema>) {
  return sql.begin('isolation level read committed', async tx => {
    const [pedido] = await tx`SELECT status,
      to_char(data_hora_saida, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS inicio,
      to_char((${dados.dataHoraRetornoPrevisto}::timestamptz AT TIME ZONE 'America/Maceio'), 'YYYY-MM-DD"T"HH24:MI:SS.US') AS fim,
      (${dados.dataHoraRetornoPrevisto}::timestamptz AT TIME ZONE 'America/Maceio') > data_hora_saida AS retorno_valido
      FROM public.solicitacao_viagem WHERE id=${id} FOR UPDATE`;
    if (!pedido) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Solicitação não encontrada.');
    if (pedido.status !== 'APROVADA') throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'A solicitação precisa estar aprovada para ser agendada.');
    if (pedido.retorno_valido !== true) throw new ErroHttp(400, 'RETORNO_INVALIDO', 'O retorno previsto deve ser posterior à saída.');
    const disponibilidade = await verificarDisponibilidade(tx, dados.motoristaId, dados.veiculoId, { inicio: pedido.inicio, fim: pedido.fim });
    if (disponibilidade === 'referencia_inexistente') throw new ErroHttp(404, 'REFERENCIA_INEXISTENTE', 'Motorista ou veículo não encontrado.');
    if (disponibilidade === 'recurso_inelegivel') throw new ErroHttp(409, 'RECURSO_INDISPONIVEL', 'Motorista ou veículo não está disponível.');
    if (disponibilidade === 'conflito_alocacao') throw new ErroHttp(409, 'CONFLITO_ALOCACAO', 'Motorista ou veículo possui uma alocação conflitante.');
    const [row] = await tx<z.infer<typeof agendamentoSolicitacao>[]>`UPDATE public.solicitacao_viagem
      SET motorista_id=${dados.motoristaId}, veiculo_id=${dados.veiculoId},
        data_hora_retorno_previsto=${pedido.fim}::timestamp, status='AGENDADA'
      WHERE id=${id} AND status='APROVADA'
      RETURNING id::text, status, motorista_id::text AS "motoristaId", veiculo_id::text AS "veiculoId",
        to_char(data_hora_saida, 'YYYY-MM-DD"T"HH24:MI:SS.US') || '-03:00' AS "dataHoraSaida",
        to_char(data_hora_retorno_previsto, 'YYYY-MM-DD"T"HH24:MI:SS.US') || '-03:00' AS "dataHoraRetornoPrevisto"`;
    if (!row) throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'A solicitação não está mais aprovada.');
    await registrarAtividades(tx, responsavelId, [{ operacao: 'solicitacao_viagem_agendada', recursoId: id }]);
    return row;
  });
}

/** Serializa decisões na linha e grava estado, motivo e responsável na mesma transação. */
export async function decidirSolicitacao(id: string, responsavelId: string, decisao: DecisaoSolicitacao) {
  return sql.begin(async tx => {
    const [atual] = await tx`SELECT status FROM public.solicitacao_viagem WHERE id=${id} FOR UPDATE`;
    if (!atual) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Solicitação não encontrada.');
    if (atual.status !== 'PENDENTE') throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'A solicitação precisa estar pendente para receber uma decisão.');
    const [row] = await tx<{ id: string; status: 'APROVADA' | 'REPROVADA'; motivoRejeicao: string | null }[]>`
      UPDATE public.solicitacao_viagem SET status=${decisao.status}, motivo_rejeicao=${decisao.motivo}
      WHERE id=${id} AND status='PENDENTE'
      RETURNING id::text, status, motivo_rejeicao AS "motivoRejeicao"`;
    if (!row) throw new ErroHttp(409, 'ESTADO_INCOMPATIVEL', 'A solicitação precisa estar pendente para receber uma decisão.');
    await registrarAtividades(tx, responsavelId, [{
      operacao: decisao.status === 'APROVADA' ? 'solicitacao_viagem_aprovada' : 'solicitacao_viagem_reprovada', recursoId: id,
    }]);
    return row;
  });
}

/** Usa sequência e UNIQUE existentes; criação e atividade confirmam na mesma transação. */
export async function inserirSolicitacao(entrada: NovaSolicitacao): Promise<LinhaSolicitacao> {
  return sql.begin(async tx => {
    const [sequencia] = await tx`SELECT nextval('public.solicitacao_viagem_id_seq')::text AS id`;
    const id = String(sequencia.id);
    const codigo = `TRP-${id}`;
    if (codigo.length > 20) throw new ErroHttp(409, 'CODIGO_FORA_DO_LIMITE', 'O código excede o limite disponível. Contate o responsável pelo sistema.');
    const { dados } = entrada;
    const [row] = await tx<LinhaSolicitacao[]>`INSERT INTO public.solicitacao_viagem
      (id, codigo, solicitante_id, origem, destino, finalidade, data_hora_saida, qtd_passageiros, status)
      VALUES (${id}, ${codigo}, ${entrada.solicitanteId}, ${dados.origem}, ${dados.destino}, ${dados.finalidade},
        (${dados.dataHoraSaida}::timestamptz AT TIME ZONE 'America/Maceio'), ${dados.qtdPassageiros}, 'PENDENTE')
      RETURNING id::text, codigo, solicitante_id::text, origem, destino, finalidade,
        to_char(data_hora_saida, 'YYYY-MM-DD"T"HH24:MI:SS.US') || '-03:00' AS data_hora_saida,
        qtd_passageiros, status`;
    const [usuario] = await tx`SELECT nome FROM public.usuario WHERE id=${entrada.solicitanteId}`;
    await registrarAtividades(tx, entrada.solicitanteId, [{ operacao: 'solicitacao_viagem_criada', recursoId: id }]);
    return { ...row, solicitante_nome: usuario?.nome ?? null };
  });
}

/** Dados e total usam os mesmos filtros/escopo em um snapshot somente leitura. */
export async function consultarSolicitacoes(consulta: ConsultaSolicitacoes): Promise<{ rows: LinhaSolicitacao[]; total: number }> {
  const { filtros, escopo } = consulta;
  const solicitanteId = escopo.tipo === 'proprias' ? escopo.solicitanteId : null;
  return sql.begin('isolation level repeatable read read only', async tx => {
    const rows = await tx<LinhaSolicitacao[]>`SELECT s.id::text, s.codigo, s.solicitante_id::text,
      u.nome AS solicitante_nome, s.origem, s.destino, s.finalidade,
      to_char(s.data_hora_saida, 'YYYY-MM-DD"T"HH24:MI:SS.US') || '-03:00' AS data_hora_saida,
      s.qtd_passageiros, s.status
      FROM public.solicitacao_viagem s LEFT JOIN public.usuario u ON u.id=s.solicitante_id
      WHERE (${solicitanteId}::bigint IS NULL OR s.solicitante_id=${solicitanteId}::bigint)
        AND (${filtros.status ?? null}::text IS NULL OR s.status::text=${filtros.status ?? null})
      ORDER BY s.id DESC LIMIT ${filtros.limit} OFFSET ${(filtros.page - 1) * filtros.limit}`;
    const [count] = await tx`SELECT count(*)::text AS total FROM public.solicitacao_viagem s
      WHERE (${solicitanteId}::bigint IS NULL OR s.solicitante_id=${solicitanteId}::bigint)
        AND (${filtros.status ?? null}::text IS NULL OR s.status::text=${filtros.status ?? null})`;
    const total = Number(count.total);
    if (!Number.isSafeInteger(total)) throw new Error('Contagem fora do intervalo suportado.');
    return { rows, total };
  });
}
