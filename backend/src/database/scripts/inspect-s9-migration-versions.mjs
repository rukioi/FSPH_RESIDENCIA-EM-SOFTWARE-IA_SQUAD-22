import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Identifica versoes repetidas nos nomes de arquivos fornecidos, sem ler bancos. */
export function identificarVersoes(arquivos) {
  const grupos=new Map(),invalidos=[];
  for(const nome of new Set(arquivos)){
    if(!nome.endsWith('.sql'))continue;
    const match=/^(\d+)_([a-z0-9_-]+)\.sql$/.exec(nome);
    if(!match){invalidos.push(nome);continue;}
    const grupo=grupos.get(match[1])??[];grupo.push(nome);grupos.set(match[1],grupo);
  }
  const duplicadas=[...grupos].filter(([,grupo])=>grupo.length>1)
    .map(([versao,grupo])=>({versao,arquivos:grupo.sort()})).sort((a,b)=>a.versao.localeCompare(b.versao));
  return {duplicadas,invalidos:invalidos.sort()};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const diretorio=fileURLToPath(new URL('../supabase/migrations/',import.meta.url));
  const raiz=fileURLToPath(new URL('../../../../',import.meta.url));
  const args=process.argv.slice(2),refs=[];
  while(args.length){
    if(args.shift()!=='--ref')throw new Error('Uso: node inspect-s9-migration-versions.mjs [--ref referencia]');
    const ref=args.shift();
    if(!ref || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref))throw new Error('Referencia Git invalida.');
    refs.push(ref);
  }
  const entries=await readdir(diretorio,{withFileTypes:true});
  const arquivos=entries.filter(e=>e.isFile()).map(e=>e.name);
  const pasta='backend/src/database/supabase/migrations/';
  for(const ref of refs){
    const saida=execFileSync('git',['ls-tree','-r','--name-only',ref,'--',pasta],{cwd:raiz,encoding:'utf8'});
    arquivos.push(...saida.split(/\r?\n/).filter(Boolean).map(nome=>nome.slice(pasta.length)));
  }
  const resultado=identificarVersoes(arquivos);
  console.log(JSON.stringify({escopo:'Arquivos da worktree e referencias Git explicitamente informadas',diretorio,referencias:refs,totalSql:new Set(arquivos.filter(n=>n.endsWith('.sql'))).size,...resultado},null,2));
  if(resultado.duplicadas.length||resultado.invalidos.length)process.exitCode=1;
}
