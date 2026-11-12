import { z } from 'zod';

const quilometragem=z.number().int().min(0).max(2147483647);
const quilometragemAnterior=z.number().int().min(-2147483648).max(2147483647);
/** Validação técnica da correção; a comparação com o registro ocorre na transação. */
export const corrigirQuilometragemSchema=z.strictObject({
  kmInicial:quilometragem.optional(),
  kmFinal:quilometragem.optional(),
  confirmarOdometroAtual:z.boolean().optional(),
  justificativa:z.string().trim().min(1).max(2000).refine(value=>!value.includes('\u0000'),'Texto incompatível com PostgreSQL.'),
}).superRefine((value,ctx)=>{
  if(value.confirmarOdometroAtual===true&&value.kmFinal===undefined)ctx.addIssue({code:'custom',path:['confirmarOdometroAtual'],message:'Informe a quilometragem final confirmada.'});
  if(value.kmInicial===undefined&&value.kmFinal===undefined)ctx.addIssue({code:'custom',path:['kmInicial'],message:'Informe ao menos uma quilometragem.'});
  if(value.kmInicial!==undefined&&value.kmFinal!==undefined&&value.kmFinal<value.kmInicial)ctx.addIssue({code:'custom',path:['kmFinal'],message:'A quilometragem final não pode ser inferior à inicial.'});
});

export const correcaoViagemSchema=z.object({id:z.string(),versao:z.number().int().positive(),kmInicialAnterior:quilometragemAnterior,kmFinalAnterior:quilometragemAnterior,kmInicial:quilometragem,kmFinal:quilometragem,justificativa:z.string(),autorId:z.string(),criadoEm:z.iso.datetime(),odometroAtualizado:z.boolean()});

/** Leituras antigas na tabela versionada podem conter valores nulos. */
export const itemCorrecaoViagemSchema=correcaoViagemSchema.omit({odometroAtualizado:true}).extend({kmInicialAnterior:quilometragemAnterior.nullable(),kmFinalAnterior:quilometragemAnterior.nullable(),kmInicial:quilometragem.nullable(),kmFinal:quilometragem.nullable()});
