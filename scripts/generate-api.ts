import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify, parse } from 'yaml';
import { openapi } from '../backend/src/shared/contract/openapi.js';
import { operations, possuiValidacaoRuntime } from '../backend/src/shared/contract/registry.js';
import {z} from 'zod';
import {parametrosPeriodoDashboard,notasDashboardPeriodo} from '../backend/src/modules/dashboard/dashboard.indicadores.schemas.js';
import { parametrosAbastecimentos, notasListagemAbastecimentos, notasCadastroAbastecimentos } from '../backend/src/modules/abastecimentos/abastecimentos.schemas.js';
import { id, meta } from '../backend/src/shared/contract/schemas.js';
import { dashboardConsolidadoSchemas,notaDashboardConsolidado } from '../backend/src/modules/dashboard/dashboard.consolidado.schemas.js';

export const root = fileURLToPath(new URL('../',import.meta.url));
/** Serializa o contrato em ordem estável, sem data de geração ou informação do ambiente. */
export const specification = () => stringify(openapi(), { lineWidth: 0 });
/** Deriva a tabela de cobertura e limites dos mesmos descritores usados no dispatcher. */
export const inventory = () => '# Inventário da API atual — #32\n\nGerado por api:generate; não editar manualmente. ' + operations.length + ' operações.\n\n' +
  '| Método | Caminho | Perfis | Entrada | Sucesso | Erros | Runtime | Observações |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n' +
  operations.map(o=>`| ${o.method.toUpperCase()} | ${o.path} | ${o.perfis.join(', ') || 'pública'} | ${o.body ?? 'sem corpo'} | ${o.status} ${o.response} | ${[...o.errors,405].join(', ')} | ${o.modulo === 'veiculos' ? 'piloto' : possuiValidacaoRuntime(o) ? 'validado' : 'legado'} | ${o.notes} |`).join('\n')+'\n\nCaminho desconhecido: 404 comum. Método não permitido: 405 + Allow, antes de auth. Todas as respostas recebem X-Request-Id. As exceções fechadas estão em [legacy-manifest.json](./legacy-manifest.json). Schemas legados documentam o transporte; não substituem os validadores existentes.\n';

/** Valida cobertura fechada: toda operação legada precisa de exceção explícita e toda família de rotas de contribuição. */
export function checkCoverage(manifest: { operations: {method:string;path:string;reason:string}[] }) {
  const keys = operations.map(o=>o.method.toUpperCase()+' '+o.path);
  if (new Set(keys).size !== keys.length) throw new Error('Operação duplicada no contrato.');
  const expected = operations.filter(o=>!possuiValidacaoRuntime(o)).map(o=>o.method.toUpperCase()+' '+o.path).sort();
  const actual = manifest.operations.map(o=>o.method+' '+o.path).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual) || manifest.operations.some(o=>!o.reason.trim())) throw new Error('Manifesto legado fora da lista fechada. Nova rota exige contrato e adaptação explícita.');
  const modules = readdirSync(resolve(root,'backend/src/modules'),{withFileTypes:true}).filter(d=>d.isDirectory() && readdirSync(resolve(root,'backend/src/modules',d.name)).some(f=>f.endsWith('.routes.ts'))).map(d=>d.name).sort();
  if (JSON.stringify([...new Set(operations.map(o=>o.modulo))].sort()) !== JSON.stringify(modules)) throw new Error('Família de rotas sem contrato.');
}

