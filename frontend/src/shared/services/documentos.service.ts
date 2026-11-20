
import { z } from 'zod';

import { documentosSchemas } from '../../../../backend/src/modules/documentos/documentos.schemas';
import {
  alterarDocumento,
  gestaoDocumentalSchemas,
  tipoDocumental,
} from '../../../../backend/src/modules/documentos/documentos.gestao.schemas';

import { requestApi } from '../api/client';
import { parseResponse } from '../api/validation';

// Compatibilidade com a listagem antiga, que pode retornar CNHs sem validade.
const documentosConsulta = documentosSchemas.Documentos.extend({
  data: documentosSchemas.Documentos.shape.data.element.extend({
    data_validade: documentosSchemas.Documentos.shape.data.element.shape.data_validade.nullable(),
  }).array(),
});

// Tipos derivados dos contratos do backend.
export type DocumentoGestao = z.infer<
  typeof gestaoDocumentalSchemas.DocumentoAtual
>;

export type ListaDocumentos = z.infer<
  typeof gestaoDocumentalSchemas.ListaDocumental
>;

export type DetalheDocumento = z.infer<
  typeof gestaoDocumentalSchemas.DetalheDocumental
>;

export type HistoricoDocumento = z.infer<
  typeof gestaoDocumentalSchemas.HistoricoDocumental
>;

export type FiltrosDocumentos = {
  tipo?: TipoDocumento;
  veiculoId?: string;
  motoristaId?: string;
  situacao?: 'VENCIDO' | 'HOJE' | 'A_VENCER';
  inicio?: string;
  fim?: string;
  page?: number;
  limit?: number;
};

export type TipoDocumento = z.infer<typeof tipoDocumental>;

export type DadosEdicaoDocumento = z.infer<typeof alterarDocumento>;

/** Consulta a listagem antiga, mantendo compatibilidade com telas existentes. */
export async function buscarDocumentos(signal?: AbortSignal) {
  return (
    await requestApi(
      '/api/documentos',
      { signal },
      value => parseResponse(documentosConsulta, value),
    )
  ).data;
}

/** Monta os parâmetros da consulta sem enviar valores indefinidos. */
function montarParametros(
  parametros: Record<string, string | number | undefined>,
): URLSearchParams {
  const query = new URLSearchParams();

  Object.entries(parametros).forEach(([chave, valor]) => {
    if (valor !== undefined) {
      query.set(chave, String(valor));
    }
  });

  return query;
}

/** Consulta documentos e CNHs com filtros e paginação. */
export async function consultarDocumentos(
  filtros: FiltrosDocumentos = {},
  signal?: AbortSignal,
): Promise<ListaDocumentos> {
  const query = montarParametros(filtros);

  return requestApi(
    `/api/documentos/consulta?${query.toString()}`,
    { signal },
    value => parseResponse(gestaoDocumentalSchemas.ListaDocumental, value),
  );
}

/** Consulta as pendências de vencimento. */
export async function buscarPendenciasDocumentos(signal?: AbortSignal) {
  return requestApi(
    '/api/documentos/pendencias',
    { signal },
    value => parseResponse(documentosSchemas.PendenciasDocumentos, value),
  );
}

/** Consulta os detalhes de um documento ou CNH. */
export async function buscarDetalheDocumento(
  id: string,
  tipo: TipoDocumento,
  signal?: AbortSignal,
): Promise<DetalheDocumento> {
  const query = montarParametros({ tipo });

  return requestApi(
    `/api/documentos/${encodeURIComponent(id)}?${query.toString()}`,
    { signal },
    value => parseResponse(gestaoDocumentalSchemas.DetalheDocumental, value),
  );
}

/** Consulta o histórico de versões de um documento ou CNH. */
export async function buscarHistoricoDocumento(
  id: string,
  tipo: TipoDocumento,
  pagina = 1,
  limite = 20,
  signal?: AbortSignal,
): Promise<HistoricoDocumento> {
  const query = montarParametros({
    tipo,
    page: pagina,
    limit: limite,
  });

  return requestApi(
    `/api/documentos/${encodeURIComponent(id)}/historico?${query.toString()}`,
    { signal },
    value => parseResponse(gestaoDocumentalSchemas.HistoricoDocumental, value),
  );
}

/** Atualiza um documento respeitando o controle de versão do backend. */
export async function editarDocumento(
  id: string,
  tipo: TipoDocumento,
  dados: DadosEdicaoDocumento,
  signal?: AbortSignal,
): Promise<DetalheDocumento> {
  const query = montarParametros({ tipo });

  return requestApi(
    `/api/documentos/${encodeURIComponent(id)}?${query.toString()}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dados),
      signal,
    },
    value => parseResponse(gestaoDocumentalSchemas.DetalheDocumental, value),
  );
}
