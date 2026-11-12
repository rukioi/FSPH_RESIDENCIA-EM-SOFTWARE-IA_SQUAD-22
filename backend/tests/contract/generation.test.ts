
import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openapi } from '../../src/shared/contract/openapi.js';
import { operations, routePattern } from '../../src/shared/contract/registry.js';
import { criarVeiculoSchema, editarVeiculoSchema, erroValidacaoVeiculo } from '../../src/modules/veiculos/veiculos.schemas.js';

const root = fileURLToPath(new URL('../../../',import.meta.url));
function independent(code: string) {
  // Allowlist explícita; subprocesso não herda DATABASE_URL, JWT_SECRET nem configuração do desenvolvedor.
  const env: Record<string,string> = {};
  for (const key of ['PATH','Path','SystemRoot','TEMP','TMP']) if (process.env[key]) env[key] = process.env[key]!;
  return execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',code],{cwd:root,env,encoding:'utf8'});
}

test.each(['api','client'])('check %s regenera e compara sem configuração de banco/segredos',kind=>{
  const code = kind === 'api' ? "import {generateApi} from './scripts/generate-api.ts'; generateApi(true);"
    : "import {generateClient} from './scripts/generate-client.ts'; await generateClient(true);";
  expect(independent(code+"console.log('ok');")).toContain('ok');
});

test('manifesto detecta remoção, duplicação e nova exceção não autorizada',()=>{
  expect(independent("import {readFileSync} from 'node:fs'; import {checkCoverage} from './scripts/generate-api.ts'; const manifest=JSON.parse(readFileSync('docs/api/legacy-manifest.json','utf8')); for(const operations of [manifest.operations.slice(1),[...manifest.operations,manifest.operations[0]],[...manifest.operations,{method:'GET',path:'/api/nova',reason:'extra'}]]) {try {checkCoverage({operations});throw Error('aceitou');} catch(e) {if(e.message==='aceitou')throw e;}} console.log('ok');")).toContain('ok');
});