type Document = ReturnType<typeof openapi>;
/** Gate conservador: qualquer alteração de contrato existente exige migração explícita; permite somente componentes e operações adicionais. */
export function checkCompatibility(previous: Document, current: Document) {
  for (const [path,methods] of Object.entries(previous.paths)) for (const [method,definition] of Object.entries(methods)) {
    let candidate = structuredClone(current.paths[path]?.[method]) as {responses?: Record<string,unknown>} | undefined;
    const old = definition as {responses?: Record<string,unknown>};
    // SCRUM-195 autoriza somente substituir o painel vazio por estas visões tipadas.
    if(path==='/api/dashboard'&&method==='get'&&candidate){
      const previous=definition as {responses:Record<string,{content?:{'application/json'?:{schema?:{$ref?:string}}}}>};
      if(previous.responses[200]?.content?.['application/json']?.schema?.$ref==='#/components/schemas/Dashboard'){
        const expected={...structuredClone(definition as Record<string,unknown>),description:notaDashboardConsolidado,
          'x-perfis':['ADM','GESTOR_FROTA','ATENDENTE_SVO'],'x-runtime-validation':true,
          parameters:parametrosPeriodoDashboard.map(q=>({name:q.name,in:'query',required:q.required,schema:z.toJSONSchema(q.schema)})),
          responses:structuredClone(previous.responses)};
        expected.responses[200].content!['application/json']!.schema!.$ref='#/components/schemas/DashboardConsolidado';
        expected.responses[400]={...expected.responses[500],description:'Falha atual HTTP 400'} as typeof expected.responses[string];
        const {$schema:dialect,...shape}=z.toJSONSchema(dashboardConsolidadoSchemas.DashboardConsolidado,{io:'input'});void dialect;
        if(JSON.stringify(current.components.schemas.DashboardConsolidado)!==JSON.stringify(shape))throw new Error('Dashboard consolidado fora do contrato aprovado.');
        // Ordem de chaves não tem semântica contratual; preserve a ordem do documento derivado.
        if(JSON.stringify({...candidate,responses:undefined})===JSON.stringify({...expected,responses:undefined})
          &&Object.keys(expected.responses).length===Object.keys(candidate.responses??{}).length
          &&Object.entries(expected.responses).every(([key,value])=>JSON.stringify(candidate!.responses?.[key])===JSON.stringify(value)))candidate=structuredClone(old);
      }
    }
    // Migração autorizada dos 4xx: somente a troca exata do envelope legado pelo comum.
    // Status, headers, descrições, sucessos e componentes continuam protegidos pelo gate.
    for (const [status, previousResponse] of Object.entries(old.responses ?? {})) {
      if (Number(status) < 400 || Number(status) >= 500) continue;
      const before = previousResponse as {content?: {'application/json'?: {schema?: {$ref?: string}}}};
      const ref = before.content?.['application/json']?.schema?.$ref;
      if (!ref || !['ErroSvo','ErroOperacionalSvo','ErroUsuario','ErroString'].some(name => ref === '#/components/schemas/' + name)) continue;
      const expected = structuredClone(before);
      expected.content!['application/json']!.schema = {$ref:'#/components/schemas/Erro'};
      if (JSON.stringify(candidate?.responses?.[status]) === JSON.stringify(expected)) candidate!.responses![status] = previousResponse;
    }
    // Migração explícita #30: somente o novo erro 404 comum deste POST.
    if (path === '/api/abastecimentos' && method === 'post' && !old.responses?.[404] && candidate?.responses?.[404]) {
      const expected = { ...(old.responses?.[500] as object), description:'Falha atual HTTP 404' };
      if (JSON.stringify(candidate.responses[404]) === JSON.stringify(expected)) delete candidate.responses[404];
    }
    // SCRUM-185/186: evolução fechada da coleção/cadastro. Auth, sucesso, headers e erros legados seguem protegidos.
    if (path === '/api/abastecimentos/{id}/comprovante' && method === 'get' && candidate) {
      const before = definition as {description?:string;responses?:Record<string,{content?:Record<string,unknown>}>};
      const after = candidate as typeof before;
      if (before.description === 'Imagem JPEG ou PNG como bytes; acesso autenticado.'
        && after.description === 'PDF/JPEG/PNG privados: último anexo compartilhado, com fallback do comprovante legado. Acesso autenticado.') {
        after.description = before.description;
      }
      const content = after.responses?.[200]?.content;
      if (!before.responses?.[200]?.content?.['application/pdf'] && content
        && JSON.stringify(content['application/pdf']) === JSON.stringify({schema:{type:'string',format:'binary'}})) {
        delete content['application/pdf'];
      }
    }
    if(path==='/api/abastecimentos' && ['get','post'].includes(method) && candidate) {
      type Operation = {description?:string;parameters?:unknown[];'x-runtime-validation'?:boolean;
        requestBody?:{content?:{'application/json'?:{schema?:{$ref?:string}}}};
        responses?:Record<string,{content?:{'application/json'?:{schema?:{$ref?:string}}}}>};
      const before=definition as Operation,after=candidate as Operation;
      const status=method==='get' ? 200 : 201;
      const previousRef='#/components/schemas/'+(method==='get'?'Abastecimentos':'RespostaAbastecimento');
      const replacement=previousRef;
      const response=after.responses?.[status]?.content?.['application/json']?.schema;
      if(before.responses?.[status]?.content?.['application/json']?.schema?.$ref===previousRef && response?.$ref===replacement) {
        response.$ref=previousRef;
        if(before['x-runtime-validation']===false && after['x-runtime-validation']===true) after['x-runtime-validation']=false;
        const notes=method==='get'?notasListagemAbastecimentos:notasCadastroAbastecimentos;
        if(before.description==='Formato atual preservado; query params não declarados são ignorados.' && after.description===notes)after.description=before.description;
        const parameters=parametrosAbastecimentos.map(q=>({name:q.name,in:'query',required:q.required,schema:z.toJSONSchema(q.schema)}));
        if(method==='get'&&JSON.stringify(before.parameters)==='[]'&&JSON.stringify(after.parameters)===JSON.stringify(parameters))after.parameters=[];
        const body=after.requestBody?.content?.['application/json']?.schema;
        if(method==='post'&&before.requestBody?.content?.['application/json']?.schema?.$ref==='#/components/schemas/CriarAbastecimento' && body?.$ref==='#/components/schemas/CriarAbastecimentoRF40')body.$ref='#/components/schemas/CriarAbastecimento';
        for(const code of method==='get'?[400,404]:[409]) {
          const expected={...(before.responses?.[500] as object),description:'Falha atual HTTP '+code};
          if(!before.responses?.[code]&&JSON.stringify(after.responses?.[code])===JSON.stringify(expected))delete after.responses![code];
        }
      }
    }
    // SCRUM-164: transição fechada dos dois GETs para DTOs novos; componentes antigos permanecem imutáveis.
    // Não autoriza alteração de perfis, security, headers, outros erros ou remoção de campos legados.
    const dashboard = path==='/api/dashboard/gestor' ? ['DashboardGestor','DashboardGestorIndicadores']
      : path==='/api/dashboard/graficos' ? ['Graficos','GraficosPeriodo'] : undefined;
    if(method==='get' && dashboard && candidate){
      const before=definition as {parameters?:unknown[];description?:string;responses?:Record<string,{content?:{'application/json'?:{schema?:{$ref?:string}}}}>};
      const after=candidate as typeof before;
      const oldRef=before.responses?.[200]?.content?.['application/json']?.schema?.$ref;
      const newSchema=after.responses?.[200]?.content?.['application/json']?.schema;
      if(oldRef==='#/components/schemas/'+dashboard[0] && newSchema?.$ref==='#/components/schemas/'+dashboard[1]){
        const legacy=current.components.schemas[dashboard[0]];
        const replacement=current.components.schemas[dashboard[1]];
        const oldData=legacy?.properties?.data;
        const newData=replacement?.properties?.data;
        if(!oldData||typeof oldData!=='object'||!newData||typeof newData!=='object'||!oldData.properties||!newData.properties||newData.type!=='object')throw new Error('Dashboard sem formato legado.');
        for(const name of oldData.required??[]){
          if(!newData.required?.includes(name))throw new Error('Campo legado deixou de ser obrigatório: '+name);
        }
        for(const [name,shape] of Object.entries(oldData.properties)){
          const actual=newData.properties[name];
          if(dashboard[0]==='DashboardGestor'&&name==='motoristasDisponiveis'){
            const {$schema:dialect,...expected}=z.toJSONSchema(z.number().int().nonnegative().nullable());void dialect;
            if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Disponibilidade fora da evolução aprovada.');
          }else if(JSON.stringify(actual)!==JSON.stringify(shape))throw new Error('Campo legado alterado no dashboard: '+name);
        }
        const runtime=candidate as Record<string,unknown>;
        if(runtime['x-runtime-validation']===true&&(definition as Record<string,unknown>)['x-runtime-validation']===false)runtime['x-runtime-validation']=false;
        newSchema.$ref=oldRef;
        const expected=parametrosPeriodoDashboard.map(q=>({name:q.name,in:'query',required:q.required,schema:z.toJSONSchema(q.schema)}));
        if(JSON.stringify(before.parameters)===JSON.stringify([]) && JSON.stringify(after.parameters)===JSON.stringify(expected))after.parameters=[];
        if(after.description===notasDashboardPeriodo)after.description=before.description;
        const error400={...(before.responses?.[500] as object),description:'Falha atual HTTP 400'};
        if(!before.responses?.[400] && JSON.stringify(after.responses?.[400])===JSON.stringify(error400))delete after.responses![400];
      }
    }
    // SCRUM-145/148: exceção para descrição documental desta rota, com texto antigo e novo exatos.
    // Demais atributos (security, x-perfis, parâmetros, respostas e erros) seguem protegidos.
    if (path === '/api/svo/ordens-coleta/minhas' && method === 'get' && candidate) {
      const anterior = (definition as {description?:string}).description;
      const nova = (candidate as {description?:string}).description;
      if (anterior === 'Somente ordens vinculadas a motorista.usuario_id da sessão; sem dados médicos/pessoais do solicitante.' &&
          nova === 'Somente ordens vinculadas a motorista.usuario_id da sessão; até 100 ordens por id DESC, sem paginação nem parâmetros de consulta; a lista pode estar truncada; sem dados médicos/pessoais do solicitante.') {
        (candidate as {description?:string}).description = anterior;
      }
    }
    if (JSON.stringify(definition) !== JSON.stringify(candidate)) throw new Error(`Contrato existente alterado: ${method.toUpperCase()} ${path}. Planeje compatibilidade explicitamente.`);
  }
  for (const [name,schema] of Object.entries(previous.components.schemas)) {
    const candidate = structuredClone(current.components.schemas[name as keyof typeof current.components.schemas]);
    // RF40: somente motorista_id/quilometragem admitem NULL nos três DTOs legados de resposta.
    // Não remove campo obrigatório, não muda tipo dos valores presentes nem altera qualquer outro componente.
    if(candidate&&['Abastecimento','RespostaAbastecimento','Abastecimentos'].includes(name)) {
      const nullable=(old:unknown,next:unknown):void=>{
        if(!old||typeof old!=='object'||!next||typeof next!=='object')return;
        const a=old as Record<string,unknown>,b=next as Record<string,unknown>;
        if(a.properties&&b.properties&&typeof a.properties==='object'&&typeof b.properties==='object') {
          const previousProperties=a.properties as Record<string,unknown>,properties=b.properties as Record<string,unknown>;
          const extras={criado_por_id:id.nullable(),veiculo_placa:z.string().nullable(),motorista_nome:z.string().nullable(),meta};
          for(const [key,validator] of Object.entries(extras)) {
            if(key in previousProperties||!(key in properties))continue;
            const {$schema,...expected}=z.toJSONSchema(validator,{io:'input'});void $schema;
            if(JSON.stringify(properties[key])===JSON.stringify(expected)&&!(Array.isArray(b.required)&&b.required.includes(key)))delete properties[key];
          }
        }
        for(const key of Object.keys(a)) {
          const shape=a[key] as {type?:string}|undefined;
          if(['motorista_id','quilometragem'].includes(key)&&shape?.type&&(shape.type==='string'||shape.type==='integer')&&JSON.stringify(b[key])===JSON.stringify({anyOf:[a[key],{type:'null'}]}))b[key]=a[key];
          else nullable(a[key],b[key]);
        }
      };
      nullable(schema,candidate);
    }
    // A forma legada permanece; apenas a descrição da correção autorizada muda.
    if (name === 'CriarAbastecimento' && candidate) candidate.description = schema.description;
    // Extens?o aditiva autorizada para combust?vel; os campos anteriores permanecem id?nticos.
    if (candidate && !JSON.stringify(schema).includes('"tanque_completo"') && ['CriarAbastecimento','Abastecimento','RespostaAbastecimento','Abastecimentos'].includes(name)) {
      const fields = { tanque_completo: z.boolean(), comprovante_nome: z.string().nullable(),
        comprovante: z.object({nome:z.string().min(1).max(255),tipo:z.enum(['image/jpeg','image/png']),dadosBase64:z.string().max(1398104)}).nullish() };
      const strip = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(strip); return; }
        const obj = value as Record<string, unknown>;
        if (obj.properties && typeof obj.properties === 'object') {
          const props = obj.properties as Record<string, unknown>;
          for (const [key, validator] of Object.entries(fields)) {
            if (!(key in props)) continue;
            const {$schema, ...expected} = z.toJSONSchema(validator, {io:'input'}); void $schema;
            if (JSON.stringify(props[key]) !== JSON.stringify(expected)) throw new Error('Campo novo de abastecimento incompat?vel: '+key);
            const required = Array.isArray(obj.required) && obj.required.includes(key);
            if (required !== (name !== 'CriarAbastecimento')) throw new Error('Obrigatoriedade de abastecimento incompat?vel: '+key);
            delete props[key];
          }
        }
        if (Array.isArray(obj.required)) obj.required = obj.required.filter(x => x !== 'tanque_completo' && x !== 'comprovante_nome');
        Object.values(obj).forEach(strip);
      };
      strip(candidate);
    }
    if (JSON.stringify(schema) !== JSON.stringify(candidate)) throw new Error('Componente existente alterado: '+name);
  }
}
/** Combina contratos dos dois pais sem ignorar alterações ou aceitar conflitos no mesmo campo. */
export function mergeContractBaselines(base: Document, head: Document, incoming: Document): Document {
  const equal = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const object = (value: unknown): value is Record<string,unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
  const merge = (b: unknown,h: unknown,i: unknown,path: string): unknown => {
    if (equal(h,b)) return i;
    if (equal(i,b) || equal(h,i)) return h;
    if (!object(b) || !object(h) || !object(i)) throw new Error('Conflito entre contratos dos pais em '+path);
    const result: Record<string,unknown> = {};
    for (const key of new Set([...Object.keys(b),...Object.keys(h),...Object.keys(i)])) {
      const value=merge(b[key],h[key],i[key],path+'.'+key);
      if (value !== undefined) result[key]=value;
    }
    return result;
  };
  return merge(base,head,incoming,'contrato') as Document;
}

