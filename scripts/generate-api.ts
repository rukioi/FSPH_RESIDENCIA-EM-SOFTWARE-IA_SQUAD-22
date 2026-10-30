import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify, parse } from 'yaml';
import { openapi } from '../backend/src/shared/contract/openapi.js';
import { operations } from '../backend/src/shared/contract/registry.js';

export const root = fileURLToPath(new URL('../',import.meta.url));
/** Serializa o contrato em ordem estável, sem data de geração ou informação do ambiente. */
export const specification = () => stringify(openapi(), { lineWidth: 0 });
/** Deriva a tabela de cobertura e limites dos mesmos descritores usados no dispatcher. */
export const inventory = () => '# Inventário da API atual — #32\n\nGerado por api:generate; não editar manualmente. ' + operations.length + ' operações.\n\n' +
  '| Método | Caminho | Perfis | Entrada | Sucesso | Erros | Runtime | Observações |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n' +
  operations.map(o=>`| ${o.method.toUpperCase()} | ${o.path} | ${o.perfis.join(', ') || 'pública'} | ${o.body ?? 'sem corpo'} | ${o.status} ${o.response} | ${[...o.errors,405].join(', ')} | ${o.modulo === 'veiculos' ? 'piloto' : 'legado'} | ${o.notes} |`).join('\n')+'\n\nCaminho desconhecido: 404 comum. Método não permitido: 405 + Allow, antes de auth. Todas as respostas recebem X-Request-Id. As exceções fechadas estão em [legacy-manifest.json](./legacy-manifest.json). Schemas legados documentam o transporte; não substituem os validadores existentes.\n';

/** Valida cobertura fechada: toda operação legada precisa de exceção explícita e toda família de rotas de contribuição. */
export function checkCoverage(manifest: { operations: {method:string;path:string;reason:string}[] }) {
  const keys = operations.map(o=>o.method.toUpperCase()+' '+o.path);
  if (new Set(keys).size !== keys.length) throw new Error('Operação duplicada no contrato.');
  const expected = operations.filter(o=>o.modulo !== 'veiculos').map(o=>o.method.toUpperCase()+' '+o.path).sort();
  const actual = manifest.operations.map(o=>o.method+' '+o.path).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual) || manifest.operations.some(o=>!o.reason.trim())) throw new Error('Manifesto legado fora da lista fechada. Nova rota exige contrato e adaptação explícita.');
  const modules = readdirSync(resolve(root,'backend/src/modules'),{withFileTypes:true}).filter(d=>d.isDirectory() && readdirSync(resolve(root,'backend/src/modules',d.name)).some(f=>f.endsWith('.routes.ts'))).map(d=>d.name).sort();
  if (JSON.stringify([...new Set(operations.map(o=>o.modulo))].sort()) !== JSON.stringify(modules)) throw new Error('Família de rotas sem contrato.');
}

type Document = ReturnType<typeof openapi>;
/** Gate conservador: qualquer alteração de contrato existente exige migração explícita; permite somente componentes e operações adicionais. */
export function checkCompatibility(previous: Document, current: Document) {
  for (const [path,methods] of Object.entries(previous.paths)) for (const [method,definition] of Object.entries(methods)) {
    const candidate = structuredClone(current.paths[path]?.[method]) as {responses?: Record<string,unknown>} | undefined;
    const old = definition as {responses?: Record<string,unknown>};
    // Migração explícita #30: somente o novo erro 404 comum deste POST.
    if (path === '/api/abastecimentos' && method === 'post' && !old.responses?.[404] && candidate?.responses?.[404]) {
      const expected = { ...(old.responses?.[500] as object), description:'Falha atual HTTP 404' };
      if (JSON.stringify(candidate.responses[404]) === JSON.stringify(expected)) delete candidate.responses[404];
    }
    if (JSON.stringify(definition) !== JSON.stringify(candidate)) throw new Error(`Contrato existente alterado: ${method.toUpperCase()} ${path}. Planeje compatibilidade explicitamente.`);
  }
  for (const [name,schema] of Object.entries(previous.components.schemas)) {
    const candidate = structuredClone(current.components.schemas[name as keyof typeof current.components.schemas]);
    // A forma legada permanece; apenas a descrição da correção autorizada muda.
    if (name === 'CriarAbastecimento' && candidate) candidate.description = schema.description;
    if (JSON.stringify(schema) !== JSON.stringify(candidate)) throw new Error('Componente existente alterado: '+name);
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
    if (previous) checkCompatibility(parse(previous),openapi());
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) generateApi();
