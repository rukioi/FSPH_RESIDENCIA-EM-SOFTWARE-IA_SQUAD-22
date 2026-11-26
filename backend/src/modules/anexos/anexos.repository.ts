import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { ErroHttp } from '../../shared/http/errors.js';
import type { ArquivoDocumento } from '../documentos/documentos.upload.js';
import type { VinculoRegistro } from './anexos.schemas.js';
import { registros } from './registros.acesso.js';

export const limiteAnexoBytes = 5 * 1024 * 1024;
const colunas = Object.values(registros).map(registro => registro.coluna);
export const metadadosAnexoSql = (tx: postgres.TransactionSql) =>
  tx`id,nome,tipo,tamanho,sha256,autor_id,criado_em,${tx(colunas)}`;
export type LinhaAnexo = { id: string; nome: string; tipo: string; tamanho: number; sha256: string;
  autor_id: string; criado_em: Date } & Partial<Record<typeof colunas[number], string | null>>;

/** Critérios de nome do upload compartilhado, preservados na entrada HTTP. */
export function nomeValidoAnexo(nome: string) {
  return nome.length <= 255 && Boolean(nome.trim()) && !/[/\\]/u.test(nome)
    && ![...nome].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) && !['.', '..'].includes(nome);
}

/** Grava os bytes validados na transação do domínio, após autorização e bloqueio do registro. */
export async function gravarAnexo(tx: postgres.TransactionSql, vinculo: VinculoRegistro,
  autorId: string, arquivo: ArquivoDocumento, limiteBytes: number) {
  const { nome, tipo, conteudo } = arquivo;
  if (conteudo.length > Math.min(limiteBytes, limiteAnexoBytes)) {
    throw new ErroHttp(413, 'CORPO_MUITO_GRANDE', 'O arquivo excede o limite desta operação.');
  }
  const registro = {
    [registros[vinculo.tipoRegistro].coluna]: vinculo.registroId,
    nome, tipo, dados: conteudo, tamanho: conteudo.length,
    sha256: createHash('sha256').update(conteudo).digest('hex'), autor_id: autorId,
  };
  const [linha] = await tx<LinhaAnexo[]>`INSERT INTO public.anexo ${tx(registro)} RETURNING ${metadadosAnexoSql(tx)}`;
  return linha;
}
