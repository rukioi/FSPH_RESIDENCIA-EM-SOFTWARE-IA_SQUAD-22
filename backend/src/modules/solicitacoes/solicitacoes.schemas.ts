import { z } from 'zod';
import { id, meta } from '../../shared/contract/schemas.js';
import { dataHoraInstitucionalSchema } from './solicitacoes.datas.js';

export const statusSolicitacao = z.enum(['PENDENTE', 'APROVADA', 'AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO', 'CONCLUIDA', 'REPROVADA']);
const texto = z.string().trim().min(1);
export const rejeitarSolicitacaoSchema = z.strictObject({ motivo: texto });
export const idDecisaoSchema = z.string().regex(/^[0-9]+$/).refine(value =>
  /^[0-9]{1,19}$/.test(value) && BigInt(value) <= 9223372036854775807n, 'Identificador inválido.');
export const decisaoSolicitacao = z.object({ id, status: z.enum(['APROVADA', 'REPROVADA']), motivoRejeicao: z.string().nullable() });
export const idRecursoSchema = z.string().regex(/^-?[0-9]{1,19}$/).refine(value => {
  if (!/^-?[0-9]{1,19}$/.test(value)) return false;
  const numero = BigInt(value);
  return numero >= -9223372036854775808n && numero <= 9223372036854775807n;
}, 'Identificador fora do intervalo BIGINT assinado.').describe('Inteiro em string entre -9223372036854775808 e 9223372036854775807; zero permitido, sujeito à existência do recurso.');
export const agendarSolicitacaoSchema = z.strictObject({
  motoristaId: idRecursoSchema, veiculoId: idRecursoSchema,
  dataHoraRetornoPrevisto: dataHoraInstitucionalSchema,
});
export const agendamentoSolicitacao = z.object({
  id, status: z.literal('AGENDADA'), motoristaId: id, veiculoId: id,
  dataHoraSaida: z.iso.datetime({ offset: true }), dataHoraRetornoPrevisto: z.iso.datetime({ offset: true }),
});

export const criarSolicitacaoSchema = z.strictObject({
  origem: texto.max(255),
  destino: texto.max(255),
  finalidade: texto,
  dataHoraSaida: dataHoraInstitucionalSchema,
  qtdPassageiros: z.number().int().min(1).max(2147483647),
});
export const editarSolicitacaoSchema = criarSolicitacaoSchema.partial().refine(
  value => Object.values(value).some(item => item !== undefined), 'Informe ao menos um campo para editar.').meta({minProperties:1});

export const solicitacao = z.object({
  id, codigo: z.string(), codigoExibicao: z.string(),
  solicitante: z.object({ id, nome: z.string().nullable() }).nullable(),
  origem: z.string(), destino: z.string(), finalidade: z.string().nullable(),
  dataHoraSaida: z.iso.datetime({ offset: true }),
  qtdPassageiros: z.number().int().nullable(), status: statusSolicitacao.nullable(),
});
const schemasExistentes = {
  EditarSolicitacaoViagem: editarSolicitacaoSchema,
  AgendarSolicitacaoViagem: agendarSolicitacaoSchema,
  RespostaAgendamentoSolicitacaoViagem: z.object({ data: agendamentoSolicitacao }),
  RejeitarSolicitacaoViagem: rejeitarSolicitacaoSchema,
  RespostaDecisaoSolicitacaoViagem: z.object({ data: decisaoSolicitacao }),
  CriarSolicitacaoViagem: criarSolicitacaoSchema,
  SolicitacaoViagem: solicitacao,
  RespostaSolicitacaoViagem: z.object({ data: solicitacao }),
  ListaSolicitacoesViagem: z.object({ data: z.array(solicitacao), meta }),
};

const inteiroConsulta = z.string().regex(/^[1-9][0-9]*$/).transform(Number)
  .pipe(z.number().int().safe());
export const listarSolicitacoesSchema = z.strictObject({
  page: inteiroConsulta.default(1),
  limit: inteiroConsulta.pipe(z.number().max(100)).default(20),
  status: statusSolicitacao.optional(),
}).refine(value => Number.isSafeInteger((value.page - 1) * value.limit), {
  path: ['page'], message: 'Página fora do intervalo suportado.',
});

