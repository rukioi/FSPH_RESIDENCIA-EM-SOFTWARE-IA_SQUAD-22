import { dashboardConsolidadoAntesDeAbastecimentos, dashboardConsolidadoAntesRf46, dashboardConsolidadoSchemas, notaDashboardAntesDeAbastecimentos, notaDashboardAntesRf46, notaDashboardConsolidado } from '../backend/src/modules/dashboard/dashboard.consolidado.schemas.js';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify, parse } from 'yaml';
import { openapi } from '../backend/src/shared/contract/openapi.js';
import { operations, possuiValidacaoRuntime } from '../backend/src/shared/contract/registry.js';
import {z} from 'zod';
import {parametrosPeriodoDashboard,notasDashboardPeriodo} from '../backend/src/modules/dashboard/dashboard.indicadores.schemas.js';

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
    // Sprint 8: somente operacoes existentes e a troca exata do padrao do parametro id.
    const viagensAssinadas = new Set([
      'patch /api/viagens/{id}/encerrar','get /api/viagens/{id}/evidencias',
      'get /api/viagens/evidencias/{id}','get /api/viagens/{id}',
      'get /api/viagens/{id}/historico','patch /api/viagens/{id}/corrigir-quilometragem',
      'get /api/viagens/{id}/correcoes','patch /api/viagens/{id}/validar',
      'patch /api/viagens/{id}/iniciar','patch /api/viagens/{id}/concluir',
    ]);
    if (candidate && viagensAssinadas.has(method+' '+path)) {
      type Parameter = {name?:string; in?:string; schema?:{pattern?:string}};
      const before = (definition as {parameters?:Parameter[]}).parameters;
      const after = (candidate as {parameters?:Parameter[]}).parameters;
      if (before && after && before.length === after.length) {
        for (let i=0;i<before.length;i++) {
          const a=before[i], b=after[i];
          if(a.name!=='id' || a.in!=='path' || a.schema?.pattern!=='^[0-9]+$' || b.schema?.pattern!=='^-?[0-9]+$') continue;
          const expected=structuredClone(a); expected.schema!.pattern='^-?[0-9]+$';
          if(JSON.stringify(expected)===JSON.stringify(b))after[i]=a;
        }
      }
    }
    // Somente a resposta 409 comum na operacao de abastecimento.
    if (path==='/api/abastecimentos' && method==='post' && !old.responses?.[409] && candidate?.responses?.[409]) {
      const expected={...(old.responses?.[500] as object),description:'Falha atual HTTP 409'};
      if(JSON.stringify(candidate.responses[409])===JSON.stringify(expected))delete candidate.responses[409];
    }
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
    // A integração de combustível atualiza somente a descrição da operação raiz.
    if (path === '/api/dashboard' && method === 'get' && candidate) {
      const anterior = definition as { description?: string };
      const atual = candidate as { description?: string };
      if ((anterior.description === notaDashboardAntesDeAbastecimentos || anterior.description === notaDashboardAntesRf46) && atual.description === notaDashboardConsolidado) {
        atual.description = anterior.description;
      }
    }
    // SCRUM-193 reconhece apenas a resposta de conflito de histórico de CNH.
    if (path === '/api/motoristas/{id}' && method === 'delete' && !old.responses?.[409] && candidate?.responses?.[409]) {
      const esperado = { ...(old.responses?.[500] as object), description: 'Falha atual HTTP 409' };
      if (JSON.stringify(candidate.responses[409]) === JSON.stringify(esperado)) delete candidate.responses[409];
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
    let candidate = structuredClone(current.components.schemas[name as keyof typeof current.components.schemas]);
    if (name === 'DashboardConsolidado' && candidate) {
      const { $schema: anteriorDialect, ...anterior } = z.toJSONSchema(dashboardConsolidadoAntesDeAbastecimentos, { io: 'input' });
      const { $schema: atualDialect, ...atual } = z.toJSONSchema(dashboardConsolidadoSchemas.DashboardConsolidado, { io: 'input' });
      void anteriorDialect; void atualDialect;
      const { $schema: rf46Dialect, ...antesRf46 } = z.toJSONSchema(dashboardConsolidadoAntesRf46, { io: 'input' });
      void rf46Dialect;
      const anteriorReconhecido = [anterior, antesRf46].some(legado => JSON.stringify(legado) === JSON.stringify(schema));
      if (anteriorReconhecido && JSON.stringify(candidate) === JSON.stringify(atual)) {
        candidate = structuredClone(schema);
      }
    }
    // Transicao exata aprovada: o runtime ja exigia ao menos um km.
    if(name==='CorrigirQuilometragem' && candidate) {
      const km={type:'integer',minimum:0,maximum:2147483647};
      const properties={kmInicial:km,kmFinal:km,confirmarOdometroAtual:{type:'boolean'},justificativa:{type:'string',minLength:1,maxLength:2000}};
      const before={type:'object',properties,required:['justificativa'],additionalProperties:false};
      const after={anyOf:[{type:'object',properties,required:['kmInicial','justificativa'],additionalProperties:false},{type:'object',properties,required:['kmFinal','justificativa'],additionalProperties:false}]};
      if(JSON.stringify(schema)===JSON.stringify(before) && JSON.stringify(candidate)===JSON.stringify(after)) candidate=structuredClone(schema);
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
