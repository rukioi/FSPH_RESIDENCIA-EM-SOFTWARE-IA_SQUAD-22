import { z } from 'zod';
import { id, timestamp, dados, sucessoExclusao } from '../../shared/contract/schemas.js';

const texto = z.string().regex(/\S/, 'DADOS_INVALIDOS|Informe um texto válido.');
export const tipoVeiculo = z.enum(['PASSEIO', 'VAN', 'AMBULANCIA', 'RABECÃO_SVO']);
export const statusVeiculo = z.enum(['DISPONIVEL', 'EM_VIAGEM', 'EM_MANUTENCAO', 'INDISPONIVEL']);
const vinculo = z.enum(['PROPRIO', 'LOCADO']);
const mensagemStatus = 'STATUS_INVALIDO|Status inválido. Utilize DISPONIVEL, EM_VIAGEM, EM_MANUTENCAO ou INDISPONIVEL.';
const fornecedor = texto.nullish();
export const veiculo = z.object({
  id, placa: z.string(), modelo: z.string(), marca: z.string(), ano: z.number().int(), tipo: tipoVeiculo,
  capacidade_obitos: z.number().int().nullable(), quilometragem_atual: z.number().int().nullable(),
  status: statusVeiculo.nullable(), is_svo: z.boolean().nullable(), criado_em: timestamp.nullable(),
  capacidade_passageiros: z.number().int().nullable(), vinculo, fornecedor_locacao: z.string().nullable(),
});
const baseCriacao = z.object({
  placa: texto, modelo: texto, marca: texto, ano: z.number().int().min(1900).max(2100),
  tipo: tipoVeiculo.nullish(), status: statusVeiculo.optional(), vinculo: vinculo.nullish(), fornecedor_locacao: fornecedor,
  capacidade_obitos: z.number().multipleOf(1).min(0).nullish(),
  capacidade_passageiros: z.number().multipleOf(1).positive().nullish(), quilometragem_atual: z.number().min(0).nullish(),
  is_svo: z.boolean().nullish(),
}).describe('Campos extras ignorados. Valores null dos opcionais usam defaults, exceto status. LOCADO exige fornecedor não vazio. Quilometragem decimal passa pela validação atual, mas pode ser recusada pelo INTEGER no banco.');
const baseEdicao = z.object({
  placa: texto.optional(), marca: texto.optional(), modelo: texto.optional(), status: statusVeiculo.optional(),
  capacidade_passageiros: z.number().multipleOf(1).positive().optional(), vinculo: vinculo.optional(), fornecedor_locacao: fornecedor,
}).describe('PUT e PATCH são parciais; demais campos são ignorados. LOCADO explícito exige fornecedor no mesmo corpo. PROPRIO limpa fornecedor; null não limpa fornecedor de LOCADO.');
const exigirFornecedor = (valor: { vinculo?: string | null; fornecedor_locacao?: string | null }, ctx: z.RefinementCtx) => {
  if (valor.vinculo === 'LOCADO' && !valor.fornecedor_locacao?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['fornecedor_locacao'], message: 'FORNECEDOR_OBRIGATORIO|Informe o fornecedor de locação para veículos locados.' });
  }
};
const condicaoFornecedor = { allOf: [{ if: { properties: { vinculo: { const: 'LOCADO' } }, required: ['vinculo'] },
  then: { properties: { fornecedor_locacao: { type: 'string', pattern: '\\S' } }, required: ['fornecedor_locacao'] } }] };
export const criarVeiculoSchema = baseCriacao.superRefine(exigirFornecedor).meta(condicaoFornecedor);
export const editarVeiculoSchema = baseEdicao.superRefine(exigirFornecedor).meta(condicaoFornecedor);
export const respostaVeiculo = dados(veiculo);
export const listaVeiculos = dados(z.array(veiculo));
export const veiculosSchemas = { Veiculo: veiculo, CriarVeiculo: criarVeiculoSchema, EditarVeiculo: editarVeiculoSchema,
  RespostaVeiculo: respostaVeiculo, ListaVeiculos: listaVeiculos, ExclusaoVeiculo: sucessoExclusao };

/** Converte somente falhas conhecidas de validação, sem expor entrada ou detalhes internos. */
export function erroValidacaoVeiculo(error: z.ZodError, criacao: boolean, body?: unknown) {
  const issue = error.issues[0];
  const campo = String(issue.path[0] ?? '');
  const precedenciaFornecedor = campo === 'fornecedor_locacao' || (criacao && ['capacidade_obitos','capacidade_passageiros','quilometragem_atual','is_svo'].includes(campo));
  if (precedenciaFornecedor && body && typeof body === 'object' && 'vinculo' in body && body.vinculo === 'LOCADO') {
    const value = 'fornecedor_locacao' in body ? body.fornecedor_locacao : undefined;
    if (typeof value !== 'string' || !value.trim()) return { code: 'FORNECEDOR_OBRIGATORIO', message: criacao
      ? 'Informe o fornecedor de locação para veículos locados.' : 'Informe o fornecedor ao alterar o vínculo para LOCADO.' };
  }
  if (!campo) return { code: 'DADOS_INVALIDOS', message: 'Envie um objeto JSON válido.' };
  if (issue.message.includes('|')) {
    const [code, message] = issue.message.split('|');
    if (code === 'FORNECEDOR_OBRIGATORIO') return { code, message: criacao ? message : 'Informe o fornecedor ao alterar o vínculo para LOCADO.' };
  }
  if (campo === 'status') { const [code, message] = mensagemStatus.split('|'); return { code, message }; }
  if (campo === 'tipo') return { code: 'TIPO_INVALIDO', message: 'Tipo inválido. Utilize PASSEIO, VAN, AMBULANCIA ou RABECÃO_SVO.' };
  if (campo === 'vinculo') return { code: 'VINCULO_INVALIDO', message: 'O vínculo deve ser PROPRIO ou LOCADO.' };
  if (campo === 'fornecedor_locacao') return { code: 'FORNECEDOR_INVALIDO', message: 'Informe um fornecedor de locação válido.' };
  if (!criacao && campo === 'capacidade_passageiros') return { code: 'CAPACIDADE_INVALIDA', message: 'A capacidade de passageiros deve ser um número inteiro maior que zero.' };
  return { code: 'DADOS_INVALIDOS', message: ['placa', 'modelo', 'marca', 'ano'].includes(campo)
    ? criacao ? 'Informe placa, modelo, marca e ano válidos.' : 'Placa, marca ou modelo inválidos.'
    : 'Capacidade, quilometragem ou indicação SVO inválida.' };
}
