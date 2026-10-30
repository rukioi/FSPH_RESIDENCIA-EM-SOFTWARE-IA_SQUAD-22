
import { sql } from '../../database/connection.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';

/** Lista ordens de coleta que ainda aguardam alocação de motorista e veículo. */
export async function listarOrdensPendentes() {
  return await sql`
    SELECT
      oc.id,
      oc.status,
      oc.solicitacao_obito_id,
      so.codigo AS solicitacao_codigo,
      so.nome_falecido,
      so.endereco_remocao
    FROM public.ordem_coleta oc
    INNER JOIN public.solicitacao_obito so
      ON so.id = oc.solicitacao_obito_id
    WHERE oc.status = 'PENDENTE_ALOCACAO'
    ORDER BY oc.id DESC
  `;
}

export interface NovaSolicitacaoObito {
  atendenteId: string;
  nomeFalecido?: string;
  localFalecimento: string;
  enderecoRemocao: string;
  solicitanteNome: string;
  solicitanteParentesco?: string;
  solicitanteTelefone?: string;
  observacoesMedicas?: string;
}

export interface DadosDespacho {
  ordemId: number;
  motoristaId: number;
  veiculoId: number;
}

export interface OrdemDespachada {
  id: number;
  motorista_id: number;
  veiculo_id: number;
  status: string;
}

export type ResultadoDespacho =
  | { tipo: 'despachada'; ordem: OrdemDespachada }
  | { tipo: 'ordem_indisponivel' }
  | { tipo: 'referencia_inexistente' }
  | { tipo: 'recurso_inelegivel' }
  | { tipo: 'conflito_alocacao' };

/**
 * Cria a solicitação, a ordem de coleta e os registros de atividade na mesma transação.
 */
export async function criarSolicitacao(
  dados: NovaSolicitacaoObito
) {
  return await sql.begin(async (transacao) => {
    const resultado = await transacao`
      SELECT nextval('public.solicitacao_obito_id_seq') AS id
    `;

    const id = Number(resultado[0].id);
    const codigo = `#SVO-${id}`;

    const solicitacoes = await transacao`
      INSERT INTO public.solicitacao_obito (
        id,
        codigo,
        atendente_id,
        nome_falecido,
        local_falecimento,
        endereco_remocao,
        solicitante_nome,
        solicitante_parentesco,
        solicitante_telefone,
        observacoes_medicas
      )
      VALUES (
        ${id},
        ${codigo},
        ${dados.atendenteId},
        ${dados.nomeFalecido ?? null},
        ${dados.localFalecimento},
        ${dados.enderecoRemocao},
        ${dados.solicitanteNome},
        ${dados.solicitanteParentesco ?? null},
        ${dados.solicitanteTelefone ?? null},
        ${dados.observacoesMedicas ?? null}
      )
      RETURNING id, codigo
    `;

    const solicitacaoId = Number(solicitacoes[0].id);

    const ordensCriadas = await transacao`
      INSERT INTO public.ordem_coleta (
        solicitacao_obito_id
      )
      VALUES (
        ${solicitacaoId}
      )
      RETURNING id, status
    `;

    const ordemId = Number(ordensCriadas[0].id);
    const statusOrdem = String(ordensCriadas[0].status);
    const codigoOrdem = `#OC-${ordemId}`;

    const atividades = await registrarAtividades(transacao, dados.atendenteId, [
      { operacao: 'solicitacao_confirmada', recursoId: String(solicitacaoId) },
      { operacao: 'ordem_gerada', recursoId: String(ordemId), solicitacaoId: String(solicitacaoId) },
    ]);

    return {
      solicitacao: {
        id: solicitacaoId,
        codigo,
      },
      ordemColeta: {
        id: ordemId,
        codigo: codigoOrdem,
        status: statusOrdem,
      },
      atividades,
    };
  });
}

/**
 * Despacha a ordem na mesma transação, com bloqueio das linhas envolvidas.
 *
 * A ordem precisa estar em PENDENTE_ALOCACAO. Motorista e veículo precisam
 * existir e estar DISPONIVEL, que é o único estado elegível já definido
 * para os dois. Nenhum dos dois pode estar em outra ordem EM_DESLOCAMENTO.
 * Pendência de CNH ou de documento do veículo não entra nesta regra: o
 * painel só avisa, e não há restrição de despacho definida para isso.
 *
 * O perfil ATENDENTE_SVO continua sendo exigido na rota. Esta função não
 * grava auditoria do responsável porque o contrato atual não pede isso.
 *
 * @returns Resultado de domínio para o controller responder 200, 404 ou 409.
 */
export async function despacharOrdem(
  dados: DadosDespacho
): Promise<ResultadoDespacho> {
  try {
    return await sql.begin(async (transacao) => {
      const ordens = await transacao`
        SELECT id
        FROM public.ordem_coleta
        WHERE id = ${dados.ordemId}
          AND status = 'PENDENTE_ALOCACAO'
        FOR UPDATE
      `;

      if (ordens.length === 0) {
        return { tipo: 'ordem_indisponivel' };
      }

      const motoristas = await transacao`
        SELECT id, status
        FROM public.motorista
        WHERE id = ${dados.motoristaId}
        FOR UPDATE
      `;

      const veiculos = await transacao`
        SELECT id, status
        FROM public.veiculo
        WHERE id = ${dados.veiculoId}
        FOR UPDATE
      `;

      if (motoristas.length !== 1 || veiculos.length !== 1) {
        return { tipo: 'referencia_inexistente' };
      }

      if (
        String(motoristas[0].status) !== 'DISPONIVEL'
        || String(veiculos[0].status) !== 'DISPONIVEL'
      ) {
        return { tipo: 'recurso_inelegivel' };
      }

      const conflitos = await transacao`
        SELECT id
        FROM public.ordem_coleta
        WHERE status = 'EM_DESLOCAMENTO'
          AND (
            motorista_id = ${dados.motoristaId}
            OR veiculo_id = ${dados.veiculoId}
          )
        ORDER BY id
        FOR UPDATE
      `;

      if (conflitos.length > 0) {
        return { tipo: 'conflito_alocacao' };
      }

      const atualizadas = await transacao`
        UPDATE public.ordem_coleta
        SET
          motorista_id = ${dados.motoristaId},
          veiculo_id = ${dados.veiculoId},
          status = 'EM_DESLOCAMENTO'
        WHERE id = ${dados.ordemId}
          AND status = 'PENDENTE_ALOCACAO'
        RETURNING id, motorista_id, veiculo_id, status
      `;

      const ordem = atualizadas[0];

      if (!ordem) {
        return { tipo: 'ordem_indisponivel' };
      }

      return {
        tipo: 'despachada',
        ordem: {
          id: Number(ordem.id),
          motorista_id: Number(ordem.motorista_id),
          veiculo_id: Number(ordem.veiculo_id),
          status: String(ordem.status),
        },
      };
    });
  } catch (erro) {
    const codigo = codigoPostgres(erro);

    if (codigo === '23503') {
      return { tipo: 'referencia_inexistente' };
    }

    if (codigo === '23505') {
      return { tipo: 'conflito_alocacao' };
    }

    throw erro;
  }
}

/** Lê o código SQLSTATE de um erro do PostgreSQL, quando ele existir. */
function codigoPostgres(erro: unknown): string | undefined {
  if (typeof erro !== 'object' || erro === null || !('code' in erro)) {
    return undefined;
  }

  const codigo = erro.code;
  return typeof codigo === 'string' ? codigo : undefined;
}