test('SCRUM-187 amplia apenas PDF e descrição, sem relaxar download legado ou autorização',()=>{
  expect(independent("import {execFileSync} from 'node:child_process';import {parse} from 'yaml';import {openapi} from './backend/src/shared/contract/openapi.ts';import {checkCompatibility} from './scripts/generate-api.ts';const previous=parse(execFileSync('git',['show','HEAD:docs/api/openapi.yaml'],{encoding:'utf8'}));checkCompatibility(previous,openapi());for(const mutate of [o=>o.security=[],o=>o['x-perfis']=['MOTORISTA'],o=>delete o.responses[404],o=>delete o.responses[200].content['image/jpeg'],o=>o.responses[200].content['application/pdf'].schema={type:'object'},o=>o.description='mudança não autorizada']){const current=openapi();mutate(current.paths['/api/abastecimentos/{id}/comprovante'].get);try{checkCompatibility(previous,current);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});

test('SCRUM-195 permite somente painel consolidado documentado, sem liberar outros perfis/rotas',()=>{
  expect(independent("import {execFileSync} from 'node:child_process';import {parse} from 'yaml';import {openapi} from './backend/src/shared/contract/openapi.ts';import {checkCompatibility} from './scripts/generate-api.ts';const previous=parse(execFileSync('git',['show','HEAD:docs/api/openapi.yaml'],{encoding:'utf8'}));checkCompatibility(previous,openapi());for(const mutate of [d=>d.paths['/api/dashboard'].get.security=[],d=>d.paths['/api/dashboard'].get['x-perfis'].push('MOTORISTA'),d=>delete d.paths['/api/dashboard'].get.responses[401],d=>d.paths['/api/dashboard/gestor'].get['x-perfis'].push('ATENDENTE_SVO'),d=>d.components.schemas.DashboardConsolidado.properties.data={type:'object'}]){const current=openapi();mutate(current);try{checkCompatibility(previous,current);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});

test('gate detecta remoção de rota/status e mudança incompatível de componente',()=>{
  expect(independent("import {openapi} from './backend/src/shared/contract/openapi.ts'; import {checkCompatibility} from './scripts/generate-api.ts'; const previous=openapi(); for(const mutation of [doc=>delete doc.paths['/api/veiculos'], doc=>delete doc.paths['/api/veiculos'].post.responses[201], doc=>doc.components.schemas.Veiculo.properties.id.type='number']) {const doc=structuredClone(previous);mutation(doc);try{checkCompatibility(previous,doc);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}} checkCompatibility(previous,openapi()); console.log('ok');")).toContain('ok');
});

test('migração #30 permite somente 404 comum de abastecimento e sua descrição técnica',()=>{
  expect(independent("import {openapi} from './backend/src/shared/contract/openapi.ts'; import {checkCompatibility} from './scripts/generate-api.ts'; const current=openapi();const previous=structuredClone(current);delete previous.paths['/api/abastecimentos'].post.responses[404];previous.components.schemas.CriarAbastecimento.description='legado';checkCompatibility(previous,current);for(const mutation of [doc=>doc.paths['/api/abastecimentos'].post.responses[404].content['application/json'].schema.$ref='#/components/schemas/Usuario',doc=>doc.components.schemas.CriarAbastecimento.properties.veiculo_id={type:'boolean'},doc=>delete doc.paths['/api/abastecimentos'].post.responses[201]]){const doc=structuredClone(current);mutation(doc);try{checkCompatibility(previous,doc);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});

test('inventário fechado inclui as três consultas RF40 e mantém limites de pathname compatíveis',()=>{
  expect(operations).toHaveLength(78);
  expect(operations.filter(o=>o.modulo==='abastecimentos').map(o=>o.method.toUpperCase()+' '+o.path)).toEqual([
    'GET /api/abastecimentos/{id}/comprovante','POST /api/abastecimentos/{id}/comprovante','GET /api/abastecimentos/indicadores','GET /api/abastecimentos',
    'POST /api/abastecimentos','GET /api/abastecimentos/{id}','GET /api/veiculos/{id}/abastecimentos',
  ]);
  for (const method of ['patch','post'] as const) {
    expect(operations.filter(o => o.method === method && o.path === '/api/svo/solicitacoes/{id}/triagem')).toHaveLength(1);
  }
});

test('inventário mantém as 51 operações anteriores e acrescenta anexos sem substituir solicitações',()=>{
  expect(operations.filter(o => !['solicitacoes','abastecimentos','anexos','anotacoes'].includes(o.modulo) && !['/api/documentos/consulta','/api/documentos/{id}','/api/documentos/{id}/historico'].includes(o.path))).toHaveLength(51);
  expect(operations.filter(o => o.modulo === 'anexos')).toHaveLength(3);
  expect(operations.filter(o => o.modulo === 'solicitacoes')).toHaveLength(11);
  const paths = operations.filter(o=>o.path.includes('{id}'));
  for (const operation of paths) {
    const path = operation.path.replace('{id}','123');
    expect(routePattern(operation).test(path)).toBe(true);
    expect(routePattern(operation).test(path+'/')).toBe(operation.modulo==='usuarios');
    expect(routePattern(operation).test(path+'/extra')).toBe(false);
  }
});

test('RF40 permite somente evolução publicada e não libera mudanças de auth, campos ou contratos externos',()=>{
  expect(independent("import {execFileSync} from 'node:child_process';import {parse} from 'yaml';import {openapi} from './backend/src/shared/contract/openapi.ts';import {checkCompatibility} from './scripts/generate-api.ts';const previous=parse(execFileSync('git',['show','HEAD:docs/api/openapi.yaml'],{encoding:'utf8'}));checkCompatibility(previous,openapi());for(const mutate of [d=>d.paths['/api/abastecimentos'].get.security=[],d=>d.paths['/api/abastecimentos'].post['x-perfis']=['MOTORISTA'],d=>delete d.paths['/api/abastecimentos'].post.responses[201],d=>d.paths['/api/abastecimentos'].get.parameters.push({name:'extra',in:'query'}),d=>d.components.schemas.Abastecimento.properties.quilometragem={type:'string'},d=>delete d.components.schemas.Abastecimento.properties.veiculo_id,d=>d.components.schemas.Abastecimento.required=d.components.schemas.Abastecimento.required.filter(k=>k!=='motorista_id'),d=>d.components.schemas.RespostaAbastecimento.properties.data.properties.valor_total={type:'number'}]){const current=openapi();mutate(current);try{checkCompatibility(previous,current);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});

test('SCRUM-137/138 publicam criação, consulta e decisões com contrato validado', () => {
  expect(operations.filter(operation => operation.modulo === 'solicitacoes').map(o => o.path)).toEqual([
    '/api/solicitacoes-viagem/{id}','/api/solicitacoes-viagem/{id}/historico',
    '/api/solicitacoes-viagem/agenda','/api/solicitacoes-viagem/disponibilidade','/api/solicitacoes-viagem/{id}/reagendar',
    '/api/solicitacoes-viagem/{id}',
    '/api/solicitacoes-viagem/{id}/agendar',
    '/api/solicitacoes-viagem/{id}/aprovar', '/api/solicitacoes-viagem/{id}/rejeitar',
    '/api/solicitacoes-viagem', '/api/solicitacoes-viagem']);
  expect(openapi().paths['/api/solicitacoes-viagem'].post).toHaveProperty('x-runtime-validation', true);
  expect(independent("import {readFileSync} from 'node:fs'; import {checkCoverage} from './scripts/generate-api.ts'; checkCoverage(JSON.parse(readFileSync('docs/api/legacy-manifest.json','utf8'))); console.log('ok');")).toContain('ok');
});

test('schemas do piloto preservam defaults null, campos ignorados, parcialidade e condicional de locação',()=>{
  const input = {placa:'T32',marca:'Fixture',modelo:'Fixture',ano:2026,tipo:null,capacidade_obitos:null,extra:'ignorado'};
  expect(criarVeiculoSchema.parse(input)).not.toHaveProperty('extra');
  expect(criarVeiculoSchema.safeParse({...input,status:null}).success).toBe(false);
  expect(editarVeiculoSchema.parse({ano:1901,tipo:'VAN'})).toEqual({});
  expect(editarVeiculoSchema.safeParse({vinculo:'LOCADO'}).success).toBe(false);
  expect(editarVeiculoSchema.safeParse({vinculo:'LOCADO',fornecedor_locacao:'Fixture'}).success).toBe(true);
  const doc = openapi();
  expect(doc.components.schemas.CriarVeiculo).toHaveProperty('allOf');
  expect(doc.components.schemas.EditarVeiculo).toHaveProperty('allOf');
});

test.each([
  {create:true,fields:{status:'FOLGA',capacidade_obitos:-1},code:'STATUS_INVALIDO'},
  {create:true,fields:{vinculo:'LOCADO',capacidade_obitos:-1},code:'FORNECEDOR_OBRIGATORIO'},
  {create:true,fields:{vinculo:'LOCADO',fornecedor_locacao:' '},code:'FORNECEDOR_OBRIGATORIO'},
  {create:false,fields:{vinculo:'LOCADO',capacidade_passageiros:0},code:'CAPACIDADE_INVALIDA'},
])('preserva precedência legada de erro $code',caso=>{
  const body={placa:'T32',marca:'Fixture',modelo:'Fixture',ano:2026,...caso.fields};
  const result=(caso.create ? criarVeiculoSchema : editarVeiculoSchema).safeParse(body);
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Entrada inválida aceita.');
  expect(erroValidacaoVeiculo(result.error,caso.create,body).code).toBe(caso.code);
});

test('baseline de merge preserva mudanças independentes e rejeita conflito no mesmo campo',()=>{
  expect(independent("import {openapi} from './backend/src/shared/contract/openapi.ts'; import {mergeContractBaselines,checkCompatibility} from './scripts/generate-api.ts'; const base=openapi(),head=structuredClone(base),incoming=structuredClone(base);head.components.schemas.Veiculo.description='head';incoming.paths['/api/svo/solicitacoes'].post.description='main';const combined=mergeContractBaselines(base,head,incoming);if(combined.components.schemas.Veiculo.description!=='head'||combined.paths['/api/svo/solicitacoes'].post.description!=='main')throw Error('perdeu mudança');checkCompatibility(combined,structuredClone(combined));incoming.components.schemas.Veiculo.description='divergente';try{mergeContractBaselines(base,head,incoming);throw Error('aceitou conflito');}catch(e){if(e.message==='aceitou conflito')throw e;}console.log('ok');")).toContain('ok');
});


test('SCRUM-164 permite apenas a evolução aprovada do dashboard e mantém proteção de auth e queries',()=>{
  expect(independent("import {execFileSync} from 'node:child_process';import {parse} from 'yaml';import {openapi} from './backend/src/shared/contract/openapi.ts';import {checkCompatibility} from './scripts/generate-api.ts';const previous=parse(execFileSync('git',['show','HEAD:docs/api/openapi.yaml'],{encoding:'utf8'}));checkCompatibility(previous,openapi());for(const mutate of [d=>delete d.components.schemas.DashboardGestorIndicadores.properties.data.properties.proximasViagens,d=>d.paths['/api/dashboard/gestor'].get.security=[],d=>d.paths['/api/dashboard/gestor'].get['x-perfis']=['MOTORISTA'],d=>d.paths['/api/dashboard/graficos'].get.parameters.push({name:'extra',in:'query'}),d=>d.paths['/api/dashboard/gestor'].get.responses[200].content['application/json'].schema.$ref='#/components/schemas/Usuario']){const current=openapi();mutate(current);try{checkCompatibility(previous,current);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});


test('dashboard evoluído aplica schemas e deixa de ser exceção legada',()=>{
  for(const path of ['/api/dashboard/gestor','/api/dashboard/graficos'])expect(openapi().paths[path].get).toHaveProperty('x-runtime-validation',true);
});


test('gate exige formato aprovado dos campos novos de abastecimento',()=>{
  expect(independent("import {execFileSync} from 'node:child_process';import {parse} from 'yaml';import {openapi} from './backend/src/shared/contract/openapi.ts';import {checkCompatibility} from './scripts/generate-api.ts';const previous=parse(execFileSync('git',['show','HEAD:docs/api/openapi.yaml'],{encoding:'utf8'}));checkCompatibility(previous,openapi());for(const mutate of [d=>d.components.schemas.Abastecimento.properties.tanque_completo={type:'string'},d=>d.components.schemas.CriarAbastecimento.properties.comprovante={type:'string'},d=>d.components.schemas.RespostaAbastecimento.properties.data.properties.comprovante_nome={type:'number'}]){const current=openapi();mutate(current);try{checkCompatibility(previous,current);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});
