import {expect,test} from 'vitest';
import {openapi} from '../../src/shared/contract/openapi.js';
import {gestaoDocumentalSchemas} from '../../src/modules/documentos/documentos.gestao.schemas.js';
import {anotacoesSchemas} from '../../src/modules/anotacoes/anotacoes.schemas.js';
import type {ApiOperations} from '../../../frontend/src/shared/api/generated/schema.js';

test('documentos/CNH publicam versão obrigatória, datas civis e escopo ADM/Gestor',()=>{
  const doc=openapi();
  expect(doc.paths['/api/documentos/{id}'].patch).toMatchObject({'x-perfis':['ADM','GESTOR_FROTA'],
    requestBody:{content:{'application/json':{schema:{$ref:'#/components/schemas/AlterarDocumento'}}}},responses:{400:{},401:{},403:{},404:{},409:{}}});
  const body:ApiOperations['documentos_patch__api_documentos_id_']['body']={versao:0,dataValidade:'2028-02-29'};
  expect(gestaoDocumentalSchemas.AlterarDocumento.safeParse(body).success).toBe(true);
  expect(gestaoDocumentalSchemas.AlterarDocumento.safeParse({...body,dataValidade:'2027-02-29'}).success).toBe(false);
  expect(gestaoDocumentalSchemas.AlterarDocumento.safeParse({dataValidade:'2028-02-29'}).success).toBe(false);
  expect(doc.paths).not.toHaveProperty('/api/documentos/alertas');
});
test('notas publicam autoria de saída e vínculo estrito, sem aceitar HTML como transporte',()=>{
  const doc=openapi();
  expect(doc.paths['/api/anotacoes'].post).toMatchObject({security:[{bearerAuth:[]}],responses:{201:{},400:{},401:{},403:{},404:{}}});
  expect(doc.paths['/api/anotacoes']).not.toHaveProperty('delete');
  const body:ApiOperations['anotacoes_post__api_anotacoes']['body']={tipoRegistro:'ORDEM_SVO',registroId:'123',texto:'Texto simples'};
  expect(anotacoesSchemas.CriarAnotacao.safeParse(body).success).toBe(true);
  expect(anotacoesSchemas.CriarAnotacao.safeParse({...body,autorId:'2'}).success).toBe(false);
});
test('dashboard consolidado separa perfis e conserva endpoints institucionais restritos',()=>{
  const doc=openapi();
  expect(doc.paths['/api/dashboard'].get).toMatchObject({'x-perfis':['ADM','GESTOR_FROTA','ATENDENTE_SVO'],
    responses:{200:{content:{'application/json':{schema:{$ref:'#/components/schemas/DashboardConsolidado'}}}},400:{},401:{},403:{},500:{}}});
  for(const path of ['/api/dashboard/gestor','/api/dashboard/graficos','/api/dashboard/pendencias'])expect(doc.paths[path].get).toHaveProperty('x-perfis',['ADM','GESTOR_FROTA']);
});
