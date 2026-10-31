import { z } from 'zod';
import { operations, schemas } from './registry.js';

/** Gera OpenAPI 3.1 exclusivamente dos schemas puros, sem importar aplicação, ambiente ou pool. */
export function openapi() {
  const components = Object.fromEntries(Object.entries(schemas).map(([name,schema]) => {
    const { $schema: _dialect, ...json } = z.toJSONSchema(schema, { io: 'input' });
    void _dialect;
    return [name,json];
  }));
  const ref = (name: string) => ({ $ref: '#/components/schemas/' + name });
  const paths: Record<string, Record<string, unknown>> = {};
  for (const operation of operations) {
    const parameters: unknown[] = (operation.query ?? []).map(q=>({name:q.name,in:'query',required:q.required,schema:z.toJSONSchema(q.schema)}));
    if (operation.path.includes('{id}')) parameters.push({name:'id',in:'path',required:true,schema:{type:'string',pattern:'^[0-9]+$'},description:'Identificador no caminho atual; limites numéricos variam por módulo.'});
    const response = (name: string, description: string) => ({ description, headers: {'X-Request-Id':{description:'UUID gerado pelo servidor; IDs recebidos não são confiados.',schema:{type:'string',format:'uuid'}}}, content:{'application/json':{schema:ref(name)}} });
    const responses: Record<string, unknown> = { [operation.status]: response(operation.response,'Sucesso no formato atual') };
    for (const status of operation.errors) {
      responses[status] = response('Erro','Falha atual HTTP ' + status);
    }
    responses[405] = { ...response('Erro','Método não permitido antes da autenticação'), headers:{Allow:{schema:{type:'string'}},'X-Request-Id':{schema:{type:'string'}}} };
    if (operation.errors.includes(429)) (responses[429] as {headers: Record<string,unknown>}).headers['Retry-After'] = {schema:{type:'string'},description:'Segundos até nova tentativa.'};
    const content: Record<string,unknown> = operation.body ? {'application/json':{schema:ref(operation.body)}} : {};
    if (operation.modulo === 'documentos' && operation.body) content['multipart/form-data'] = {schema:{allOf:[ref(operation.body),{type:'object',properties:{arquivo:{type:'string',format:'binary'}},required:['arquivo']}]}};
    (paths[operation.path] ??= {})[operation.method] = {
      operationId:operation.id,tags:[operation.modulo],description:operation.notes,
      security:operation.perfis.length ? [{bearerAuth:[]}] : [],'x-perfis':operation.perfis,
      'x-runtime-validation':operation.modulo === 'veiculos',parameters,
      ...(operation.body ? {requestBody:{required:true,content}} : {}),responses,
    };
  }
  return {openapi:'3.1.0',info:{title:'FSPH — API existente',version:'0.1.0',description:'Contrato global #32. Legados delimitados no manifesto; não define funcionalidades futuras.'},
    paths,components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},schemas:components}};
}
