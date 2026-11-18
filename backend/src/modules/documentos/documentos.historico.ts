import type postgres from 'postgres';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
export type TipoDocumental='DOCUMENTO_VEICULO'|'CNH_MOTORISTA';
export const alvoDocumental=(tipo:TipoDocumental)=>tipo==='CNH_MOTORISTA'
  ? {tabela:'motorista',coluna:'motorista_id'} as const : {tabela:'documento_veiculo',coluna:'documento_veiculo_id'} as const;

/** Chamador deve bloquear o cadastro. Acrescenta somente snapshot real, sem preencher passado. */
export async function registrarVersaoDocumental(tx:postgres.TransactionSql,tipo:TipoDocumental,id:string,autorId:string,anexoId:string|null=null){
  const {coluna}=alvoDocumental(tipo);
  const [ultima]=await tx`SELECT coalesce(max(versao),0)::int AS v FROM public.documento_historico WHERE ${tx(coluna)}=${id}`;
  if(tipo==='CNH_MOTORISTA')await tx`INSERT INTO public.documento_historico
    (motorista_id,versao,numero_cnh,categoria_cnh,data_vencimento,autor_id,anexo_id)
    SELECT id,${ultima.v+1},cnh,categoria_cnh,validade_cnh,${autorId},${anexoId} FROM public.motorista WHERE id=${id}`;
  else await tx`INSERT INTO public.documento_historico
    (documento_veiculo_id,versao,tipo_documento,data_vencimento,status_regular,autor_id,anexo_id)
    SELECT id,${ultima.v+1},tipo_documento,data_vencimento,status_regular,${autorId},${anexoId} FROM public.documento_veiculo WHERE id=${id}`;
  await registrarAtividades(tx,autorId,[{operacao:tipo==='CNH_MOTORISTA'?'cnh_versionada':'documento_versionado',recursoId:id}]);
}
