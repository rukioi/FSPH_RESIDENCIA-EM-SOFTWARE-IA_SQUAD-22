import { z } from 'zod';
import { corrigirQuilometragemSchema,correcaoViagemSchema,itemCorrecaoViagemSchema } from './viagens.correcao.schemas.js';
import { evidenciaArquivoSchema } from './viagens.evidencias.schemas.js';
import { meta } from '../../shared/contract/schemas.js';
import { idRecursoSchema, idDecisaoSchema } from '../solicitacoes/solicitacoes.schemas.js';
import { dataHoraInstitucionalSchema, intervaloTemporalValido } from '../solicitacoes/solicitacoes.datas.js';

export const criarViagemSchema = z.strictObject({solicitacaoId:idDecisaoSchema});
export const statusViagemSchema = z.enum(['AGENDADA', 'EM_TRANSPORTE', 'CONCLUIDA', 'CANCELADA']);
const inteiro = z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().safe());
export const consultaMinhasViagens = z.strictObject({
  page: inteiro.default(1), limit: inteiro.pipe(z.number().max(100)).default(20), status: statusViagemSchema.optional(),
}).refine(value => Number.isSafeInteger((value.page - 1) * value.limit));
export const viagemMotorista = z.object({
  id: z.string(), solicitacaoId: z.string(), codigo: z.string(), origem: z.string().nullable(),
  destino: z.string().nullable(), status: statusViagemSchema.nullable(), kmInicial: z.number().int().nullable(), kmFinal: z.number().int().nullable(),
});
export const executarViagemSchema = z.strictObject({ quilometragem: z.number().int().min(0).max(2147483647), foto:evidenciaArquivoSchema });
export const execucaoViagemSchema = z.object({ id:z.string(), status:z.enum(['EM_TRANSPORTE','CONCLUIDA']), kmInicial:z.number().int(), kmFinal:z.number().int().nullable(), dataInicio:z.string(), dataFim:z.string().nullable() });
export const validacaoViagemSchema = z.object({ id:z.string(), status:z.literal('CONCLUIDA'), validadaPorId:z.string(), validadaEm:z.iso.datetime() });
export const consultaViagensSchema = z.strictObject({ page:inteiro.default(1),limit:inteiro.pipe(z.number().max(100)).default(20),status:statusViagemSchema.optional(),motoristaId:idRecursoSchema.optional(),inicio:dataHoraInstitucionalSchema.optional(),fim:dataHoraInstitucionalSchema.optional() }).refine(v=>Number.isSafeInteger((v.page-1)*v.limit) && (!v.inicio||!v.fim||intervaloTemporalValido(v.inicio,v.fim)));
export const consultaHistoricoViagemSchema = z.strictObject({ page:inteiro.default(1),limit:inteiro.pipe(z.number().max(100)).default(20) }).refine(v=>Number.isSafeInteger((v.page-1)*v.limit));
export const detalheViagemSchema = viagemMotorista.extend({ finalidade:z.string().nullable(), qtdPassageiros:z.number().int().nullable(), dataHoraSaida:z.string().nullable(), dataHoraRetornoPrevisto:z.string().nullable(), dataInicio:z.string().nullable(), dataFim:z.string().nullable(), motorista:z.object({id:z.string(),nome:z.string().nullable()}).nullable(), veiculo:z.object({id:z.string(),placa:z.string().nullable(),modelo:z.string().nullable()}).nullable(), validadaPorGestor:z.boolean().nullable(), validadaEm:z.string().nullable() });
export const eventoViagemSchema = z.object({id:z.string(),descricao:z.string(),dataHora:z.string().nullable()});
export const viagensSchemas = { CriarViagem:criarViagemSchema, CorrigirQuilometragem:corrigirQuilometragemSchema, RespostaCorrecaoViagem:z.object({data:correcaoViagemSchema}), ListaCorrecoesViagem:z.object({data:z.array(itemCorrecaoViagemSchema),meta}), ListaViagens:z.object({data:z.array(detalheViagemSchema),meta}), DetalheViagem:z.object({data:detalheViagemSchema}), HistoricoViagem:z.object({data:z.array(eventoViagemSchema),meta}), ValidacaoViagem:z.object({data:validacaoViagemSchema}), ListaMinhasViagens: z.object({ data: z.array(viagemMotorista), meta }), ExecutarViagem: executarViagemSchema, RespostaExecucaoViagem:z.object({data:execucaoViagemSchema}) };
