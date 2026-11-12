import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type postgres from 'postgres';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { canonical, metadataQuery, type Metadata } from '../../src/database/scripts/generate-db-docs.js';
import { root, verifiedSql } from '../../src/database/scripts/verify-test-db.js';

type Tx = postgres.TransactionSql;
let sql: Awaited<ReturnType<typeof verifiedSql>>;
let admin: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { sql = await verifiedSql(); admin = await verifiedSql(true); });
afterAll(async () => { await sql?.end(); await admin?.end(); });
const rollback = new Error('Rollback deliberado da fixture SCRUM-192');
const tabelas = ['anexo', 'documento_historico', 'anotacao'];
const alvos = ['solicitacao_viagem_id', 'solicitacao_obito_id', 'viagem_id', 'ordem_coleta_id',
  'abastecimento_id', 'veiculo_id', 'motorista_id', 'documento_veiculo_id'] as const;
type Alvo = typeof alvos[number];
const png = Buffer.from('89504e470d0a1a0a01', 'hex');
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const versao = '20261112000000_db_s9_02_documentos_evidencias.sql';
const forward = readFileSync(resolve(root, 'backend/src/database/supabase/migrations', versao), 'utf8');
const backward = readFileSync(resolve(root, 'backend/src/database/supabase/rollbacks', versao), 'utf8');

async function ensaio(fn: (tx: Tx) => Promise<unknown>, conexao = sql) {
  return conexao.begin(async tx => { await fn(tx); throw rollback; }).catch((e: unknown) => e);
}
function anexo(tx: Tx, alvo: Alvo = 'veiculo_id', sobrescrita: Record<string, string | number | Buffer | null> = {}) {
  const registro = { id: -919201, [alvo]: -27001, nome: 'fixture.png', tipo: 'image/png',
    tamanho: png.length, sha256: hash(png), dados: png, autor_id: -27002, ...sobrescrita };
  return tx`INSERT INTO public.anexo ${tx(registro)} RETURNING id, chave, tamanho, sha256, dados, autor_id, criado_em`;
}
function historico(tx: Tx, sobrescrita: Record<string, string | number | null> = {}) {
  return tx`INSERT INTO public.documento_historico ${tx({ id: -919202, documento_veiculo_id: -27001,
    versao: 1, tipo_documento: 'Fixture documental', data_vencimento: '2028-02-29',
    status_regular: true, autor_id: -27002, ...sobrescrita })}`;
}
function nota(tx: Tx, sobrescrita: Record<string, string | number | null> = {}) {
  return tx`INSERT INTO public.anotacao ${tx({ id: -919203, veiculo_id: -27001,
    texto: 'Nota de teste sem dado pessoal', autor_id: -27002, ...sobrescrita })}`;
}
async function metadados(tx: Tx) {
  const [row] = await tx.unsafe(metadataQuery);
  return canonical(row.metadata as Metadata);
}

test('base compartilhada existe com RLS, sem criar policy, trigger ou alerta automático', async () => {
  const [row] = await sql.unsafe(metadataQuery);
  const metadata = canonical(row.metadata as Metadata);
  for (const nome of tabelas) expect(metadata.tables.find(t => t.name === nome)).toMatchObject({ rls: true });
  expect(metadata.policies).toEqual([]);
  expect(metadata.triggers).toEqual([]);
  for (const nome of tabelas) {
    const [permissoes] = await sql`SELECT
      has_table_privilege('anon', ${'public.' + nome}, 'SELECT,INSERT,UPDATE,DELETE') AS anon,
      has_table_privilege('authenticated', ${'public.' + nome}, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated,
      has_table_privilege(current_user, ${'public.' + nome}, 'SELECT') AS leitura,
      has_table_privilege(current_user, ${'public.' + nome}, 'INSERT') AS inclusao,
      has_table_privilege(current_user, ${'public.' + nome}, 'UPDATE,DELETE,TRUNCATE') AS alteracao`;
    expect(permissoes).toEqual({ anon: false, authenticated: false, leitura: true, inclusao: true, alteracao: false });
  }
});

test.each(alvos)('anexo conserva bytes e metadados com FK real: %s', async alvo => {
  expect(await ensaio(async tx => {
    const [arquivo] = await anexo(tx, alvo);
    expect(arquivo).toMatchObject({ id: '-919201', tamanho: png.length, sha256: hash(png), dados: png, autor_id: '-27002' });
    expect(arquivo.chave).toMatch(/^[a-f0-9-]{36}$/);
    expect(arquivo.criado_em).toBeInstanceOf(Date);
  })).toBe(rollback);
  expect(await ensaio(tx => anexo(tx, alvo, { [alvo]: -919299 }))).toMatchObject({ code: '23503' });
});

