import {expect,test} from 'vitest';
import {openapi} from '../../src/shared/contract/openapi.js';
import {anotacoesSchemas} from '../../src/modules/anotacoes/anotacoes.schemas.js';
import type {ApiOperations} from '../../../frontend/src/shared/api/generated/schema.js';

test('notas publicam autoria de saída e vínculo estrito, sem aceitar HTML como transporte',()=>{
  const doc=openapi();
  expect(doc.paths['/api/anotacoes'].post).toMatchObject({security:[{bearerAuth:[]}],responses:{201:{},400:{},401:{},403:{},404:{}}});
  expect(doc.paths['/api/anotacoes']).not.toHaveProperty('delete');
  const body:ApiOperations['anotacoes_post__api_anotacoes']['body']={tipoRegistro:'ORDEM_SVO',registroId:'123',texto:'Texto simples'};
  expect(anotacoesSchemas.CriarAnotacao.safeParse(body).success).toBe(true);
  expect(anotacoesSchemas.CriarAnotacao.safeParse({...body,autorId:'2'}).success).toBe(false);
});
