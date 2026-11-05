import { afterAll, beforeAll, expect, test } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let tokenSvo: string;
let tokenAdmin: string;
const cadastradas: string[] = [];
const atendenteId = '34001';

beforeAll(async () => {
  await sql`
    INSERT INTO public.usuario (id, nome, email, senha_hash, perfil, ativo)
    VALUES
      (34001, 'Fixture SCRUM-131 SVO', 's131-svo@example.invalid', 'sem-login', 'ATENDENTE_SVO', TRUE),
      (34002, 'Fixture SCRUM-131 ADM', 's131-adm@example.invalid', 'sem-login', 'ADM', TRUE)
  `;
  tokenSvo = await criarJwt({ id: atendenteId, perfil: 'ATENDENTE_SVO' });
  tokenAdmin = await criarJwt({ id: '34002', perfil: 'ADM' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await sql`DELETE FROM public.log_atividade WHERE usuario_id = 34001`;
  for (const id of cadastradas) {
    await sql`DELETE FROM public.ordem_coleta WHERE solicitacao_obito_id = ${id}`;
    await sql`DELETE FROM public.solicitacao_obito WHERE id = ${id}`;
  }
  await sql`DELETE FROM public.usuario WHERE id IN (34001, 34002)`;
  await sql.end();
});

async function novaSolicitacao(): Promise<string> {
  const resposta = await fetch(base + '/api/svo/solicitacoes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenSvo}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localFalecimento: 'Unidade de testes',
      enderecoRemocao: 'Rua fictícia, 100',
      solicitanteNome: 'Pessoa fictícia',
    }),
  });
  expect(resposta.status).toBe(201);
  const corpo = await resposta.json();
  const id: string = corpo.solicitacao.id;
  cadastradas.push(id);
  return id;
}