test('vínculo exige exatamente um registro, inclusive quando os mesmos IDs existem em tabelas distintas', async () => {
  const casos: Record<string, number | null>[] = [{ veiculo_id: null }, { motorista_id: -27001 }];
  for (const dados of casos) {
    expect(await ensaio(tx => anexo(tx, 'veiculo_id', dados))).toMatchObject({ code: '23514', constraint_name: 'anexo_registro_check' });
  }
  expect(await ensaio(tx => anexo(tx, 'veiculo_id', { autor_id: -919299 }))).toMatchObject({ code: '23503' });
  expect(await ensaio(tx => anexo(tx, 'veiculo_id', { autor_id: null }))).toMatchObject({ code: '23502' });
});

test('mesmos bytes em dois registros mantêm vínculos e chaves separados, sem deduplicação de acesso', async () => {
  expect(await ensaio(async tx => {
    const [primeiro] = await anexo(tx, 'veiculo_id');
    const [segundo] = await anexo(tx, 'motorista_id', { id: -919204 });
    expect(primeiro.sha256).toBe(segundo.sha256);
    expect(primeiro.chave).not.toBe(segundo.chave);
    expect(await tx`SELECT id FROM public.anexo WHERE veiculo_id=-27001`).toContainEqual({ id: '-919201' });
    expect(await tx`SELECT id FROM public.anexo WHERE veiculo_id=-27001`).not.toContainEqual({ id: '-919204' });
  })).toBe(rollback);
});

const metadadosInvalidos: Record<string, string | number | Buffer>[] = [
  { nome: '../arquivo.png' }, { nome: 'a\\b.png' }, { nome: '\r\narquivo.png' }, { nome: '   ' },
  { sha256: '0'.repeat(64) }, { tamanho: 1 }, { tipo: 'application/pdf' }, { dados: Buffer.from('falso') },
];
test.each(metadadosInvalidos)('rejeita metadados/assinatura inconsistentes: %j', async dados => {
  expect(await ensaio(tx => anexo(tx, 'veiculo_id', dados))).toMatchObject({ code: '23514' });
});

test('limite técnico comum de 5 MiB é exato; byte excedente não persiste', async () => {
  for (const tamanho of [5242880, 5242881]) {
    const dados = Buffer.concat([png, Buffer.alloc(tamanho - png.length)]);
    const resultado = await ensaio(tx => anexo(tx, 'veiculo_id', { tamanho, dados, sha256: hash(dados) }));
    if (tamanho === 5242880) expect(resultado).toBe(rollback);
    else expect(resultado).toMatchObject({ code: '23514', constraint_name: 'anexo_tamanho_check' });
  }
});

test('versões documental/CNH e datas civis ficam preservadas sem sobrescrever o cadastro', async () => {
  expect(await ensaio(async tx => {
    const [antes] = await tx`SELECT cnh, categoria_cnh, validade_cnh FROM public.motorista WHERE id=-27001`;
    await historico(tx);
    await historico(tx, { id: -919205, versao: 2, data_vencimento: '2030-03-31' });
    await historico(tx, { id: -919206, documento_veiculo_id: null, motorista_id: -27001,
      tipo_documento: null, status_regular: null, numero_cnh: 'CNH-FIXTURE', categoria_cnh: 'D' });
    expect(await tx`SELECT versao, data_vencimento::text FROM public.documento_historico
      WHERE documento_veiculo_id=-27001 ORDER BY versao`).toEqual([
      { versao: 1, data_vencimento: '2028-02-29' }, { versao: 2, data_vencimento: '2030-03-31' },
    ]);
    expect((await tx`SELECT cnh, categoria_cnh, validade_cnh FROM public.motorista WHERE id=-27001`)[0]).toEqual(antes);
  })).toBe(rollback);
  expect(await ensaio(async tx => { await historico(tx); await historico(tx, { id: -919205 }); }))
    .toMatchObject({ code: '23505', constraint_name: 'documento_historico_documento_versao_key' });
  // Envia texto ao PostgreSQL: o serializador Date do INSERT de objeto normaliza
  // datas JS inválidas antes de chegarem ao banco. A API também deve validar a data civil.
  expect(await ensaio(tx => tx`INSERT INTO public.documento_historico
    (id, documento_veiculo_id, versao, tipo_documento, data_vencimento, autor_id)
    VALUES (-919202, -27001, 1, 'Fixture', ${'2027-02-29'}::text::date, -27002)`))
    .toMatchObject({ code: '22008' });
  expect(await ensaio(tx => historico(tx, { versao: 0 }))).toMatchObject({ code: '23514' });
  expect(await ensaio(tx => historico(tx, { autor_id: null }))).toMatchObject({ code: '23502' });
});

