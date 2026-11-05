import { z } from 'zod';
import { id } from '../../shared/contract/schemas.js';

const quantidade = z.number().int().nonnegative();
const situacaoOrdem = z.enum(['PENDENTE_ALOCACAO','EM_DESLOCAMENTO','EM_TRANSPORTE','CONCLUIDA','CANCELADA']);
const linhaOrdem = z.object({
  id, codigo: z.string(), solicitacaoCodigo: z.string(), status: situacaoOrdem,
  quantidadeCorpos: quantidade.nullable(), veiculoId: id.nullable(),
  kmInicial: quantidade.nullable(), kmFinal: quantidade.nullable(),
  enderecoRemocao: z.string(), dataInicio: z.string().nullable(), dataFim: z.string().nullable(),
});
export const svoOperacionalSchemas = {
  RecursosDisponiveisSvo: z.object({
    motoristas: z.array(z.object({ id, nome: z.string() })),
    veiculos: z.array(z.object({ id, placa: z.string(), modelo: z.string(),
      ocupacao: quantidade, capacidade: z.literal(4), disponivel: z.boolean() })),
  }),
  OcupacaoSvo: z.object({ id, placa: z.string(), ocupacao: quantidade,
    capacidade: z.literal(4), disponivel: z.boolean() }),
  MinhasOrdensSvo: z.object({ data: z.array(linhaOrdem) }),
  MinhaOrdemSvo: linhaOrdem,
  IniciarOrdemSvo: z.strictObject({ kmInicial: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }),
  ConcluirOrdemSvo: z.strictObject({ kmFinal: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }),
  CancelarOrdemSvo: z.strictObject({}),
  OrdemExecucaoSvo: z.object({ id, status: situacaoOrdem, dataInicio: z.string().nullable(),
    dataFim: z.string().nullable(), kmInicial: quantidade.nullable(), kmFinal: quantidade.nullable() }),
};
