import type postgres from 'postgres';
import { ErroHttp } from '../../shared/http/errors.js';
import { evidenciaEntradaSchema } from './viagens.evidencias.schemas.js';

/**
 * Persiste uma versão dentro da transação do chamador. Não é uma operação HTTP:
 * o chamador deve autorizar perfil, vínculo e estado na mesma transação antes
 * de chamar esta função.
 */
export async function inserirVersaoEvidencia(tx:postgres.TransactionSql,viagemId:string,autorId:string,entrada:unknown) {
  const validada=evidenciaEntradaSchema.safeParse(entrada);
  if(!validada.success) throw new ErroHttp(400,'ARQUIVO_INVALIDO','Envie uma imagem JPEG ou PNG válida de até 1 MiB.');
  const dados=validada.data;
  const [viagem]=await tx`SELECT id FROM public.viagem WHERE id=${viagemId} FOR UPDATE`;
  if(!viagem)throw new ErroHttp(404,'NAO_ENCONTRADO','Viagem não encontrada.');
  const [atual]=await tx`SELECT COALESCE(MAX(versao),0)::int AS versao FROM public.viagem_evidencia WHERE viagem_id=${viagemId} AND momento=${dados.momento}`;
  if(atual.versao>=2147483647)throw new ErroHttp(409,'LIMITE_VERSOES','Limite de versões atingido.');
  const bytes=Buffer.from(dados.dadosBase64,'base64');
  const [row]=await tx`INSERT INTO public.viagem_evidencia(viagem_id,momento,versao,nome,tipo,dados,enviado_por_id)
    VALUES (${viagemId},${dados.momento},${atual.versao+1},${dados.nome},${dados.tipo},${bytes},${autorId})
    RETURNING id::text,momento,versao,nome,tipo,enviado_por_id::text AS "enviadoPorId",to_char(criado_em AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')||'Z' AS "criadoEm"`;
  return row;
}
