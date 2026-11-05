import { z } from 'zod';
import { id } from '../../shared/contract/schemas.js';

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(valor => {
  const date = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === valor;
}, 'Data civil inválida.');

const pagina = z.string().regex(/^[1-9]\d*$/).default('1');
const limite = z.string().regex(/^[1-9]\d*$/).default('20');
export const consultaSvoPaginacao = z.strictObject({ page: pagina, limit: limite });
export const consultaSvoFiltroSolicitacoes = consultaSvoPaginacao.extend({
  status: z.enum(['AGUARDANDO_TRIAGEM', 'CONFIRMADA_SVO', 'ENCAMINHADA_IML']).optional(),
  inicio: data.optional(),
  fim: data.optional(),
}).refine(valor => !valor.inicio || !valor.fim || valor.inicio <= valor.fim, 'Período inválido.');
export const consultaSvoFiltroOrdens = consultaSvoPaginacao.extend({
  status: z.enum(['PENDENTE_ALOCACAO', 'EM_DESLOCAMENTO', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA']).optional(),
});

const numero = z.number().int().nonnegative();
const instante = z.string().nullable();
const meta = z.object({ page: numero, limit: numero, total: numero });
const ordemVinculada = z.object({
  id, codigo: z.string(), status: z.string().nullable(), quantidadeCorpos: numero.nullable(),
  motoristaId: id.nullable(), veiculoId: id.nullable(),
});
const resumoSolicitacao = z.object({
  id, codigo: z.string(), statusTriagem: z.string().nullable(), criadoEm: instante,
});
const resumoOrdem = z.object({
  id, codigo: z.string(), status: z.string().nullable(), solicitacaoId: id,
  solicitacaoCodigo: z.string(), quantidadeCorpos: numero.nullable(),
});
const evento = z.object({
  id, descricao: z.string(), dataHora: instante, usuarioId: id.nullable(), usuarioNome: z.string().nullable(),
});

export const svoConsultasSchemas = {
  ListaSolicitacoesSvoPaginada: z.object({ data: z.array(resumoSolicitacao), meta }),
  ListaOrdensSvoPaginada: z.object({ data: z.array(resumoOrdem), meta }),
  DetalheSolicitacaoSvo: resumoSolicitacao.extend({
    triagemObservacoes: z.string().nullable(), triadoPorId: id.nullable(), triadoEm: instante,
    localFalecimento: z.string(), enderecoRemocao: z.string(), pontoReferencia: z.string().nullable(),
    canalAtendimento: z.string().nullable(),
    solicitanteNome: z.string(), solicitanteParentesco: z.string().nullable(),
    solicitanteTelefone: z.string().nullable(), nomeFalecido: z.string().nullable(),
    observacoesMedicas: z.string().nullable(), ordemColeta: ordemVinculada.nullable(),
  }),
  DetalheOrdemSvo: resumoOrdem.extend({
    statusTriagem: z.string().nullable(), motoristaId: id.nullable(), veiculoId: id.nullable(),
    kmInicial: numero.nullable(), kmFinal: numero.nullable(), dataInicio: instante, dataFim: instante,
    enderecoRemocao: z.string(),
  }),
  HistoricoSvo: z.object({ data: z.array(evento), meta }),
};

/** Falha de validação antes de acessar SQL; nunca arredonda BIGINT ou offset. */
export function parsePaginacao(raw: { page: string; limit: string }): { page: number; limit: number; offset: number } | null {
  const page = Number(raw.page), limit = Number(raw.limit);
  const offset = (page - 1) * limit;
  return Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger(limit) &&
    limit >= 1 && limit <= 100 && Number.isSafeInteger(offset) && offset >= 0
    ? { page, limit, offset } : null;
}
