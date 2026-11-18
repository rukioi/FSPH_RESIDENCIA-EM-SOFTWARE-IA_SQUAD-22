
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

for (const kind of ['api','client'] as const) {
  // A geracao real do cliente pode ultrapassar 5 s sob carga; mantem-se limite finito.
  test(`check ${kind} regenera e compara sem configuracao de banco/segredos`,()=>{
    const code = kind === 'api' ? "import {generateApi} from './scripts/generate-api.ts'; generateApi(true);"
      : "import {generateClient} from './scripts/generate-client.ts'; await generateClient(true);";
    expect(independent(code+"console.log('ok');")).toContain('ok');
  },kind === 'client' ? 15000 : 5000);
}

test('manifesto detecta remoção, duplicação e nova exceção não autorizada',()=>{
  expect(independent("import {readFileSync} from 'node:fs'; import {checkCoverage} from './scripts/generate-api.ts'; const manifest=JSON.parse(readFileSync('docs/api/legacy-manifest.json','utf8')); for(const operations of [manifest.operations.slice(1),[...manifest.operations,manifest.operations[0]],[...manifest.operations,{method:'GET',path:'/api/nova',reason:'extra'}]]) {try {checkCoverage({operations});throw Error('aceitou');} catch(e) {if(e.message==='aceitou')throw e;}} console.log('ok');")).toContain('ok');
});

test('gate detecta remoção de rota/status e mudança incompatível de componente',()=>{
  expect(independent("import {openapi} from './backend/src/shared/contract/openapi.ts'; import {checkCompatibility} from './scripts/generate-api.ts'; const previous=openapi(); for(const mutation of [doc=>delete doc.paths['/api/veiculos'], doc=>delete doc.paths['/api/veiculos'].post.responses[201], doc=>doc.components.schemas.Veiculo.properties.id.type='number']) {const doc=structuredClone(previous);mutation(doc);try{checkCompatibility(previous,doc);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}} checkCompatibility(previous,openapi()); console.log('ok');")).toContain('ok');
});

test('migração #30 permite somente 404 comum de abastecimento e sua descrição técnica',()=>{
  expect(independent("import {openapi} from './backend/src/shared/contract/openapi.ts'; import {checkCompatibility} from './scripts/generate-api.ts'; const current=openapi();const previous=structuredClone(current);delete previous.paths['/api/abastecimentos'].post.responses[404];previous.components.schemas.CriarAbastecimento.description='legado';checkCompatibility(previous,current);for(const mutation of [doc=>doc.paths['/api/abastecimentos'].post.responses[404].content['application/json'].schema.$ref='#/components/schemas/Usuario',doc=>doc.components.schemas.CriarAbastecimento.properties.veiculo_id={type:'boolean'},doc=>delete doc.paths['/api/abastecimentos'].post.responses[201]]){const doc=structuredClone(current);mutation(doc);try{checkCompatibility(previous,doc);throw Error('aceitou');}catch(e){if(e.message==='aceitou')throw e;}}console.log('ok');")).toContain('ok');
});

test('inventory preserves 98 operations and pathname limits',()=>{
  expect(operations).toHaveLength(98);
  for (const method of ['patch','post'] as const) {
    expect(operations.filter(o => o.method === method && o.path === '/api/svo/solicitacoes/{id}/triagem')).toHaveLength(1);
  }
});

