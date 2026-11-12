import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { request } from 'node:http';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';
import { abastecimentosSchemas } from '../../src/modules/abastecimentos/abastecimentos.schemas.js';

const sql = await verifiedSql();
const server = createApp();
const usuario = 91870;
const veiculos = [91870, 91871];
const svo = veiculos[1];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=', 'base64');
let base: string;
let token: string;
const entrada = { veiculo_id: svo, litragem: '0.10', valor_total: '0.10', data_abastecimento: '2026-08-10' };

beforeAll(async () => {
  await sql`INSERT INTO usuario (id,nome,email,senha_hash,perfil,ativo)
    VALUES (${usuario},'Fixture S9 comprovantes','s9-comprovantes@example.invalid','sem-login','GESTOR_FROTA',true)`;
  await sql`INSERT INTO veiculo (id,placa,marca,modelo,ano,tipo,is_svo) VALUES
    (91870,'S9AB070','Fixture','Comum',2026,'PASSEIO',false),
    (91871,'S9AB071','Fixture','SVO',2026,'RABECÃO_SVO',true)`;
  token = await criarJwt({ id: String(usuario), perfil: 'GESTOR_FROTA' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

async function limparRegistros() {
  await sql`DELETE FROM abastecimento WHERE veiculo_id=ANY(${veiculos}::bigint[])`;
  await sql`DELETE FROM log_atividade WHERE usuario_id=${usuario}`;
}
afterEach(limparRegistros);
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  try {
    await limparRegistros();
    await sql`DELETE FROM veiculo WHERE id=ANY(${veiculos}::bigint[])`;
    await sql`DELETE FROM usuario WHERE id=${usuario}`;
  } finally { await sql.end(); }
});

const get = (path: string, auth: string | null = token) => fetch(base + path, {
  headers: auth === null ? {} : { Authorization: `Bearer ${auth}` },
});
const post = (body: unknown, contentType = 'application/json') => fetch(base + '/api/abastecimentos', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType }, body: JSON.stringify(body),
});
async function cadastrar(extra: Record<string, unknown> = {}) {
  const response = await post({ ...entrada, ...extra });
  expect(response.status).toBe(201);
  return abastecimentosSchemas.RespostaDetalheAbastecimento.parse(await response.json()).data;
}
async function indicadores(query: string) {
  const response = await get('/api/abastecimentos/indicadores?' + query);
  expect(response.status).toBe(200);
  return abastecimentosSchemas.IndicadoresAbastecimentos.parse(await response.json()).data;
}

