import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import type { AddressInfo } from 'node:net';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { createApp } from '../../src/app.js';
import { criarJwt } from '../../src/security/jwt.js';
import { registrarAtividades, type EventoAtividade } from '../../src/modules/auditoria/auditoria.service.js';
import * as repository from '../../src/modules/auditoria/auditoria.repository.js';

const sql = await verifiedSql();
const server = createApp();
let base: string;
let adminToken: string;
let svoToken: string;
const sentinela = 'SENHA-TOKEN-CPF-TELEFONE-MEDICO-T31';
beforeAll(async () => {
  await sql`insert into public.usuario (id,nome,email,senha_hash,perfil,ativo) values
    (31101,'Fixture T31 Ator','t31-ator@example.invalid','sem-login','ADM',true),
    (31102,'Fixture T31 Alvo','t31-alvo@example.invalid','hash-original','MOTORISTA',true),
    (31103,'Fixture T31 SVO','t31-svo@example.invalid','sem-login','ATENDENTE_SVO',true)`;
  adminToken = await criarJwt({ id: '31101', perfil: 'ADM' });
  svoToken = await criarJwt({ id: '31103', perfil: 'ATENDENTE_SVO' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await sql`delete from public.ordem_coleta where solicitacao_obito_id in
    (select id from public.solicitacao_obito where atendente_id=31103)`;
  await sql`delete from public.solicitacao_obito where atendente_id=31103`;
  await sql`delete from public.log_atividade where usuario_id in (31101,31102,31103)`;
  await sql`delete from public.usuario where id in (31101,31102,31103) or email='t31-rollback@example.invalid'`;
  await sql.end();
});
function call(path: string, method: string, body: unknown, token = adminToken) {
  return fetch(base + path, { method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}
async function alvo() { return (await sql`select nome,email,perfil,ativo,senha_hash from public.usuario where id=31102`)[0]; }
async function numeroAtividades() {
  return Number((await sql`select count(*) as n from public.log_atividade where usuario_id in (31101,31103)`)[0].n);
}

for (const caso of [
  { method: 'POST', path: '/api/admin/usuarios', body: { nome: 'Fixture T31 Novo',
    email: 't31-rollback@example.invalid', perfil: 'MOTORISTA', senha: sentinela } },
  { method: 'PUT', path: '/api/admin/usuarios/31102', body: { nome: 'Fixture T31 Editado',
    email: 't31-alvo@example.invalid', perfil: 'GESTOR_FROTA', senha: sentinela } },
  { method: 'PATCH', path: '/api/admin/usuarios/31102/status', body: { ativo: false } },
]) {
  test(`${caso.method} usuário reverte alteração e auditoria quando INSERT de atividade viola FK real`, async () => {
    const antes = await alvo();
    const quantidade = await numeroAtividades();
    const original = repository.inserirAtividades;
    // Falha no PostgreSQL real, após a escrita do usuário, dentro da transação recebida.
    const spy = vi.spyOn(repository, 'inserirAtividades').mockImplementationOnce((tx, _id, descricoes) =>
      original(tx, '319999999', descricoes));
    const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await call(caso.path, caso.method, caso.body);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: { code: 'ERRO_INTERNO', message: 'Não foi possível concluir a requisição.' } });
      expect(spy).toHaveBeenCalledOnce();
      expect(JSON.stringify(logger.mock.calls)).not.toContain(sentinela);
      expect(logger.mock.calls.some(args => String(args[0]).includes('23503'))).toBe(true);
    } finally { spy.mockRestore(); logger.mockRestore(); }
    expect(await alvo()).toEqual(antes);
    expect(await numeroAtividades()).toBe(quantidade);
    expect(await sql`select id from public.usuario where email='t31-rollback@example.invalid'`).toHaveLength(0);
  });
}

const dadosSvo = { localFalecimento: 'Fixture Hospital', enderecoRemocao: 'Fixture Rua',
  solicitanteNome: sentinela, solicitanteTelefone: '11999990000', observacoesMedicas: sentinela };

test('SVO reverte solicitação, ordem e as duas atividades quando a atividade falha no banco', async () => {
  const original = repository.inserirAtividades;
  const spy = vi.spyOn(repository, 'inserirAtividades').mockImplementationOnce((tx, _id, descricoes) =>
    original(tx, '319999999', descricoes));
  const logger = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect((await call('/api/svo/solicitacoes', 'POST', dadosSvo, svoToken)).status).toBe(500);
    expect(spy).toHaveBeenCalledOnce();
    expect(JSON.stringify(logger.mock.calls)).not.toContain(sentinela);
  } finally { spy.mockRestore(); logger.mockRestore(); }
  expect(await sql`select id from public.solicitacao_obito where atendente_id=31103`).toHaveLength(0);
  expect(await sql`select id from public.log_atividade where usuario_id=31103`).toHaveLength(0);
  // Nenhuma ordem órfã pode ter sido confirmada após a reversão da solicitação.
  expect(await sql`select oc.id from public.ordem_coleta oc left join public.solicitacao_obito so
    on so.id=oc.solicitacao_obito_id where oc.solicitacao_obito_id is not null and so.id is null`).toHaveLength(0);
});

test('SVO confirma as duas atividades sem dados pessoais; gravação usa a transação do chamador', async () => {
  const response = await call('/api/svo/solicitacoes', 'POST', dadosSvo, svoToken);
  expect(response.status).toBe(201);
  const body = await response.json();
  const rows = await sql`select descricao from public.log_atividade where usuario_id=31103 order by id`;
  expect(rows).toHaveLength(2);
  expect(rows.map(r => r.descricao)).toEqual(body.atividades);
  expect(JSON.stringify(rows)).not.toMatch(/SENHA|TOKEN|CPF|TELEFONE|MEDICO|11999990000/);
  const quantidade = await numeroAtividades();
  await expect(sql.begin(async tx => {
    await tx`update public.usuario set nome='Fixture rollback chamador' where id=31102`;
    await registrarAtividades(tx, '31101', [{ operacao: 'usuario_editado', recursoId: '31102' }]);
    throw new Error('rollback solicitado pela fixture');
  })).rejects.toThrow('rollback solicitado pela fixture');
  expect((await alvo()).nome).toBe('Fixture T31 Alvo');
  expect(await numeroAtividades()).toBe(quantidade);
});

test('eventos/identificadores inválidos não são interpolados e não gravam atividade', async () => {
  const quantidade = await numeroAtividades();
  for (const evento of [
    { operacao: 'usuario_editado', recursoId: sentinela },
    { operacao: sentinela, recursoId: '31102' },
    { operacao: 'ordem_gerada', recursoId: '1', solicitacaoId: sentinela },
  ]) {
    await expect(sql.begin(tx => registrarAtividades(tx, '31101', [evento as EventoAtividade])))
      .rejects.toThrow(/inválid/);
  }
  expect(await numeroAtividades()).toBe(quantidade);
});
