import {afterAll,beforeAll,expect,test} from 'vitest';
import {verifiedSql} from '../../src/database/scripts/verify-test-db.js';

let sql:Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async()=>{sql=await verifiedSql();});
afterAll(async()=>{await sql?.end();});

test('campos aditivos preservam cadastro legado e dados novos durante retorno de aplicação',async()=>{
  const rollback=new Error('rollback_fixture_compatibilidade_s7');
  await expect(sql.begin(async tx=>{
    const [legacy]=await tx`INSERT INTO public.solicitacao_viagem
      (codigo,origem,destino,data_hora_saida,status)
      VALUES ('S7-COMPAT-LEGACY','Origem antiga','Destino antigo','2099-01-01 08:00','PENDENTE')
      RETURNING id::text,finalidade,data_hora_retorno_previsto`;
    expect(legacy.finalidade).toBeNull();expect(legacy.data_hora_retorno_previsto).toBeNull();
    await tx`UPDATE public.solicitacao_viagem SET finalidade='Preservar finalidade',
      data_hora_retorno_previsto='2099-01-01 09:00' WHERE id=${legacy.id}`;
    // Uma escrita com a projeção antiga não remove os dados adicionados.
    await tx`UPDATE public.solicitacao_viagem SET origem='Origem antiga alterada' WHERE id=${legacy.id}`;
    await expect(tx.savepoint(async sp=>{
      await sp`UPDATE public.solicitacao_viagem SET finalidade='Não persistir',
        data_hora_retorno_previsto='2098-01-01 09:00' WHERE id=${legacy.id}`;
    })).rejects.toMatchObject({code:'23514'});
    const [after]=await tx`SELECT finalidade,to_char(data_hora_retorno_previsto,'HH24:MI') AS retorno
      FROM public.solicitacao_viagem WHERE id=${legacy.id}`;
    expect(after).toEqual({finalidade:'Preservar finalidade',retorno:'09:00'});
    throw rollback;
  })).rejects.toBe(rollback);
  expect(await sql`SELECT id FROM public.solicitacao_viagem WHERE codigo='S7-COMPAT-LEGACY'`).toHaveLength(0);
});