test.each([
  ['image/png', png],
  // O contrato legado valida assinatura; decodificação completa não é alegada por este teste.
  ['image/jpeg', Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])],
] as const)('comprovante legado %s mantém vínculo, metadados existentes e bytes privados', async (tipo, bytes) => {
  const nome = tipo === 'image/png' ? 's9-187.png' : 's9-187.jpg';
  const registro = await cadastrar({ comprovante: { nome, tipo, dadosBase64: bytes.toString('base64') } });
  const [arquivo] = await sql`SELECT abastecimento_id,nome,tipo,dados FROM abastecimento_comprovante
    WHERE abastecimento_id=${registro.id}`;
  expect(arquivo).toMatchObject({ abastecimento_id: registro.id, nome, tipo });
  expect(Buffer.from(arquivo.dados)).toEqual(bytes);
  for (let consulta = 0; consulta < 2; consulta++) {
    const detalhe = await get(`/api/abastecimentos/${registro.id}`);
    expect(detalhe.status).toBe(200);
    const body = await detalhe.json();
    expect(body.data).toMatchObject({ id: registro.id, comprovante_nome: nome, criado_por_id: String(usuario) });
    expect(JSON.stringify(body)).not.toMatch(/dadosBase64|"dados"|senha|https?:\/\//);
    const download = await get(`/api/abastecimentos/${registro.id}/comprovante`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe(tipo);
    expect(download.headers.get('cache-control')).toBe('private, no-store');
    expect(download.headers.get('x-content-type-options')).toBe('nosniff');
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
  }
});

test('download aplica 401/403 ao perfil atual e 404 sem arquivo, sem expor bytes', async () => {
  const registro = await cadastrar({ comprovante: { nome: 's9-187.png', tipo: 'image/png', dadosBase64: png.toString('base64') } });
  const path = `/api/abastecimentos/${registro.id}/comprovante`;
  for (const auth of [null, 'token-invalido']) expect((await get(path, auth)).status).toBe(401);
  try {
    await sql`UPDATE usuario SET perfil='MOTORISTA' WHERE id=${usuario}`;
    const negado = await get(path);
    expect(negado.status).toBe(403);
    expect((await negado.json()).error.code).toBe('ACESSO_NEGADO');
    await sql`UPDATE usuario SET perfil='GESTOR_FROTA',ativo=false WHERE id=${usuario}`;
    expect((await get(path)).status).toBe(401);
  } finally { await sql`UPDATE usuario SET perfil='GESTOR_FROTA',ativo=true WHERE id=${usuario}`; }
  const semArquivo = await cadastrar();
  for (const id of [semArquivo.id, '999999999', '9223372036854775808']) {
    const response = await get(`/api/abastecimentos/${id}/comprovante`);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('NAO_ENCONTRADO');
  }
});

test.each([
  ['application/octet-stream', 415, 'TIPO_NAO_SUPORTADO'],
  ['application/json', 413, 'CORPO_MUITO_GRANDE'],
] as const)('corpo %s retorna %i/%s sem persistência e mantém servidor disponível', async (tipo, status, code) => {
  const extra = status === 413 ? { posto: 'x'.repeat(1500 * 1024) } : {};
  const response = await post({ ...entrada, ...extra }, tipo);
  expect(response.status).toBe(status);
  expect((await response.json()).error.code).toBe(code);
  expect((await sql`SELECT id FROM abastecimento WHERE veiculo_id=${svo}`)).toHaveLength(0);
  expect((await sql`SELECT id FROM log_atividade WHERE usuario_id=${usuario}`)).toHaveLength(0);
  expect((await get('/api/abastecimentos?veiculoId=' + svo)).status).toBe(200);
});

test.each([1048576, 1048577])('limite legado de imagem %i bytes é distinto do limite JSON', async tamanho => {
  const bytes = Buffer.alloc(tamanho);
  png.copy(bytes);
  const response = await post({ ...entrada, comprovante: { nome: 's9-limite.png', tipo: 'image/png', dadosBase64: bytes.toString('base64') } });
  expect(response.status).toBe(tamanho === 1048576 ? 201 : 400);
  if (tamanho === 1048576) {
    const { data } = await response.json();
    const [arquivo] = await sql`SELECT octet_length(dados) AS tamanho FROM abastecimento_comprovante WHERE abastecimento_id=${data.id}`;
    expect(arquivo.tamanho).toBe(tamanho);
  } else {
    expect((await response.json()).error.code).toBe('ARQUIVO_INVALIDO');
    expect((await sql`SELECT id FROM abastecimento WHERE veiculo_id=${svo}`)).toHaveLength(0);
  }
});

test('conexão interrompida durante o JSON não persiste cadastro parcial e não derruba a API', async () => {
  const parcial = JSON.stringify({ ...entrada, comprovante: { nome: 's9-interrompido.png', tipo: 'image/png' } }).slice(0, -1);
  await new Promise<void>(resolve => {
    const req = request(base + '/api/abastecimentos', { method: 'POST', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(parcial) + 100,
    } });
    req.on('error', () => {});
    req.once('close', resolve);
    req.write(parcial, () => req.destroy());
  });
  expect((await get('/api/abastecimentos?veiculoId=' + svo)).status).toBe(200);
  expect((await sql`SELECT id FROM abastecimento WHERE veiculo_id=${svo}`)).toHaveLength(0);
  expect((await sql`SELECT id FROM log_atividade WHERE usuario_id=${usuario}`)).toHaveLength(0);
  await cadastrar();
});

test('FK impede comprovante órfão e PK impede dois arquivos no mesmo vínculo legado', async () => {
  const falha = (id: string) => sql.begin(async tx => {
    await tx`INSERT INTO abastecimento_comprovante (abastecimento_id,nome,tipo,dados)
      VALUES (${id},'s9-fk.png','image/png',${png})`;
  });
  await expect(falha('999999999')).rejects.toMatchObject({ code: '23503' });
  const registro = await cadastrar({ comprovante: { nome: 's9-fk.png', tipo: 'image/png', dadosBase64: png.toString('base64') } });
  await expect(falha(registro.id)).rejects.toMatchObject({ code: '23505' });
});

test.each([['P0001', 500], ['40001', 409]] as const)('falha de auditoria %s reverte cadastro e imagem já gravada', async (code, status) => {
  const admin = await verifiedSql(true);
  try {
    await admin.unsafe(`CREATE FUNCTION public.test_s9_187_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.usuario_id=91870 THEN RAISE EXCEPTION 'fixture S9 comprovante' USING ERRCODE='${code}'; END IF; RETURN NEW; END $$`);
    await admin.unsafe(`CREATE TRIGGER test_s9_187_auditoria BEFORE INSERT ON public.log_atividade
      FOR EACH ROW EXECUTE FUNCTION public.test_s9_187_auditoria()`);
    const response = await post({ ...entrada, comprovante: { nome: 's9-187-rollback.png', tipo: 'image/png', dadosBase64: png.toString('base64') } });
    expect(response.status).toBe(status);
    expect((await response.json()).error.code).toBe(status === 409 ? 'CONFLITO' : 'ERRO_INTERNO');
    expect((await sql`SELECT id FROM abastecimento WHERE veiculo_id=${svo}`)).toHaveLength(0);
    expect((await sql`SELECT abastecimento_id FROM abastecimento_comprovante WHERE nome='s9-187-rollback.png'`)).toHaveLength(0);
    expect((await sql`SELECT id FROM log_atividade WHERE usuario_id=${usuario}`)).toHaveLength(0);
  } finally {
    await admin.unsafe('DROP TRIGGER IF EXISTS test_s9_187_auditoria ON public.log_atividade');
    await admin.unsafe('DROP FUNCTION IF EXISTS public.test_s9_187_auditoria()');
    await admin.end();
  }
});

const leituras = [
  { data_abastecimento: '2026-08-10', litragem: '0.10', valor_total: '0.10', quilometragem: null },
  { data_abastecimento: '2026-08-11', litragem: '0.20', valor_total: '0.60', quilometragem: 1000 },
  { data_abastecimento: '2026-08-12', litragem: '0.30', valor_total: '1.20', quilometragem: 1000 },
];
const indisponivel = { valor: null, estado: 'INDISPONIVEL', motivo: 'REGRA_DE_NEGOCIO_PENDENTE' };

test.each([0, 1, 3])('agregados de %i registros usam precisão decimal, período real e custo ponderado', async quantidade => {
  for (const leitura of leituras.slice(0, quantidade)) await cadastrar(leitura);
  await cadastrar({ veiculo_id: veiculos[0], litragem: '100', valor_total: '500', quilometragem: 3000 });
  const data = await indicadores(`veiculoId=${svo}&inicio=2026-08-10&fim=2026-08-12`);
  expect(data.quantidade).toBe(quantidade);
  expect(data.totalLitros).toBe(quantidade === 0 ? '0.00' : quantidade === 1 ? '0.10' : '0.60');
  expect(data.totalCusto).toBe(quantidade === 0 ? '0.00' : quantidade === 1 ? '0.10' : '1.90');
  expect(data.custoPorLitro).toBe(quantidade === 0 ? null : quantidade === 1 ? '1.0000' : '3.1667');
  expect(data.estado).toBe(quantidade === 0 ? 'SEM_ABASTECIMENTOS' : 'DISPONIVEL');
  expect(data.periodoObservado).toEqual({ inicio: quantidade ? '2026-08-10' : null, fim: quantidade === 0 ? null : quantidade === 1 ? '2026-08-10' : '2026-08-12' });
  expect(data.kmObservadosPorVeiculo).toEqual(quantidade ? [{ veiculoId: String(svo), leiturasComKm: quantidade === 3 ? 2 : 0,
    leiturasSemKm: 1, menorKm: quantidade === 3 ? 1000 : null, maiorKm: quantidade === 3 ? 1000 : null }] : []);
  expect(data.consumoPorDistancia).toEqual(indisponivel);
  expect(await indicadores(`veiculoId=${svo}&inicio=2026-08-10&fim=2026-08-12`)).toEqual(data);
});

test('filtros civis inclusivos e independentes recortam somas sem misturar veículos', async () => {
  const globalAntes = await indicadores('inicio=2026-08-10&fim=2026-08-12');
  for (const leitura of leituras) await cadastrar(leitura);
  await cadastrar({ veiculo_id: veiculos[0], litragem: '2', valor_total: '4' });
  for (const [filtro, total, custo, quantidade] of [
    ['inicio=2026-08-11', '0.50', '1.80', 2], ['fim=2026-08-11', '0.30', '0.70', 2],
    ['inicio=2026-08-11&fim=2026-08-11', '0.20', '0.60', 1],
    ['inicio=2026-08-13', '0.00', '0.00', 0],
  ] as const) {
    expect(await indicadores(`veiculoId=${svo}&${filtro}`)).toMatchObject({ totalLitros: total, totalCusto: custo, quantidade });
  }
  const globalDepois = await indicadores('inicio=2026-08-10&fim=2026-08-12');
  expect(globalDepois.quantidade - globalAntes.quantidade).toBe(4);
  expect(BigInt(globalDepois.totalLitros.replace('.', '')) - BigInt(globalAntes.totalLitros.replace('.', ''))).toBe(260n);
  expect(BigInt(globalDepois.totalCusto.replace('.', '')) - BigInt(globalAntes.totalCusto.replace('.', ''))).toBe(590n);
});

test('km repetido/regressivo mantém cronologia e não altera odômetro nem cria consumo', async () => {
  const [antes] = await sql`SELECT to_jsonb(v) AS dados FROM veiculo v WHERE id=${svo}`;
  for (const [indice, km] of [1200, 1200, 1000].entries()) {
    await cadastrar({ data_abastecimento: `2026-08-${10 + indice}`, quilometragem: km });
  }
  const data = await indicadores(`veiculoId=${svo}`);
  expect(data.kmObservadosPorVeiculo).toEqual([{ veiculoId: String(svo), leiturasComKm: 3, leiturasSemKm: 0, menorKm: 1000, maiorKm: 1200 }]);
  expect(data.consumoPorDistancia).toEqual(indisponivel);
  const response = await get(`/api/veiculos/${svo}/abastecimentos`);
  expect(response.status).toBe(200);
  const historico = abastecimentosSchemas.HistoricoAbastecimentos.parse(await response.json());
  expect(historico.data.map(r => r.quilometragem)).toEqual([1200, 1200, 1000]);
  expect((await sql`SELECT to_jsonb(v) AS dados FROM veiculo v WHERE id=${svo}`)[0]).toEqual(antes);
});
