import { z } from 'zod';
import { id } from '../../shared/contract/schemas.js';

const textoObrigatorio = (max: number) => z.string().trim().min(1).max(max);
const textoOpcional = (max: number) => z.string().trim().max(max).nullish();
export const statusTriagem = z.enum(['AGUARDANDO_TRIAGEM', 'CONFIRMADA_SVO', 'ENCAMINHADA_IML']);

export const svoSchemas = {
  StatusTriagem: statusTriagem,
  OrdensSvo: z.array(z.object({ id, status: z.literal('PENDENTE_ALOCACAO'), solicitacao_obito_id: id.nullable(),
    solicitacao_codigo: z.string(), nome_falecido: z.string().nullable(), endereco_remocao: z.string() })),
  CriarSolicitacaoSvo: z.object({
    localFalecimento: textoObrigatorio(255),
    enderecoRemocao: textoObrigatorio(255),
    solicitanteNome: textoObrigatorio(150),
    nomeFalecido: textoOpcional(150),
    solicitanteParentesco: textoOpcional(50),
    solicitanteTelefone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/).nullish(),
    observacoesMedicas: textoOpcional(2000),
    pontoReferencia: textoOpcional(255),
    canalAtendimento: z.literal('TELEFONE').optional(),
  }).strict(),
  SolicitacaoSvo: z.object({
    solicitacao: z.object({
      id, codigo: z.string(), statusTriagem: z.literal('AGUARDANDO_TRIAGEM'),
      criadoEm: z.string().nullable(),
    }),
    atividades: z.array(z.string()),
  }),
  SolicitacoesSvo: z.array(z.object({
    id, codigo: z.string(), status_triagem: statusTriagem.nullable(), criado_em: z.string().nullable(),
  })),
  SalvarTriagemParcialSvo: z.object({
    triagemObservacoes: textoObrigatorio(2000),
  }).strict(),
  FinalizarTriagemSvo: z.discriminatedUnion('decisao', [
    z.object({
      decisao: z.literal('CONFIRMADA_SVO'),
      triagemObservacoes: textoObrigatorio(2000),
      quantidadeCorpos: z.number().int().min(1).max(4),
    }).strict(),
    z.object({
      decisao: z.literal('ENCAMINHADA_IML'),
      triagemObservacoes: textoObrigatorio(2000),
    }).strict(),
  ]),
  TriagemParcialSvo: z.object({
    solicitacaoId: id,
    statusTriagem: z.literal('AGUARDANDO_TRIAGEM'),
    triagemObservacoes: z.string(),
    atividades: z.array(z.string()),
  }),
  TriagemFinalSvo: z.object({
    solicitacao: z.object({
      id, codigo: z.string(),
      statusTriagem: z.enum(['CONFIRMADA_SVO', 'ENCAMINHADA_IML']),
      triadoPorId: id,
      triadoEm: z.string(),
    }),
    ordemColeta: z.object({
      id, codigo: z.string(), status: z.literal('PENDENTE_ALOCACAO'),
      quantidadeCorpos: z.number().int().min(1).max(4),
    }).nullable(),
    atividades: z.array(z.string()),
  }),
  DespacharSvo: z.object({ motoristaId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    veiculoId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
  OrdemDespachada: z.object({ id: z.number(), motorista_id: z.number(), veiculo_id: z.number(),
    status: z.literal('EM_DESLOCAMENTO') })
    .describe('Conversão legada explícita para Number; precisão de BIGINT acima de MAX_SAFE_INTEGER não é garantida.'),
};
