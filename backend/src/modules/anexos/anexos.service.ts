import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sql } from '../../database/connection.js';
import type { UsuarioAutenticado } from '../../security/jwt.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { ErroCorpoRequisicao } from '../../shared/http/body.js';
import { registrarAtividades } from '../auditoria/auditoria.service.js';
import { receberUpload, type ArquivoDocumento } from '../documentos/documentos.upload.js';
import { anexosSchemas, consultaAnexos, registroId, vinculoAnexo, type VinculoRegistro } from './anexos.schemas.js';
import { gravarAnexo, limiteAnexoBytes, metadadosAnexoSql, nomeValidoAnexo, type LinhaAnexo } from './anexos.repository.js';
import { autorizarRegistro, conferirPerfilRegistro, registros, registroAusente } from './registros.acesso.js';

const invalido = () => new ErroHttp(400, 'DADOS_INVALIDOS', 'Confira o tipo de registro, identificador e campos do upload.');
function vinculoDaLinha(linha: LinhaAnexo): VinculoRegistro {
  const entry = Object.entries(registros).find(([, r]) => linha[r.coluna] != null);
  if (!entry) throw new Error('Vínculo persistido ausente.');
  return vinculoAnexo.parse({ tipoRegistro: entry[0], registroId: linha[entry[1].coluna] });
}
const dto = (linha: LinhaAnexo) => anexosSchemas.MetadadosAnexo.parse({ id: linha.id, nome: linha.nome,
  tipo: linha.tipo, tamanho: linha.tamanho, sha256: linha.sha256, autorId: linha.autor_id,
  criadoEm: linha.criado_em.toISOString(), ...vinculoDaLinha(linha) });

/** Valida query estrita e rejeita parâmetros duplicados antes da paginação. */
export function lerConsultaRegistro(params: URLSearchParams) {
  for (const key of params.keys()) if (params.getAll(key).length !== 1) throw invalido();
  for (const key of ['page', 'limit']) if (params.has(key) && !/^[1-9]\d*$/.test(params.get(key)!)) throw invalido();
  const result = consultaAnexos.safeParse(Object.fromEntries(params));
  if (!result.success) throw invalido();
  return result.data;
}