/** Preserva duplicatas para que o schema rejeite parâmetros ambíguos. */
export function parametrosSolicitacoes(params: URLSearchParams): Record<string, unknown> {
  return Object.fromEntries([...new Set(params.keys())].map(key =>
    [key, params.getAll(key).length === 1 ? params.get(key) : params.getAll(key)]));
}

const periodo = {
  inicio: dataHoraInstitucionalSchema, fim: dataHoraInstitucionalSchema,
};
const validarPeriodo = (value: {inicio:string;fim:string}, ctx: z.RefinementCtx) => {
  const inicio = Date.parse(value.inicio); const fim = Date.parse(value.fim);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim <= inicio || fim-inicio > 31*86400000) {
    ctx.addIssue({code:'custom',path:['fim'],message:'Informe um intervalo válido de até 31 dias.'});
  }
};
export const consultarAgendaSchema = z.strictObject({
  ...periodo, page:inteiroConsulta.default(1),limit:inteiroConsulta.pipe(z.number().max(100)).default(20),
}).superRefine((value,ctx) => {
  validarPeriodo(value,ctx);
  if (!Number.isSafeInteger((value.page-1)*value.limit)) ctx.addIssue({code:'custom',path:['page'],message:'Página inválida.'});
});
export const consultarDisponibilidadeSchema = z.strictObject(periodo).superRefine(validarPeriodo);
export const reagendarSolicitacaoSchema = agendarSolicitacaoSchema.extend({dataHoraSaida:dataHoraInstitucionalSchema})
  .refine(value => Date.parse(value.dataHoraRetornoPrevisto) > Date.parse(value.dataHoraSaida), {path:['dataHoraRetornoPrevisto'],message:'Retorno deve ser posterior à saída.'});
export const itemAgenda = z.object({
  id,codigo:z.string(),codigoExibicao:z.string(),status:z.literal('AGENDADA'),
  origem:z.string(),destino:z.string(),finalidade:z.string().nullable(),qtdPassageiros:z.number().int().nullable(),
  motorista:z.object({id,nome:z.string()}).nullable(),
  veiculo:z.object({id,placa:z.string(),modelo:z.string()}).nullable(),
  dataHoraSaida:z.iso.datetime({offset:true}),dataHoraRetornoPrevisto:z.iso.datetime({offset:true}).nullable(),
});
export const respostaAgenda = z.object({data:z.array(itemAgenda),meta});
export const respostaDisponibilidade = z.object({data:z.object({
  motoristas:z.array(z.object({id,nome:z.string()})),
  veiculos:z.array(z.object({id,placa:z.string(),modelo:z.string()})),
})});
export const detalheSolicitacao=solicitacao.extend({
  motivoRejeicao:z.string().nullable(),dataHoraRetornoPrevisto:z.iso.datetime({offset:true}).nullable(),
  motorista:z.object({id,nome:z.string()}).nullable(),veiculo:z.object({id,placa:z.string(),modelo:z.string()}).nullable(),
});
export const consultarHistoricoSchema=z.strictObject({
  page:inteiroConsulta.default(1),limit:inteiroConsulta.pipe(z.number().max(100)).default(20),
}).refine(value=>Number.isSafeInteger((value.page-1)*value.limit),{path:['page'],message:'Página inválida.'});
export const itemHistorico=z.object({
  id,descricao:z.string(),dataHora:z.string().nullable().describe('Timestamp da auditoria sem fuso; não se infere UTC ou offset histórico.'),
  responsavel:z.object({id,nome:z.string().nullable()}).nullable().optional(),
});
export const respostaHistorico=z.object({data:z.array(itemHistorico),meta});
export const solicitacoesSchemas = {...schemasExistentes,
  RespostaDetalheSolicitacaoViagem:z.object({data:detalheSolicitacao}),RespostaHistoricoSolicitacaoViagem:respostaHistorico,
  ConsultarAgendaViagem:consultarAgendaSchema,ConsultarDisponibilidadeViagem:consultarDisponibilidadeSchema,
  ReagendarSolicitacaoViagem:reagendarSolicitacaoSchema,
  RespostaAgendaViagem:respostaAgenda,RespostaDisponibilidadeViagem:respostaDisponibilidade,
};