test('histórico não aceita arquivo pertencente a outro documento ou motorista', async () => {
  expect(await ensaio(async tx => { await anexo(tx, 'documento_veiculo_id'); await historico(tx, { anexo_id: -919201 }); })).toBe(rollback);
  expect(await ensaio(async tx => { await anexo(tx, 'motorista_id'); await historico(tx, { anexo_id: -919201 }); }))
    .toMatchObject({ code: '23503', constraint_name: 'documento_historico_anexo_documento_fk' });
  expect(await ensaio(async tx => {
    await anexo(tx, 'documento_veiculo_id');
    await historico(tx, { anexo_id: -919201, documento_veiculo_id: null, motorista_id: -27001,
      tipo_documento: null, status_regular: null, numero_cnh: 'CNH-FIXTURE', categoria_cnh: 'D' });
  })).toMatchObject({ code: '23503', constraint_name: 'documento_historico_anexo_motorista_fk' });
});

test('nota preserva autor/texto/instante e exige um registro válido', async () => {
  expect(await ensaio(async tx => {
    await nota(tx);
    const [registro] = await tx`SELECT autor_id, texto, criado_em FROM public.anotacao WHERE id=-919203`;
    expect(registro).toMatchObject({ autor_id: '-27002', texto: 'Nota de teste sem dado pessoal' });
    expect(registro.criado_em).toBeInstanceOf(Date);
  })).toBe(rollback);
  const casos: Record<string, string | number | null>[] = [
    { veiculo_id: null }, { viagem_id: -27001 }, { texto: ' ' }, { texto: 'a'.repeat(2001) },
  ];
  for (const dados of casos) {
    expect(await ensaio(tx => nota(tx, dados))).toMatchObject({ code: '23514' });
  }
  expect(await ensaio(tx => nota(tx, { veiculo_id: -919299 }))).toMatchObject({ code: '23503' });
});

test.each(tabelas)('Data API não lê %s e o papel backend não reescreve nem apaga histórico', async tabela => {
  for (const papel of ['anon', 'authenticated']) {
    expect(await ensaio(async tx => {
      await tx.unsafe('SET LOCAL ROLE ' + papel);
      await tx`SELECT id FROM ${tx('public.' + tabela)}`;
    }, admin)).toMatchObject({ code: '42501' });
  }
  for (const verbo of ['UPDATE', 'DELETE']) {
    expect(await ensaio(async tx => {
      if (verbo === 'UPDATE') await tx`UPDATE ${tx('public.' + tabela)} SET id=id WHERE id=-919201`;
      else await tx`DELETE FROM ${tx('public.' + tabela)} WHERE id=-919201`;
    })).toMatchObject({ code: '42501' });
  }
});

test.each(tabelas)('rollback recusa perda de dados em %s', async tabela => {
  expect(await ensaio(async tx => {
    if (tabela === 'anexo') await anexo(tx);
    else if (tabela === 'documento_historico') await historico(tx);
    else await nota(tx);
    await tx.unsafe(backward);
  }, admin)).toMatchObject({ message: expect.stringContaining('Rollback SCRUM-192 recusado') });
});

test('rollback vazio e reaplicação preservam esquema/linhas anteriores; nenhum backfill fictício', async () => {
  expect(await ensaio(async tx => {
    const antes = await metadados(tx);
    const documentos = await tx`SELECT * FROM public.documento_veiculo ORDER BY id`;
    const motoristas = await tx`SELECT id,cnh,categoria_cnh,validade_cnh FROM public.motorista ORDER BY id`;
    await tx.unsafe(backward);
    const revertido = await metadados(tx);
    expect(revertido.tables.map(t => t.name)).toEqual(antes.tables.filter(t => !tabelas.includes(t.name)).map(t => t.name));
    await tx.unsafe(forward);
    expect(await metadados(tx)).toEqual(antes);
    expect(await tx`SELECT * FROM public.documento_veiculo ORDER BY id`).toEqual(documentos);
    expect(await tx`SELECT id,cnh,categoria_cnh,validade_cnh FROM public.motorista ORDER BY id`).toEqual(motoristas);
    for (const tabela of tabelas) expect(await tx`SELECT id FROM ${tx('public.' + tabela)}`).toEqual([]);
  }, admin)).toBe(rollback);
});
