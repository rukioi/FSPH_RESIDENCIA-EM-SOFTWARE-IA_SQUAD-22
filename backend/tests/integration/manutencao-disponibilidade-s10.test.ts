import { afterAll, beforeAll, expect, test } from 'vitest';
import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';
import { existeManutencaoBloqueante, guardarDisponibilidadeManutencao } from '../../src/modules/alocacao/manutencao-disponibilidade.js';

let db: Awaited<ReturnType<typeof verifiedSql>>;
beforeAll(async () => { db = await verifiedSql(true); });
afterAll(async () => { await db?.end(); });

const rollback = new Error('Reverter fixture da SCRUM-233');
const veiculo = '-23301001';

test('janelas civis, adjacência com microssegundos, vencimento e bloqueios independentes', async () => {
  await expect(db.begin(async tx => {
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status)
      VALUES (${veiculo},'TST2330','CHEVROLET','S10 Teste',2026,'PASSEIO','DISPONIVEL')`;
    const manutencao = async (id: number, dia: string) => {
      await tx`INSERT INTO public.manutencao_veiculo
        (id,veiculo_id,tipo,descricao,entrada_em,conclusao_prevista_em,quilometragem,status,criado_por_id,atualizado_por_id)
        VALUES (${id},${veiculo},'CORRETIVA','Fixture SCRUM-233',${dia}::date::timestamp AT TIME ZONE 'America/Maceio',
          ${dia}::date::timestamp AT TIME ZONE 'America/Maceio',0,'AGENDADA',-27001,-27001)`;
    };
    const reserva = async (inicio: string, fim: string) => {
      const [r] = await tx`SELECT ${existeManutencaoBloqueante(tx, veiculo, {tipo:'RESERVA', janela:{inicio,fim}})} AS bloqueado`;
      return r.bloqueado;
    };
    const despacho = async () => {
      const [r] = await tx`SELECT ${existeManutencaoBloqueante(tx, veiculo, {tipo:'DESPACHO_SVO'})} AS bloqueado`;
      return r.bloqueado;
    };

    await manutencao(-23301001, '2099-01-01');
    await manutencao(-23301002, '2099-01-01');
    expect(await despacho()).toBe(false);
    expect(await reserva('2098-12-31 23:00', '2099-01-01 00:00')).toBe(false);
    expect(await reserva('2098-12-31 23:00', '2099-01-01 00:00:00.000001')).toBe(true);
    expect(await reserva('2098-12-31 23:00', '2099-01-02 01:00')).toBe(true);
    expect(await reserva('2099-01-01 23:59:59.999999', '2099-01-02 00:00')).toBe(true);
    expect(await reserva('2099-01-02 00:00', '2099-01-02 01:00')).toBe(false);
    await tx`UPDATE public.manutencao_veiculo SET status='EM_ANDAMENTO', iniciada_em=statement_timestamp()
      WHERE veiculo_id=${veiculo}`;
    expect(await despacho()).toBe(true);
    await tx`UPDATE public.manutencao_veiculo SET status='CONCLUIDA', concluida_em=statement_timestamp()
      WHERE id=-23301001`;
    expect(await despacho()).toBe(true);
    await tx`UPDATE public.manutencao_veiculo SET status='CONCLUIDA', concluida_em=statement_timestamp()
      WHERE id=-23301002`;
    expect(await despacho()).toBe(false);
    await manutencao(-23301003, '2020-01-01');
    expect(await reserva('2099-01-02 00:00', '2099-01-02 01:00')).toBe(true);
    await tx`UPDATE public.manutencao_veiculo SET status='CANCELADA', cancelada_em=statement_timestamp()
      WHERE id=-23301003`;
    expect(await reserva('2099-01-02 00:00', '2099-01-02 01:00')).toBe(false);
    throw rollback;
  })).rejects.toBe(rollback);
});

test('guarda preserva reserva conhecida e admite adjacência', async () => {
  await expect(db.begin(async tx => {
    await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo,status)
      VALUES (${veiculo},'TST2330','CHEVROLET','S10 Teste',2026,'PASSEIO','DISPONIVEL')`;
    await tx`INSERT INTO public.solicitacao_viagem(id,codigo,solicitante_id,origem,destino,finalidade,
      data_hora_saida,data_hora_retorno_previsto,status,veiculo_id)
      VALUES (-23301001,'S233-RES',-27003,'A','B','Fixture','2099-01-01 23:00','2099-01-02 00:00','AGENDADA',${veiculo})`;
    await tx`SELECT id FROM public.veiculo WHERE id=${veiculo} FOR UPDATE`;
    const guardar = (inicio:string, fim:string) => guardarDisponibilidadeManutencao(tx,
      { veiculo:{id:veiculo}, janela:{inicio,fim}, status:'AGENDADA' });
    await expect(guardar('2099-01-01T00:00-03:00', '2099-01-02T00:00-03:00'))
      .rejects.toMatchObject({status:409, code:'CONFLITO_ALOCACAO'});
    await expect(guardar('2099-01-02T00:00-03:00', '2099-01-03T00:00-03:00')).resolves.toBeUndefined();
    const [reserva] = await tx`SELECT status,veiculo_id::text FROM public.solicitacao_viagem WHERE id=-23301001`;
    expect(reserva).toMatchObject({status:'AGENDADA',veiculo_id:veiculo});
    throw rollback;
  })).rejects.toBe(rollback);
});
