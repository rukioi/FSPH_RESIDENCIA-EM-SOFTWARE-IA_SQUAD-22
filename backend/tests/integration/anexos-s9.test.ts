import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { anexosSchemas } from '../../src/modules/anexos/anexos.schemas.js';
import { falharAuditoriaAnexo, pngAnexo, prepararAnexos } from '../helpers/anexos-fixture.js';

const server = createApp();
let fixture: Awaited<ReturnType<typeof prepararAnexos>>;
let base: string;
beforeAll(async () => {
  fixture = await prepararAnexos();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => { await fixture?.limparUploads(); });
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await fixture?.limpar();
});
const headers = (ator: string | null): Record<string, string> => ator ? { Authorization: `Bearer ${fixture.tokens[ator] ?? ator}` } : {};
const get = (path: string, ator: string | null = 'ADM') => fetch(base + path, { headers: headers(ator) });
function upload(tipoRegistro = 'VEICULO', registroId = '92194', ator: string | null = 'ADM',
  bytes = pngAnexo, tipo = 'image/png', nome = 'arquivo.png', campos: [string, string][] = []) {
  const body = new FormData();
  body.append('tipoRegistro', tipoRegistro); body.append('registroId', registroId);
  for (const [k, v] of campos) body.append(k, v);
  body.append('arquivo', new Blob([new Uint8Array(bytes)], { type: tipo }), nome);
  return fetch(base + '/api/anexos', { method: 'POST', headers: headers(ator), body });
}
const consulta = (tipo = 'VEICULO', id = '92194') => `/api/anexos?tipoRegistro=${tipo}&registroId=${id}`;

test.each([
  ['SOLICITACAO_VIAGEM','92194','SOLICITANTE_INTERNO','solicitacao_viagem_id'],
  ['SOLICITACAO_SVO','92194','ATENDENTE_SVO','solicitacao_obito_id'],
  ['VIAGEM','92194','MOTORISTA','viagem_id'], ['ORDEM_SVO','92194','MOTORISTA','ordem_coleta_id'],
  ['ABASTECIMENTO','92194','GESTOR_FROTA','abastecimento_id'], ['VEICULO','92194','ADM','veiculo_id'],
  ['MOTORISTA','92199','GESTOR_FROTA','motorista_id'], ['DOCUMENTO_VEICULO','92194','ADM','documento_veiculo_id'],
])('upload/listagem/download persistidos e privados: %s', async (tipo, id, ator, coluna) => {
  const response = await upload(tipo, id, ator);
  expect(response.status).toBe(201);
  const { data } = anexosSchemas.RespostaAnexo.parse(await response.json());
  expect(data).toMatchObject({ tipoRegistro: tipo, registroId: id, tamanho: pngAnexo.length });
  expect(JSON.stringify(data)).not.toMatch(/senha|chave|dados|https?:|url/i);
  const [row] = await fixture.sql`SELECT ${fixture.sql(coluna)} AS vinculo,dados,autor_id,sha256
    FROM anexo WHERE id=${data.id}`;
  expect(row).toMatchObject({ vinculo: id, dados: pngAnexo, sha256: data.sha256, autor_id: data.autorId });
  for (let reload = 0; reload < 2; reload++) {
    const list = await get(consulta(tipo, id), ator);
    expect(list.status).toBe(200);
    expect(anexosSchemas.ListaAnexos.parse(await list.json()).data).toEqual([data]);
    const download = await get('/api/anexos/' + data.id, ator);
    expect(download.status).toBe(200);
    expect(download.headers.get('cache-control')).toBe('private, no-store');
    expect(download.headers.get('x-content-type-options')).toBe('nosniff');
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await download.arrayBuffer())).toEqual(pngAnexo);
  }
  const logs = await fixture.sql`SELECT descricao FROM log_atividade WHERE usuario_id=${data.autorId}`;
  expect(logs).toContainEqual({ descricao: `Anexou arquivo ID ${data.id}` });
});

test.each(['application/pdf', 'image/jpeg', 'image/png'])('MIME %s validado por assinatura real', async tipo => {
  const bytes = tipo === 'application/pdf' ? Buffer.from('%PDF-1.7\nfixture')
    : tipo === 'image/jpeg' ? Buffer.from('ffd8ff01', 'hex') : pngAnexo;
  expect((await upload('VEICULO','92194','ADM', bytes, tipo)).status).toBe(201);
  expect((await upload('VEICULO','92194','ADM', Buffer.from('arquivo falsificado'), tipo)).status).toBe(415);
});

test('sessão atual: 401 sem token/inativo, 403 perfil revogado e download sem bypass por ID', async () => {
  const { data } = await (await upload()).json();
  for (const ator of [null, 'invalido']) {
    expect((await upload('VEICULO','92194',ator)).status).toBe(401);
    expect((await get(consulta(),ator)).status).toBe(401);
    expect((await get('/api/anexos/' + data.id,ator)).status).toBe(401);
  }
  try {
    await fixture.sql`UPDATE usuario SET perfil='SOLICITANTE_INTERNO' WHERE id=92194`;
    expect((await get('/api/anexos/' + data.id)).status).toBe(403);
    expect((await upload()).status).toBe(403);
    await fixture.sql`UPDATE usuario SET ativo=false WHERE id=92194`;
    expect((await get(consulta())).status).toBe(401);
  } finally { await fixture.sql`UPDATE usuario SET perfil='ADM',ativo=true WHERE id=92194`; }
});

