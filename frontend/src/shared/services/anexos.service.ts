
import type { z } from 'zod';

import { anexosSchemas, tipoRegistro } from '../../../../backend/src/modules/anexos/anexos.schemas';

import { requestApi } from '../api/client';
import { ApiError, apiError } from '../api/errors';
import { fetchAutenticada } from './auth.service';
import { parseResponse } from '../api/validation';

// Tipos aceitos pelo backend.
export type TipoRegistroAnexo = z.infer<typeof tipoRegistro>;

export type VinculoAnexo = {
  tipoRegistro: TipoRegistroAnexo;
  registroId: string;
};

export type Anexo = z.infer<typeof anexosSchemas.MetadadosAnexo>;

export type FiltrosAnexos = VinculoAnexo & {
  page?: number;
  limit?: number;
};

// Limites definidos pelo backend.
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

/** Valida o arquivo antes de enviá-lo. O backend também valida os bytes. */
function validarArquivo(arquivo: File): void {
  if (!arquivo.name.trim()) {
    throw new ApiError(400, 'NOME_INVALIDO', 'Informe um nome válido para o arquivo.');
  }

  if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
    throw new ApiError(415, 'TIPO_NAO_SUPORTADO', 'Envie um arquivo PDF, JPG ou PNG.');
  }

  if (arquivo.size === 0) {
    throw new ApiError(400, 'ARQUIVO_VAZIO', 'O arquivo selecionado está vazio.');
  }

  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new ApiError(413, 'CORPO_MUITO_GRANDE', 'O arquivo deve ter no máximo 5 MiB.');
  }
}

/** Monta os parâmetros de consulta dos anexos. */
function criarQuery(filtros: FiltrosAnexos): string {
  const params = new URLSearchParams({
    tipoRegistro: filtros.tipoRegistro,
    registroId: filtros.registroId,
  });

  if (filtros.page !== undefined) {
    params.set('page', String(filtros.page));
  }

  if (filtros.limit !== undefined) {
    params.set('limit', String(filtros.limit));
  }

  return params.toString();
}

/** Envia um anexo vinculado a um registro autorizado pelo backend. */
export async function enviarAnexo(
  vinculo: VinculoAnexo,
  arquivo: File,
) {
  validarArquivo(arquivo);

  const formulario = new FormData();

  formulario.append('tipoRegistro', vinculo.tipoRegistro);
  formulario.append('registroId', vinculo.registroId);
  formulario.append('arquivo', arquivo);

  const resposta = await requestApi(
    '/api/anexos',
    {
      method: 'POST',
      body: formulario,
    },
    valor => parseResponse(anexosSchemas.RespostaAnexo, valor),
  );

  return resposta.data;
}

/** Lista os anexos de um registro, sem expor arquivos de outros registros. */
export async function listarAnexos(filtros: FiltrosAnexos) {
  const resposta = await requestApi(
    `/api/anexos?${criarQuery(filtros)}`,
    { method: 'GET' },
    valor => parseResponse(anexosSchemas.ListaAnexos, valor),
  );

  return resposta;
}

/** Baixa os bytes de um anexo usando a sessão autenticada. */
export async function baixarAnexo(
  id: string,
  signal?: AbortSignal,
): Promise<Blob> {
  let resposta: Response;

  try {
    resposta = await fetchAutenticada(
      `/api/anexos/${encodeURIComponent(id)}`,
      { method: 'GET', signal },
    );
  } catch (error) {
    if (
      error instanceof ApiError ||
      error instanceof Error && error.name === 'AbortError'
    ) {
      throw error;
    }

    throw new ApiError(
      0,
      'FALHA_REDE',
      'Não foi possível baixar o anexo. Tente novamente.',
    );
  }

  if (signal?.aborted) {
    throw new DOMException('Solicitação cancelada.', 'AbortError');
  }

  if (!resposta.ok) {
    let corpo: unknown;

    try {
      corpo = await resposta.json();
    } catch {
      // Algumas respostas de erro podem não conter JSON.
    }

    throw apiError(
      resposta.status,
      corpo,
      resposta.headers.get('X-Request-Id') ?? undefined,
    );
  }

  const tipo = resposta.headers
    .get('Content-Type')
    ?.split(';')[0]
    .trim()
    .toLowerCase();

  if (!tipo || !TIPOS_PERMITIDOS.includes(tipo)) {
    throw new ApiError(
      resposta.status,
      'RESPOSTA_INVALIDA',
      'O arquivo recebido possui um formato inválido.',
    );
  }

  let arquivo: Blob;

  try {
    arquivo = await resposta.blob();
  } catch (error) {
    if (
      signal?.aborted ||
      error instanceof Error && error.name === 'AbortError'
    ) {
      throw new DOMException('Solicitação cancelada.', 'AbortError');
    }

    throw new ApiError(
      0,
      'FALHA_REDE',
      'Não foi possível baixar o anexo. Tente novamente.',
    );
  }

  if (signal?.aborted) {
    throw new DOMException('Solicitação cancelada.', 'AbortError');
  }

  if (!arquivo.size || arquivo.size > TAMANHO_MAXIMO) {
    throw new ApiError(
      resposta.status,
      'RESPOSTA_INVALIDA',
      'O arquivo recebido está vazio ou ultrapassa o limite permitido.',
    );
  }

  return arquivo;
}