function triagem(method: 'POST' | 'PATCH', id: string, body: unknown, token = tokenSvo) {
  return fetch(`${base}/api/svo/solicitacoes/${id}/triagem`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function dadosPersistidos(id: string) {
  const [s] = await sql`
    SELECT status_triagem::text AS status_triagem, triagem_observacoes,
           triado_por_id::text AS triado_por_id, triado_em
    FROM public.solicitacao_obito WHERE id = ${id}
  `;
  const ordens = await sql`
    SELECT id::text AS id, status::text AS status, quantidade_corpos
    FROM public.ordem_coleta WHERE solicitacao_obito_id = ${id}
  `;
  return { s, ordens };
}

test('PATCH permite salvar rascunho duas vezes, sem finalizar ou gerar ordem', async () => {
  const id = await novaSolicitacao();
  for (const observacao of ['Primeira observação fictícia', 'Segunda observação fictícia']) {
    const resposta = await triagem('PATCH', id, { triagemObservacoes: observacao });
    expect(resposta.status).toBe(200);
    const body = await resposta.json();
    expect(body).toMatchObject({
      solicitacaoId: id, statusTriagem: 'AGUARDANDO_TRIAGEM', triagemObservacoes: observacao,
    });
    expect(body.atividades).toHaveLength(1);
  }
  const { s, ordens } = await dadosPersistidos(id);
  expect(s).toMatchObject({
    status_triagem: 'AGUARDANDO_TRIAGEM',
    triagem_observacoes: 'Segunda observação fictícia',
    triado_por_id: null, triado_em: null,
  });
  expect(ordens).toHaveLength(0);
});

test('POST confirma SVO, cria exatamente uma ordem e impede repetição', async () => {
  const id = await novaSolicitacao();
  const decisao = {
    decisao: 'CONFIRMADA_SVO', triagemObservacoes: 'Competência SVO fictícia', quantidadeCorpos: 2,
  };
  const primeira = await triagem('POST', id, decisao);
  expect(primeira.status).toBe(200);
  const body = await primeira.json();
  expect(body.solicitacao).toMatchObject({
    id, codigo: `#SVO-${id}`, statusTriagem: 'CONFIRMADA_SVO', triadoPorId: atendenteId,
  });
  expect(body.ordemColeta).toMatchObject({
    codigo: `#OC-${body.ordemColeta.id}`,
    status: 'PENDENTE_ALOCACAO', quantidadeCorpos: 2,
  });
  expect(body.atividades).toHaveLength(2);
  const { s, ordens } = await dadosPersistidos(id);
  expect(s.status_triagem).toBe('CONFIRMADA_SVO');
  expect(s.triado_por_id).toBe(atendenteId);
  expect(s.triado_em).not.toBeNull();
  expect(ordens).toHaveLength(1);
  expect(Number(ordens[0].quantidade_corpos)).toBe(2);
  expect((await triagem('POST', id, decisao)).status).toBe(409);
  expect((await triagem('PATCH', id, { triagemObservacoes: 'Alteração proibida' })).status).toBe(409);
  expect((await dadosPersistidos(id)).ordens).toHaveLength(1);
});

test('POST encaminha ao IML sem criar ordem e preserva a decisão', async () => {
  const id = await novaSolicitacao();
  const resposta = await triagem('POST', id, {
    decisao: 'ENCAMINHADA_IML', triagemObservacoes: 'Encaminhamento fictício',
  });
  expect(resposta.status).toBe(200);
  const body = await resposta.json();
  expect(body.solicitacao.statusTriagem).toBe('ENCAMINHADA_IML');
  expect(body.ordemColeta).toBeNull();
  const { s, ordens } = await dadosPersistidos(id);
  expect(s.status_triagem).toBe('ENCAMINHADA_IML');
  expect(s.triado_por_id).toBe(atendenteId);
  expect(s.triado_em).not.toBeNull();
  expect(ordens).toHaveLength(0);
  expect((await triagem('POST', id, {
    decisao: 'CONFIRMADA_SVO', quantidadeCorpos: 1, triagemObservacoes: 'Não deve alterar',
  })).status).toBe(409);
});

test('duas confirmações concorrentes geram uma única ordem', async () => {
  const id = await novaSolicitacao();
  const decisao = {
    decisao: 'CONFIRMADA_SVO', triagemObservacoes: 'Teste concorrente', quantidadeCorpos: 1,
  };
  const respostas = await Promise.all([
    triagem('POST', id, decisao), triagem('POST', id, decisao),
  ]);
  expect(respostas.map(r => r.status).sort()).toEqual([200, 409]);
  const { s, ordens } = await dadosPersistidos(id);
  expect(s.status_triagem).toBe('CONFIRMADA_SVO');
  expect(ordens).toHaveLength(1);
});

test('rotas protegem sessão e perfil e validam corpo/IDs', async () => {
  const id = await novaSolicitacao();
  const url = `${base}/api/svo/solicitacoes/${id}/triagem`;
  const corpo = JSON.stringify({ triagemObservacoes: 'Teste de acesso' });
  const anonimo = await fetch(url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: corpo,
  });
  expect(anonimo.status).toBe(401);
  expect((await triagem('PATCH', id, { triagemObservacoes: 'Teste' }, tokenAdmin)).status).toBe(403);
  expect((await triagem('POST', id, { decisao: 'ENCAMINHADA_IML', triagemObservacoes: 'Teste' }, tokenAdmin)).status).toBe(403);
  for (const invalido of [
    {}, { triagemObservacoes: '   ' }, { triagemObservacoes: 'x'.repeat(2001) },
    { triagemObservacoes: 'Teste', triadoPorId: atendenteId },
  ]) {
    expect((await triagem('PATCH', id, invalido)).status).toBe(400);
  }
  for (const invalido of [
    { decisao: 'CONFIRMADA_SVO', triagemObservacoes: 'Teste' },
    { decisao: 'CONFIRMADA_SVO', triagemObservacoes: 'Teste', quantidadeCorpos: 0 },
    { decisao: 'CONFIRMADA_SVO', triagemObservacoes: 'Teste', quantidadeCorpos: 5 },
    { decisao: 'ENCAMINHADA_IML', triagemObservacoes: 'Teste', quantidadeCorpos: 1 },
    { decisao: 'INVALIDA', triagemObservacoes: 'Teste' },
  ]) {
    expect((await triagem('POST', id, invalido)).status).toBe(400);
  }
  expect((await triagem('PATCH', '9223372036854775808', { triagemObservacoes: 'Teste' })).status).toBe(400);
  expect((await triagem('PATCH', '999999999999999999', { triagemObservacoes: 'Teste' })).status).toBe(404);
  const { s, ordens } = await dadosPersistidos(id);
  expect(s.status_triagem).toBe('AGUARDANDO_TRIAGEM');
  expect(ordens).toHaveLength(0);
});
