import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { identificarVersoes } from '../../src/database/scripts/inspect-s9-migration-versions.mjs';

const scripts=['inspect-s9-catalog.sql','inspect-s9-data.sql'];
test('consultas de inspeção usam somente SELECT ou WITH sem comandos de escrita',async()=>{
  for(const nome of scripts){
    const texto=await readFile(new URL(`../../src/database/scripts/${nome}`,import.meta.url),'utf8');
    const consultas=texto.replace(/^\s*--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
    assert.ok(consultas.length>0,nome);
    for(const consulta of consultas){
      assert.match(consulta,/^(SELECT|WITH)\b/i);
      assert.doesNotMatch(consulta,/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|CALL|DO|COPY|GRANT|REVOKE|LOCK|VACUUM|REFRESH)\b/i);
      assert.doesNotMatch(consulta,/\b(nextval|setval|pg_advisory_lock|pg_sleep)\s*\(/i);
    }
  }
});

test('identifica versões duplicadas sem acessar o banco',()=>{
  const resultado=identificarVersoes(['20261111000000_a.sql','20261111000000_b.sql','20261112000000_c.sql']);
  assert.deepEqual(resultado.duplicadas,[{versao:'20261111000000',arquivos:['20261111000000_a.sql','20261111000000_b.sql']}]);
  assert.deepEqual(resultado.invalidos,[]);
});

test('usa a gramática do runner e ignora arquivos SQL não versionados',()=>{
  const resultado=identificarVersoes(['readme.md','malformada.sql','123_BAD.sql','123_valida.sql']);
  assert.deepEqual(resultado.invalidos,['123_BAD.sql']);
  assert.deepEqual(resultado.duplicadas,[]);
});

test('somente migrations aceitas pelo runner participam da detecção de colisões',()=>{
  const resultado=identificarVersoes(['123_valid-a.sql','123_valid_b.sql','123_Invalid.sql']);
  assert.deepEqual(resultado.duplicadas,[{versao:'123',arquivos:['123_valid-a.sql','123_valid_b.sql']}]);
  assert.deepEqual(resultado.invalidos,['123_Invalid.sql']);
});

test('provisionador espera pg_isready dentro do retry limitado antes de marcar o banco',async()=>{
  const texto=await readFile(new URL('../../src/database/scripts/provision-s9-full.ts',import.meta.url),'utf8');
  const inicio=texto.indexOf('for(let i=0;i<60;i++)');
  const fim=texto.indexOf('if(!marked)',inicio);
  assert.ok(inicio>=0&&fim>inicio);
  const retry=texto.slice(inicio,fim);
  assert.match(retry,/try\s*\{[\s\S]*pg_isready[\s\S]*psql[\s\S]*catch/);
  assert.ok(retry.indexOf('pg_isready')<retry.indexOf('psql'));
  assert.ok(retry.indexOf('psql')<retry.indexOf('COMMENT ON DATABASE'));
});

test('não acusa duas cópias do mesmo nome entre referências',()=>{
  assert.deepEqual(identificarVersoes(['20261111000000_a.sql','20261111000000_a.sql']).duplicadas,[]);
});

test('suíte padrão inclui os testes Sprint 9 pelo harness oficial',async()=>{
  const ts=await import('typescript');
  const texto=await readFile(new URL('../../../vitest.config.ts',import.meta.url),'utf8');
  const ast=ts.createSourceFile('vitest.config.ts',texto,ts.ScriptTarget.Latest,true);
  const props=new Map();
  const visitar=no=>{
    if(ts.isPropertyAssignment(no)&&ts.isIdentifier(no.name)&&['include','exclude'].includes(no.name.text))props.set(no.name.text,no.initializer);
    ts.forEachChild(no,visitar);
  };
  visitar(ast);
  const include=props.get('include'),exclude=props.get('exclude');
  assert.ok(include&&ts.isArrayLiteralExpression(include));
  assert.equal(exclude,undefined);
  assert.deepEqual(include.elements.map(e=>e.text),['backend/**/*.test.ts','frontend/**/*.test.ts','frontend/**/*.test.tsx']);
});
