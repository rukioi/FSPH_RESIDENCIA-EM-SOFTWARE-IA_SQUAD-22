import { afterAll, beforeAll, expect, test } from 'vitest';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

let sql: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { sql = await verifiedSql(); });
afterAll(async () => { await sql?.end(); });

test('registro novo nasce aguardando triagem, com atendimento telefônico', async () => {
  await expect(sql.begin(async tx => {
    const [row] = await tx`
      insert into public.solicitacao_obito
        (id, codigo, atendente_id, local_falecimento, endereco_remocao, solicitante_nome)
      values
        (-27881, 'DB-S7-01-1', -27005, 'Local de teste', 'Endereço de teste', 'Solicitante de teste')
      returning status_triagem::text as status, canal_atendimento
    `;
    expect(row).toEqual({ status: 'AGUARDANDO_TRIAGEM', canal_atendimento: 'TELEFONE' });
    const orders = await tx`select id from public.ordem_coleta where solicitacao_obito_id = -27881`;
    expect(orders).toHaveLength(0);
    throw new Error('rollback deliberado SVO');
  })).rejects.toThrow('rollback deliberado SVO');
});

test('decisão final exige responsável e data de triagem', async () => {
  await expect(sql.begin(async tx => {
    await tx`
      update public.solicitacao_obito
      set status_triagem = 'ENCAMINHADA_IML', triado_por_id = NULL,
          triado_em = '2026-11-03 12:00:00'
      where id = -27006
    `;
  })).rejects.toMatchObject({ code: '23514' });
});

test('triagem IML permanece sem ordem; SVO confirmado tem ordem na fixture', async () => {
  const [iml] = await sql`
    select s.status_triagem::text as status, count(o.id)::integer as ordens
    from public.solicitacao_obito s
    left join public.ordem_coleta o on o.solicitacao_obito_id = s.id
    where s.id = -27007
    group by s.status_triagem
  `;
  expect(iml).toEqual({ status: 'ENCAMINHADA_IML', ordens: 0 });
  const [confirmed] = await sql`
    select s.status_triagem::text as status, count(o.id)::integer as ordens
    from public.solicitacao_obito s
    left join public.ordem_coleta o on o.solicitacao_obito_id = s.id
    where s.id = -27001
    group by s.status_triagem
  `;
  expect(confirmed).toEqual({ status: 'CONFIRMADA_SVO', ordens: 1 });
});

test('quantidade explícita permite 1 a 4 corpos e rejeita 5', async () => {
  await expect(sql.begin(async tx => {
    const [row] = await tx`
      update public.ordem_coleta
      set quantidade_corpos = 4
      where id = -27001
      returning quantidade_corpos
    `;
    expect(row.quantidade_corpos).toBe(4);
    await tx`update public.ordem_coleta set quantidade_corpos = 5 where id = -27001`;
  })).rejects.toMatchObject({ code: '23514' });
});

test('restrição UNIQUE existente continua impedindo duas ordens para uma ocorrência', async () => {
  await expect(sql.begin(async tx => {
    await tx`
      insert into public.ordem_coleta (solicitacao_obito_id, status, quantidade_corpos)
      values (-27001, 'PENDENTE_ALOCACAO', 1)
    `;
  })).rejects.toMatchObject({ code: '23505' });
});

test('triagem final de usuário inexistente não pode ser registrada', async () => {
  await expect(sql.begin(async tx => {
    await tx`
      update public.solicitacao_obito
      set status_triagem = 'CONFIRMADA_SVO',
          triado_por_id = -27999, triado_em = '2026-11-03 12:00:00'
      where id = -27006
    `;
  })).rejects.toMatchObject({ code: '23503' });
});