function pendingMerge(): string | undefined {
  try { return execFileSync('git',['rev-parse','--verify','--quiet','MERGE_HEAD'],{cwd:root,encoding:'utf8'}).trim(); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 1) return undefined;
    throw error;
  }
}

/** Regenera em memória e compara conteúdo; não requer banco nem segredos. */
export function generateApi(check = false) {
  checkCoverage(JSON.parse(readFileSync(resolve(root,'docs/api/legacy-manifest.json'),'utf8')));
  const files = [['docs/api/openapi.yaml',specification()],['docs/api/inventory.md',inventory()]];
  for (const [path,content] of files) {
    if (check) { if (readFileSync(resolve(root,path),'utf8') !== content) throw new Error('Drift: '+path); }
    else writeFileSync(resolve(root,path),content);
  }
  if (check) {
    let previous: string | undefined;
    // Arquivo ausente somente na primeira entrega. Outros erros do git não são ignorados.
    const tracked = execFileSync('git',['ls-tree','--name-only','HEAD','docs/api/openapi.yaml'],{cwd:root,encoding:'utf8'}).trim();
    if (tracked) previous = execFileSync('git',['show','HEAD:docs/api/openapi.yaml'],{cwd:root,encoding:'utf8'});
    if (previous) {
      let baseline: Document = parse(previous);
      const incoming = pendingMerge();
      if (incoming) {
        const base = execFileSync('git',['merge-base','HEAD',incoming],{cwd:root,encoding:'utf8'}).trim();
        const read = (ref: string): Document => parse(execFileSync('git',['show',ref+':docs/api/openapi.yaml'],{cwd:root,encoding:'utf8'}));
        baseline=mergeContractBaselines(read(base),baseline,read(incoming));
      }
      checkCompatibility(baseline,openapi());
    }
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generateApi();
