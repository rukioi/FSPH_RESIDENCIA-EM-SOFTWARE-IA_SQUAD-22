import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { root, assertTarget, testUrl, verifiedSql } from '../../src/database/scripts/verify-test-db.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { sql = await verifiedSql(); });
afterAll(async () => { await sql?.end(); });

test.each([
  'postgresql://fixture:fixture@example.invalid:5432/production',
  'postgresql://postgres:postgres@127.0.0.1:5432/postgres',
  'postgresql://postgres:postgres@127.0.0.1:55432/postgres',
  testUrl + '?sslmode=require',
])('recusa alvo arbitrário antes de abrir conexão: %s', target => {
  expect(() => assertTarget(target)).toThrow('Alvo recusado');
});
test('sem identidade, os dois módulos de conexão recusam abrir pool', () => {
  for (const module of ['database/connection.ts', 'config/db.ts']) {
    let output = '';
    try {
      execFileSync(process.execPath, [
        '--import', 'tsx', '--input-type=module', '-e',
        "await import('./backend/src/" + module + "')",
      ], {
        cwd: root, encoding: 'utf8',
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
          NODE_ENV: 'test', DATABASE_URL: testUrl },
        stdio: 'pipe',
      });
    } catch (error) {
      output = String((error as { stderr?: string }).stderr);
    }
    expect(output).toContain('Identidade de teste ausente');
  }
});
test('FK rejeita referência inexistente no PostgreSQL', async () => {
  await expect(sql.begin(async tx => {
    await tx`insert into public.log_atividade (id, usuario_id, descricao)
      values (-27990, -27999, 'Fixture FK T1')`;
  })).rejects.toMatchObject({ code: '23503' });
});
test('CHECK validado aceita os dois vínculos auditados e rejeita outro valor', async () => {
  await expect(sql.begin(async tx => {
    await tx`update public.veiculo set vinculo = 'LOCADO' where id = -27001`;
    await tx`update public.veiculo set vinculo = 'PROPRIO' where id = -27001`;
    await tx`update public.veiculo set vinculo = 'INVALIDO' where id = -27001`;
  })).rejects.toMatchObject({ code: '23514' });
});
test('UNIQUE rejeita duplicação no PostgreSQL', async () => {
  await expect(sql.begin(async tx => {
    await tx`insert into public.usuario (id, nome, email, senha_hash)
      values (-27990, 'Fixture UNIQUE T1', 't1-adm@example.invalid', 'fixture-invalida')`;
  })).rejects.toMatchObject({ code: '23505' });
});
test('falha reverte também a gravação anterior da mesma transação', async () => {
  await expect(sql.begin(async tx => {
    await tx`insert into public.usuario (id, nome, email, senha_hash)
      values (-27990, 'Fixture rollback T1', 't1-rollback@example.invalid', 'fixture-invalida')`;
    await tx`insert into public.log_atividade (id, usuario_id, descricao)
      values (-27990, -27999, 'Fixture rollback T1')`;
  })).rejects.toMatchObject({ code: '23503' });
  const rows = await sql`select id from public.usuario where id = -27990`;
  expect(rows).toHaveLength(0);
});
test('uma transação válida grava e lê dados sintéticos antes de rollback deliberado', async () => {
  await expect(sql.begin(async tx => {
    const [row] = await tx`insert into public.usuario (nome, email, senha_hash)
      values ('Fixture sequência T1', 't1-sequence@example.invalid', 'fixture-invalida') returning id`;
    expect(BigInt(row.id)).toBeGreaterThan(0n);
    const [stored] = await tx`select nome from public.usuario where id = ${row.id}`;
    expect(stored.nome).toBe('Fixture sequência T1');
    throw new Error('rollback deliberado T1');
  })).rejects.toThrow('rollback deliberado T1');
});