test.each([
  ['SOLICITACAO_VIAGEM','SOLICITANTE_INTERNO','outroSolicitante'],
  ['VIAGEM','MOTORISTA','outroMotorista'], ['ORDEM_SVO','MOTORISTA','outroMotorista'],
])('IDs cruzados são ocultos; download revalida proprietário: %s', async (tipo, dono, outro) => {
  const { data } = await (await upload(tipo,'92194',dono)).json();
  for (const response of [await upload(tipo,'92194',outro), await get(consulta(tipo),outro),
    await get('/api/anexos/' + data.id,outro)]) {
    expect(response.status).toBe(404);
    expect((await response.json()).error.message).not.toMatch(/Fixture|motorista|solicitante/i);
  }
  if (tipo === 'VIAGEM' || tipo === 'ORDEM_SVO') {
    const tabela = tipo === 'VIAGEM' ? 'viagem' : 'ordem_coleta';
    try {
      await fixture.sql`UPDATE ${fixture.sql(tabela)} SET motorista_id=92200 WHERE id=92194`;
      expect((await get('/api/anexos/' + data.id,dono)).status).toBe(404);
      expect((await get('/api/anexos/' + data.id,outro)).status).toBe(200);
    } finally { await fixture.sql`UPDATE ${fixture.sql(tabela)} SET motorista_id=92199 WHERE id=92194`; }
  }
});

test.each([
  ['ORDEM_SVO','ADM'], ['SOLICITACAO_SVO','GESTOR_FROTA'], ['DOCUMENTO_VEICULO','ATENDENTE_SVO'],
  ['MOTORISTA','MOTORISTA'], ['ABASTECIMENTO','SOLICITANTE_INTERNO'], ['SOLICITACAO_VIAGEM','MOTORISTA'],
])('nega domínio/perfil sem ampliar RBAC: %s/%s', async (tipo, ator) => {
  expect((await upload(tipo,'92194',ator)).status).toBe(403);
  expect((await get(consulta(tipo),ator)).status).toBe(403);
});

test('404 não grava arquivo órfão; vínculo desconhecido/múltiplo/overflow recebe 400', async () => {
  expect((await upload('VEICULO','999999999')).status).toBe(404);
  for (const [tipo,id] of [['OUTRO','92194'],['VEICULO','9223372036854775808'],['VEICULO','1 OR 1=1']]) {
    expect((await upload(tipo,id)).status).toBe(400);
  }
  expect((await upload('VEICULO','92194','ADM',pngAnexo,'image/png','x.png',[['registroId','92195']])).status).toBe(400);
  expect((await upload('VEICULO','92194','ADM',pngAnexo,'image/png','x.png',[['autorId','92195']])).status).toBe(400);
  expect((await get('/api/anexos/999999999')).status).toBe(404);
  expect((await get(consulta())).status).toBe(200);
  expect((await (await get(consulta())).json()).meta.total).toBe(0);
});

test('nome/caminho, tipo indevido e limites são rejeitados antes de persistir', async () => {
  for (const nome of ['../segredo.png','..\\segredo.png','x'.repeat(256),'.','..']) {
    expect((await upload('VEICULO','92194','ADM',pngAnexo,'image/png',nome)).status).toBe(400);
  }
  expect((await upload('VEICULO','92194','ADM',pngAnexo,'text/plain')).status).toBe(415);
  const bytes = Buffer.alloc(5242880, 1); pngAnexo.copy(bytes);
  expect((await upload('VEICULO','92194','ADM',bytes)).status).toBe(201);
  expect((await upload('VEICULO','92194','ADM',Buffer.concat([bytes,Buffer.from([1])]))).status).toBe(413);
  expect((await get(consulta())).status).toBe(200);
  expect((await (await get(consulta())).json()).meta.total).toBe(1);
});

test('página determinística, vazio real e query estrita sem misturar vínculos', async () => {
  const primeiro = await (await upload()).json();
  const segundo = await (await upload()).json();
  await upload('VEICULO','92195');
  const pagina = await (await get(consulta() + '&limit=1&page=2')).json();
  expect(pagina).toMatchObject({data:[primeiro.data],meta:{page:2,limit:1,total:2}});
  expect((await (await get(consulta() + '&limit=1')).json()).data).toEqual([segundo.data]);
  expect((await (await get(consulta() + '&page=3&limit=1')).json()).data).toEqual([]);
  for (const query of ['&page=0','&page=1e2','&page=1&page=2','&limit=101','&campo=ignorado']) {
    expect((await get(consulta() + query)).status).toBe(400);
  }
});

test('falha real da auditoria reverte bytes e metadados; nenhum conteúdo privado entra no erro/log', async () => {
  await falharAuditoriaAnexo(fixture.admin, async () => {
    const response = await upload('VEICULO','92194','ADM',pngAnexo,'image/png','dado-privado-sentinela.png');
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/sentinela|SQL|INSERT|fixture_anexo|stack/i);
    expect(await fixture.sql`SELECT id FROM anexo WHERE autor_id=92194`).toHaveLength(0);
    expect(await fixture.sql`SELECT id FROM log_atividade WHERE usuario_id=92194`).toHaveLength(0);
  });
  const { data } = await (await upload()).json();
  expect((await fetch(base + '/api/anexos/' + data.id, {method:'DELETE',headers:headers('ADM')})).status).toBe(405);
  expect((await get('/api/anexos/' + data.id)).status).toBe(200);
});
