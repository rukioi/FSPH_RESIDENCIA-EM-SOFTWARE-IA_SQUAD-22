import { expect, test } from 'vitest';
import { openapi } from '../../src/shared/contract/openapi.js';
import { anexosSchemas } from '../../src/modules/anexos/anexos.schemas.js';
import type { ApiOperations } from '../../../frontend/src/shared/api/generated/schema.js';

test('upload compartilhado publica multipart estrito, perfil, limite e erros reais', () => {
  const doc = openapi();
  expect(doc.paths['/api/anexos'].post).toMatchObject({ security: [{ bearerAuth: [] }],
    'x-runtime-validation': true,
    requestBody: { content: { 'multipart/form-data': { schema: {
      additionalProperties: false, required: ['tipoRegistro','registroId','arquivo'],
      properties: { arquivo: { type:'string',format:'binary' }, tipoRegistro: { enum: expect.arrayContaining(['VIAGEM','ORDEM_SVO']) } },
    } } } }, responses: {201:{},400:{},401:{},403:{},404:{},413:{},415:{},500:{}} });
  expect(doc.paths['/api/anexos'].post).not.toHaveProperty('requestBody.content.application/json');
});
test('cliente gerado identifica multipart como FormData e download como Blob', () => {
  const body: ApiOperations['anexos_post__api_anexos']['body'] = new FormData();
  const response: ApiOperations['anexos_get__api_anexos_id_']['response'] = new Blob();
  expect(body).toBeInstanceOf(FormData);
  expect(response).toBeInstanceOf(Blob);
});
test('download autenticado é binário; lista não expõe bytes ou URL pública', () => {
  const doc = openapi();
  expect(doc.paths['/api/anexos/{id}'].get).toMatchObject({ security: [{bearerAuth:[]}],
    responses: {200:{content:{'application/pdf':{schema:{format:'binary'}},'image/jpeg':{},'image/png':{}}},401:{},403:{},404:{}} });
  expect(doc.paths['/api/anexos/{id}']).not.toHaveProperty('delete');
  expect(doc.components.schemas.MetadadosAnexo.properties).not.toHaveProperty('dados');
  expect(doc.components.schemas.MetadadosAnexo.properties).not.toHaveProperty('url');
  expect(anexosSchemas.CriarAnexo.safeParse({tipoRegistro:'VEICULO',registroId:'1 OR 1=1'}).success).toBe(false);
});