/** Reutiliza o parser limitado; metadados privados nunca são copiados para logs. */
export async function lerAnexo(req: IncomingMessage, fixo?: VinculoRegistro) {
  if (fixo && !vinculoAnexo.safeParse(fixo).success) { req.resume(); throw registroAusente(); }
  if (!/^multipart\/form-data(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
    req.resume(); throw new ErroHttp(415, 'TIPO_NAO_SUPORTADO', 'Envie o arquivo como multipart/form-data.');
  }
  let upload;
  try { upload = await receberUpload(req, { estrito: true }); }
  catch (error) {
    if (error instanceof ErroHttp || error instanceof ErroCorpoRequisicao) throw error;
    throw new ErroHttp(400, 'UPLOAD_INVALIDO', 'Envie um único arquivo e os campos esperados.');
  }
  // No comprovante, somente o caminho define o vínculo; campos extras são rejeitados.
  const entrada = (fixo ? anexosSchemas.CriarComprovante : vinculoAnexo).safeParse(upload.campos);
  if (!entrada.success) throw invalido();
  const vinculo = vinculoAnexo.parse(fixo ?? entrada.data);
  validarArquivo(upload.arquivo);
  return { vinculo, arquivo: upload.arquivo };
}

/** Confere nome e assinatura contra MIME; não usa nomes recebidos como caminhos. */
function validarArquivo(arquivo: ArquivoDocumento) {
  const { nome, tipo, conteudo } = arquivo;
  if (!nomeValidoAnexo(nome)) {
    throw new ErroHttp(400, 'NOME_INVALIDO', 'Informe um nome de arquivo sem caminhos ou caracteres de controle.');
  }
  if (conteudo.length > limiteAnexoBytes) throw new ErroHttp(413, 'CORPO_MUITO_GRANDE', 'O arquivo deve ter no máximo 5 MiB.');
  const assinaturas: Record<string, Buffer> = { 'application/pdf': Buffer.from('%PDF-'),
    'image/png': Buffer.from('89504e470d0a1a0a', 'hex'), 'image/jpeg': Buffer.from('ffd8ff', 'hex') };
  const assinatura = assinaturas[tipo];
  if (!assinatura || !conteudo.subarray(0, assinatura.length).equals(assinatura)) {
    throw new ErroHttp(415, 'ARQUIVO_INVALIDO', 'O conteúdo não corresponde a PDF, JPEG ou PNG válido.');
  }
}

/** Confirma bytes, vínculo, autor e auditoria juntos; falha reverte tudo, sem blob órfão. */
export async function salvarAnexo(usuario: UsuarioAutenticado, vinculo: VinculoRegistro, arquivo: ArquivoDocumento) {
  validarArquivo(arquivo);
  conferirPerfilRegistro(usuario, vinculo.tipoRegistro);
  return sql.begin(async tx => {
    await autorizarRegistro(tx, usuario, vinculo);
    const linha = await gravarAnexo(tx, vinculo, usuario.id, arquivo, limiteAnexoBytes);
    await registrarAtividades(tx, usuario.id, [{ operacao: 'anexo_criado', recursoId: linha.id }]);
    return { data: dto(linha) };
  });
}

/** Lista somente metadados do registro autorizado, com página/total no mesmo snapshot. */
export async function listarAnexos(usuario: UsuarioAutenticado, params: URLSearchParams) {
  const q = lerConsultaRegistro(params);
  return sql.begin('isolation level repeatable read', async tx => {
    await autorizarRegistro(tx, usuario, q);
    const coluna = tx(registros[q.tipoRegistro].coluna);
    const rows = await tx<LinhaAnexo[]>`SELECT ${metadadosAnexoSql(tx)} FROM public.anexo WHERE ${coluna}=${q.registroId}
      ORDER BY criado_em DESC,id DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`;
    const [total] = await tx`SELECT count(*)::int AS n FROM public.anexo WHERE ${coluna}=${q.registroId}`;
    return anexosSchemas.ListaAnexos.parse({ data: rows.map(dto), meta: { page: q.page, limit: q.limit, total: total.n } });
  });
}

/** Lê bytes só depois de autorizar o registro; ID não é credencial de download. */
export async function consultarAnexo(usuario: UsuarioAutenticado, id: string) {
  if (!registroId.safeParse(id).success) throw registroAusente();
  return sql.begin(async tx => {
    const [linha] = await tx<LinhaAnexo[]>`SELECT ${metadadosAnexoSql(tx)} FROM public.anexo WHERE id=${id}`;
    if (!linha) throw registroAusente();
    await autorizarRegistro(tx, usuario, vinculoDaLinha(linha));
    const [conteudo] = await tx<{ dados: Buffer }[]>`SELECT dados FROM public.anexo WHERE id=${id}`;
    return { tipo: linha.tipo, dados: conteudo.dados };
  });
}

/** Obtém o último arquivo confirmado do registro autorizado, sem substituir o histórico. */
export async function consultarUltimoAnexo(usuario: UsuarioAutenticado, vinculo: VinculoRegistro) {
  if (!vinculoAnexo.safeParse(vinculo).success) throw registroAusente();
  return sql.begin(async tx => {
    await autorizarRegistro(tx, usuario, vinculo);
    const [arquivo] = await tx<{ tipo: string; dados: Buffer }[]>`
      SELECT tipo,dados FROM public.anexo WHERE ${tx(registros[vinculo.tipoRegistro].coluna)}=${vinculo.registroId}
      ORDER BY criado_em DESC,id DESC LIMIT 1`;
    return arquivo;
  });
}

/** Streaming com backpressure, sem nome recebido no header nem cache/URL pública. */
export async function enviarArquivo(res: ServerResponse, arquivo: { tipo: string; dados: Buffer }) {
  res.setHeader('Content-Type', arquivo.tipo);
  res.setHeader('Content-Length', arquivo.dados.length);
  res.setHeader('Content-Disposition', 'attachment; filename="arquivo"');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  function* blocos() { for (let i = 0; i < arquivo.dados.length; i += 65536) yield arquivo.dados.subarray(i, i + 65536); }
  await pipeline(Readable.from(blocos()), res);
}