test('inventory preserves previous operations and includes document and attachment routes',()=>{
  // Operações da base 1e5f2bb e as quatro rotas documentais da SCRUM-193.
  const anterior = [
    "delete /api/motoristas/{id}",
    "delete /api/veiculos/{id}",
    "get /api/abastecimentos",
    "get /api/abastecimentos/indicadores",
    "get /api/abastecimentos/{id}/comprovante",
    "get /api/admin/auditoria/logs",
    "get /api/admin/usuarios",
    "get /api/anexos",
    "get /api/anexos/{id}",
    "get /api/anotacoes",
    "get /api/auth/sessao",
    "get /api/dashboard",
    "get /api/dashboard/gestor",
    "get /api/dashboard/graficos",
    "get /api/dashboard/pendencias",
    "get /api/documentos",
    "get /api/documentos/alertas",
    "get /api/documentos/consulta",
    "get /api/documentos/pendencias",
    "get /api/documentos/{id}",
    "get /api/documentos/{id}/historico",
    "get /api/motoristas",
    "get /api/notificacoes",
    "get /api/relatorios",
    "get /api/relatorios/recursos",
    "get /api/solicitacoes-viagem",
    "get /api/solicitacoes-viagem/agenda",
    "get /api/solicitacoes-viagem/disponibilidade",
    "get /api/solicitacoes-viagem/{id}",
    "get /api/solicitacoes-viagem/{id}/historico",
    "get /api/svo/dashboard",
    "get /api/svo/dashboard/atividades",
    "get /api/svo/dashboard/filas",
    "get /api/svo/ordens-coleta",
    "get /api/svo/ordens-coleta/minhas",
    "get /api/svo/ordens-coleta/minhas/{id}",
    "get /api/svo/ordens-coleta/paginadas",
    "get /api/svo/ordens-coleta/{id}",
    "get /api/svo/ordens-coleta/{id}/historico",
    "get /api/svo/recursos-disponiveis",
    "get /api/svo/relatorios",
    "get /api/svo/relatorios/recursos",
    "get /api/svo/solicitacoes",
    "get /api/svo/solicitacoes/paginadas",
    "get /api/svo/solicitacoes/{id}",
    "get /api/svo/solicitacoes/{id}/historico",
    "get /api/svo/veiculos/{id}/ocupacao",
    "get /api/veiculos",
    "get /api/veiculos/{id}/foto",
    "patch /api/admin/usuarios/{id}/status",
    "patch /api/documentos/{id}",
    "patch /api/motoristas/{id}",
    "patch /api/solicitacoes-viagem/{id}",
    "patch /api/svo/ordens-coleta/{id}/cancelar",
    "patch /api/svo/ordens-coleta/{id}/concluir",
    "patch /api/svo/ordens-coleta/{id}/despachar",
    "patch /api/svo/ordens-coleta/{id}/etapa",
    "patch /api/svo/ordens-coleta/{id}/iniciar",
    "patch /api/svo/solicitacoes/{id}/triagem",
    "patch /api/veiculos/{id}",
    "post /api/abastecimentos",
    "post /api/admin/usuarios",
    "post /api/anexos",
    "post /api/anotacoes",
    "post /api/auth/login",
    "post /api/documentos",
    "post /api/motoristas",
    "post /api/notificacoes/ler-todas",
    "post /api/notificacoes/sincronizar",
    "post /api/notificacoes/{id}/ler",
    "post /api/solicitacoes-viagem",
    "post /api/solicitacoes-viagem/{id}/agendar",
    "post /api/solicitacoes-viagem/{id}/aprovar",
    "post /api/solicitacoes-viagem/{id}/reagendar",
    "post /api/solicitacoes-viagem/{id}/rejeitar",
    "post /api/svo/solicitacoes",
    "post /api/svo/solicitacoes/{id}/triagem",
    "post /api/veiculos",
    "put /api/admin/usuarios/{id}",
    "put /api/motoristas/{id}",
    "put /api/veiculos/{id}",
    "put /api/veiculos/{id}/foto",
  ];
  const existentes = operations.filter(o=>o.modulo!=='viagens' && !o.path.startsWith('/api/motorista/notificacoes')).map(o=>o.method+' '+o.path).sort();
  expect(existentes).toEqual(anterior);
  expect(operations.filter(o=>o.path.startsWith('/api/motorista/notificacoes')).map(o=>o.method+' '+o.path).sort()).toEqual(['get /api/motorista/notificacoes','patch /api/motorista/notificacoes/{id}/lida']);
  const viagens = operations.filter(o=>o.modulo==='viagens').map(o=>o.method+' '+o.path).sort();
  expect(viagens).toEqual([
    'get /api/viagens', 'get /api/viagens/evidencias/{id}', 'get /api/viagens/minhas', 'get /api/viagens/pendentes-validacao',
    'get /api/viagens/{id}', 'get /api/viagens/{id}/correcoes', 'get /api/viagens/{id}/evidencias',
    'get /api/viagens/{id}/historico', 'patch /api/viagens/{id}/concluir',
    'patch /api/viagens/{id}/corrigir-quilometragem', 'patch /api/viagens/{id}/encerrar', 'patch /api/viagens/{id}/iniciar',
    'patch /api/viagens/{id}/validar', 'post /api/viagens',
  ].sort());
  expect(operations.filter(o => o.modulo !== 'solicitacoes')).toHaveLength(87);
  expect(operations.filter(o => o.modulo === 'solicitacoes')).toHaveLength(11);
  const paths = operations.filter(o=>o.path.includes('{id}'));
  for (const operation of paths) {
    const path = operation.path.replace('{id}','123');
    expect(routePattern(operation).test(path)).toBe(true);
    expect(routePattern(operation).test(path+'/')).toBe(operation.modulo==='usuarios');
    expect(routePattern(operation).test(path+'/extra')).toBe(false);
  }
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

test('Sprint 8 autoriza somente tres transicoes de contrato e preserva o gate',()=>{
  expect(independent(`
import {openapi} from './backend/src/shared/contract/openapi.ts';
import {checkCompatibility} from './scripts/generate-api.ts';
const current=openapi();const previous=structuredClone(current);
for(const [path,methods] of Object.entries(previous.paths))if(path.startsWith('/api/viagens/'))for(const operation of Object.values(methods))for(const parameter of operation.parameters??[])if(parameter.name==='id'&&parameter.in==='path'&&parameter.schema?.pattern==='^-?[0-9]+$')parameter.schema.pattern='^[0-9]+$';
const km={type:'integer',minimum:0,maximum:2147483647};
previous.components.schemas.CorrigirQuilometragem={type:'object',properties:{kmInicial:km,kmFinal:km,confirmarOdometroAtual:{type:'boolean'},justificativa:{type:'string',minLength:1,maxLength:2000}},required:['justificativa'],additionalProperties:false};
delete previous.paths['/api/abastecimentos'].post.responses[409];
const ids=structuredClone(previous);
for(const [path,methods] of Object.entries(ids.paths))if(path.startsWith('/api/viagens/'))for(const [method,operation] of Object.entries(methods)){const target=current.paths[path]?.[method];if(!target)continue;for(const parameter of operation.parameters??[]){const updated=target.parameters?.find(p=>p.name===parameter.name&&p.in===parameter.in);if(parameter.name==='id'&&parameter.in==='path'&&updated?.schema?.pattern==='^-?[0-9]+$')parameter.schema.pattern=updated.schema.pattern;}}
checkCompatibility(previous,ids);
const schema=structuredClone(previous);schema.components.schemas.CorrigirQuilometragem=structuredClone(current.components.schemas.CorrigirQuilometragem);checkCompatibility(previous,schema);
const resposta=structuredClone(previous);resposta.paths['/api/abastecimentos'].post.responses[409]=structuredClone(current.paths['/api/abastecimentos'].post.responses[409]);checkCompatibility(previous,resposta);
checkCompatibility(previous,current);
const mutations=[
 d=>delete d.paths['/api/viagens/{id}'],
 d=>delete d.paths['/api/viagens/{id}'].get,
 d=>d.paths['/api/viagens/{id}'].get['x-perfis']=['MOTORISTA'],
 d=>d.paths['/api/viagens/{id}'].get.security=[],
 d=>d.paths['/api/viagens/{id}'].get.parameters[0].required=false,
 d=>d.paths['/api/viagens/{id}'].get.parameters[0].schema.pattern='.*',
 d=>delete d.paths['/api/viagens/{id}'].get.responses[200],
 d=>d.paths['/api/abastecimentos'].post.responses[409].content['application/json'].schema.$ref='#/components/schemas/Usuario',
 d=>d.paths['/api/abastecimentos'].post.responses[409].headers['X-Request-Id'].schema.type='integer',
 d=>d.components.schemas.CorrigirQuilometragem.anyOf[0].required=['justificativa'],
 d=>d.components.schemas.CorrigirQuilometragem.anyOf[1].properties.kmFinal.maximum=999,
 d=>d.components.schemas.CorrigirQuilometragem.anyOf[0].additionalProperties=true,
 d=>d.components.schemas.Veiculo.properties.id.type='number'
];
for(const mutation of mutations){const candidate=structuredClone(current);mutation(candidate);let rejected=false;try{checkCompatibility(previous,candidate)}catch{rejected=true}if(!rejected)throw Error('alteracao adicional aceita');}
console.log('ok');
`)).toContain('ok');
},15000);
test('SCRUM-195 autoriza a nova resposta do dashboard raiz e preserva a proteção',()=>{
  expect(independent(`
import {openapi} from './backend/src/shared/contract/openapi.ts';
import {checkCompatibility} from './scripts/generate-api.ts';
const current=openapi(), previous=structuredClone(current);
const antiga=previous.paths['/api/dashboard'].get;
antiga.description='Formato atual preservado; query params não declarados são ignorados.';
antiga['x-perfis']=['ADM','GESTOR_FROTA'];
antiga['x-runtime-validation']=false;
antiga.parameters=[];
antiga.responses[200].content['application/json'].schema.$ref='#/components/schemas/Dashboard';
delete antiga.responses[400];
delete previous.components.schemas.DashboardConsolidado;
checkCompatibility(previous,current);
for(const mutate of [
  d=>d.paths['/api/dashboard'].get.security=[],
  d=>d.paths['/api/dashboard'].get['x-perfis'].push('MOTORISTA'),
  d=>d.paths['/api/dashboard/gestor'].get.security=[],
]){
  const candidate=structuredClone(current);mutate(candidate);
  let rejected=false;
  try{checkCompatibility(previous,candidate)}catch{rejected=true}
  if(!rejected)throw Error('alteração adicional aceita');
}
console.log('ok');
`)).toContain('ok');
});

test('SCRUM-188 permite substituir somente a fonte antes indisponível do dashboard',()=>{
  expect(independent(`
import {z} from 'zod';
import {openapi} from './backend/src/shared/contract/openapi.ts';
import {checkCompatibility} from './scripts/generate-api.ts';
import {dashboardConsolidadoAntesDeAbastecimentos,notaDashboardAntesDeAbastecimentos} from './backend/src/modules/dashboard/dashboard.consolidado.schemas.ts';
const current=openapi(), previous=structuredClone(current);
const {$schema, ...anterior}=z.toJSONSchema(dashboardConsolidadoAntesDeAbastecimentos,{io:'input'});
previous.components.schemas.DashboardConsolidado=anterior;
previous.paths['/api/dashboard'].get.description=notaDashboardAntesDeAbastecimentos;
delete previous.paths['/api/abastecimentos/indicadores'];
delete previous.components.schemas.IndicadoresAbastecimentos;
checkCompatibility(previous,current);
const candidate=structuredClone(current);
candidate.paths['/api/dashboard'].get.security=[];
let rejected=false;
try{checkCompatibility(previous,candidate)}catch{rejected=true}
if(!rejected)throw Error('alteração adicional aceita');
console.log('ok');
`)).toContain('ok');
});

test('SCRUM-193 autoriza somente a evolução RF46 e o conflito de CNH no DELETE',()=>{
  expect(independent(`
import {z} from 'zod';
import {openapi} from './backend/src/shared/contract/openapi.ts';
import {checkCompatibility} from './scripts/generate-api.ts';
import {dashboardConsolidadoAntesRf46,notaDashboardAntesRf46} from './backend/src/modules/dashboard/dashboard.consolidado.schemas.ts';
const current=openapi(), previous=structuredClone(current);
const {$schema, ...anterior}=z.toJSONSchema(dashboardConsolidadoAntesRf46,{io:'input'});
previous.components.schemas.DashboardConsolidado=anterior;
previous.paths['/api/dashboard'].get.description=notaDashboardAntesRf46;
delete previous.paths['/api/motoristas/{id}'].delete.responses[409];
delete previous.paths['/api/documentos/alertas'];
delete previous.components.schemas.AlertasDocumentais;
checkCompatibility(previous,current);
for(const mutate of [d=>d.paths['/api/motoristas/{id}'].delete.security=[],d=>d.paths['/api/dashboard'].get['x-perfis'].push('MOTORISTA')]){
  const candidate=structuredClone(current);mutate(candidate);let rejected=false;
  try{checkCompatibility(previous,candidate)}catch{rejected=true}
  if(!rejected)throw Error('alteração adicional aceita');
}
console.log('ok');
`)).toContain('ok');
});
