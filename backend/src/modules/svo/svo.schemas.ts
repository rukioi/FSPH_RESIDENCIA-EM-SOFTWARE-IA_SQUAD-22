import { z } from 'zod';
import { id } from '../../shared/contract/schemas.js';
export const svoSchemas = {
  OrdensSvo: z.array(z.object({ id, status: z.literal('PENDENTE_ALOCACAO'), solicitacao_obito_id: id.nullable(),
    solicitacao_codigo: z.string(), nome_falecido: z.string().nullable(), endereco_remocao: z.string() })),
  CriarSolicitacaoSvo: z.object({ localFalecimento: z.string().regex(/\S/), enderecoRemocao: z.string().regex(/\S/), solicitanteNome: z.string().regex(/\S/),
    nomeFalecido: z.string().nullish(), solicitanteParentesco: z.string().nullish(), solicitanteTelefone: z.string().nullish(), observacoesMedicas: z.string().nullish() }),
  SolicitacaoSvo: z.object({ solicitacao: z.object({ id: z.number(), codigo: z.string() }),
    ordemColeta: z.object({ id: z.number(), codigo: z.string(), status: z.literal('PENDENTE_ALOCACAO') }), atividades: z.array(z.string()) }),
  DespacharSvo: z.object({ motoristaId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), veiculoId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
  OrdemDespachada: z.object({ id: z.number(), motorista_id: z.number(), veiculo_id: z.number(), status: z.literal('EM_DESLOCAMENTO') })
    .describe('Conversão legada explícita para Number; precisão de BIGINT acima de MAX_SAFE_INTEGER não é garantida.'),
};
