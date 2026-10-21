
import { sql } from '../../database/connection.js';

export async function listarOrdensPendentes() {
  return await sql`
    SELECT *
    FROM ordem_coleta
    WHERE status = 'PENDENTE_ALOCACAO'
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

    const descricaoSolicitacao =
      `Solicitação ${codigo} confirmada na ligação`;

    const descricaoOrdem =
      `Ordem de coleta ${codigoOrdem} gerada para ${codigo}`;

    await transacao`
      INSERT INTO public.log_atividade (
        usuario_id,
        descricao
      )
      VALUES
        (
          ${dados.atendenteId},
          ${descricaoSolicitacao}
        ),
        (
          ${dados.atendenteId},
          ${descricaoOrdem}
        )
    `;

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
      atividades: [
        descricaoSolicitacao,
        descricaoOrdem,
      ],
    };
  });
}

export async function despacharOrdem(
  dados: DadosDespacho
) {
  const ordens = await sql`
    UPDATE public.ordem_coleta
    SET
      motorista_id = ${dados.motoristaId},
      veiculo_id = ${dados.veiculoId},
      status = 'EM_DESLOCAMENTO'
    WHERE id = ${dados.ordemId}
      AND status = 'PENDENTE_ALOCACAO'
    RETURNING id, motorista_id, veiculo_id, status
  `;

  return ordens[0] ?? null;
}
