import { compile } from 'json-schema-to-typescript';
import type { JSONSchema } from 'json-schema-to-typescript';
import { parse } from 'yaml';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root } from './generate-api.js';

/** Gera DTOs e bindings de operações da MESMA especificação versionada; nenhum import de conexão. */
export async function generateClient(check = false) {
  const doc = parse(readFileSync(resolve(root,'docs/api/openapi.yaml'),'utf8'));
  const definitions = doc.components.schemas;
  const schema = JSON.parse(JSON.stringify({type:'object',properties:Object.fromEntries(Object.keys(definitions).map(name=>[name,{$ref:'#/definitions/'+name}])),required:Object.keys(definitions),additionalProperties:false,definitions})
    .replaceAll('#/components/schemas/','#/definitions/'));
  const types = (await compile(schema as JSONSchema,'ApiSchemas',{bannerComment:'/* Gerado por client:generate de docs/api/openapi.yaml. Não editar. */',additionalProperties:false,style:{singleQuote:true},unknownAny:true,unreachableDefinitions:true}))
    .replace(/\{\}/g,'Record<string, never>');
  const bindings: Record<string,{method:string;path:string}> = {};
  let operationTypes = '\nexport interface ApiOperations {\n';
  for (const [path,methods] of Object.entries(doc.paths)) for (const [method,definition] of Object.entries(methods as Record<string,Record<string,unknown>>)) {
    const operation = definition as {operationId:string;requestBody?:{content:Record<string,{schema:{$ref:string}}>};responses:Record<string,{content:Record<string,{schema:{$ref:string}}>}>};
    const name = operation.operationId;
    const success = Object.keys(operation.responses).find(s=>s.startsWith('2'))!;
    const response = operation.responses[success].content['application/json'].schema.$ref.split('/').at(-1);
    const body = operation.requestBody?.content['application/json'].schema.$ref.split('/').at(-1);
    bindings[name] = {method:method.toUpperCase(),path};
    operationTypes += `  '${name}': { body: ${body ? `ApiSchemas['${body}']` : 'undefined'}; response: ApiSchemas['${response}'] };\n`;
  }
  operationTypes += '}\n';
  const files = [['frontend/src/shared/api/generated/schema.d.ts',types+operationTypes],
    ['frontend/src/shared/api/generated/operations.ts','/* Gerado por client:generate. Não editar. */\nexport const apiOperations = '+JSON.stringify(bindings,null,2)+' as const;\n']];
  for (const [path,content] of files) {
    if (check) { if (readFileSync(resolve(root,path),'utf8') !== content) throw new Error('Drift: '+path); }
    else writeFileSync(resolve(root,path),content);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generateClient();
