import { documentosSchemas } from '../../../../backend/src/modules/documentos/documentos.schemas';
import { requestApi } from '../api/client';
import { parseResponse } from '../api/validation';

// A consulta legada inclui CNHs sem validade; o controller retorna null nesses casos.
const documentosConsulta = documentosSchemas.Documentos.extend({
  data: documentosSchemas.Documentos.shape.data.element.extend({
    data_validade: documentosSchemas.Documentos.shape.data.element.shape.data_validade.nullable(),
  }).array(),
});

/** Consulta documentos autorizados, preservando datas ausentes da resposta legada. */
export async function buscarDocumentos(signal?: AbortSignal) {
  return (await requestApi('/api/documentos', { signal }, value => parseResponse(documentosConsulta, value))).data;
}
