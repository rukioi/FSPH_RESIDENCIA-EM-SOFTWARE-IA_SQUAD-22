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
test('gate detecta remoção de rota/status e mudança incompatível de componente',()=>{
  expect(independent("import {openapi} from './backend/src/shared/contract/openapi.ts'; import {checkCompatibility} from './scripts/generate-api.ts'; const previous=openapi(); for(const mutation of [doc=>delete doc.paths['/api/veiculos'], doc=>delete doc.paths['/api/veiculos'].post.responses[201], doc=>doc.components.schemas.Veiculo.properties.id.type='number']) {const doc=structuredClone(previous);mutation(doc);try{checkCompatibility(previous,doc);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}} checkCompatibility(previous,openapi()); console.log('ok');")).toContain('ok');
});

test('migração #30 permite somente 404 comum de abastecimento e sua descrição técnica',()=>{
  expect(independent("import {openapi} from './backend/src/shared/contract/openapi.ts'; import {checkCompatibility} from './scripts/generate-api.ts'; const current=openapi();const previous=structuredClone(current);delete previous.paths['/api/abastecimentos'].post.responses[404];previous.components.schemas.CriarAbastecimento.description='legado';checkCompatibility(previous,current);for(const mutation of [doc=>doc.paths['/api/abastecimentos'].post.responses[404].content['application/json'].schema.$ref='#/components/schemas/Usuario',doc=>doc.components.schemas.CriarAbastecimento.properties.veiculo_id={type:'boolean'},doc=>delete doc.paths['/api/abastecimentos'].post.responses[201]]){const doc=structuredClone(current);mutation(doc);try{checkCompatibility(previous,doc);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});
test('inventário fechado mantém 29 operações e limites de pathname compatíveis',()=>{
  expect(operations).toHaveLength(29);
  const paths = operations.filter(o=>o.path.includes('{id}'));
  for (const operation of paths) {
    const path = operation.path.replace('{id}','123');
    expect(routePattern(operation).test(path)).toBe(true);
    expect(routePattern(operation).test(path+'/')).toBe(operation.modulo==='usuarios');
    expect(routePattern(operation).test(path+'/extra')).toBe(false);
  }
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
