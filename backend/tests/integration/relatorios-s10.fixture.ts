import { verifiedSql } from '../../src/database/scripts/verify-test-db.js';

export const relatorioS10 = { veiculo: 7250001, motorista: 7250001, inicio: '2097-05-01', fim: '2097-05-03', quantidade: 60 };

/** Dados sintéticos exclusivos; o harness verifica container/checkout antes de qualquer escrita. */
export async function prepararRelatoriosS10() {
  const sql = await verifiedSql();
  try {
    // verifiedSql usa uma única conexão: a trava serializa somente esta fixture entre workers.
    // sql.end libera a trava também quando setup ou limpeza falham.
    await sql`SELECT pg_advisory_lock(225, 250)`;
    await sql.begin(async tx => {
      await tx`INSERT INTO public.motorista(id,nome,cnh,categoria_cnh,validade_cnh) VALUES (7250001,'Relatórios S10 — motorista sintético','S10-REL-7250001','D','2099-12-31')`;
      await tx`INSERT INTO public.veiculo(id,placa,marca,modelo,ano,tipo) VALUES (7250001,'REL5A10','Fixture','Relatório S10',2026,'PASSEIO')`;
      await tx`INSERT INTO public.solicitacao_viagem(id,codigo,origem,destino,data_hora_saida,status,veiculo_id,motorista_id)
        SELECT 7251000+n,'S10-REL-'||n,'=1+1','São José; "Destino"',timestamp '2097-05-02 08:00','CONCLUIDA',7250001,7250001 FROM generate_series(1,60) n`;
      await tx`INSERT INTO public.viagem(id,solicitacao_id,veiculo_id,motorista_id,status,km_inicial,km_final,data_inicio,data_fim)
        SELECT 7252000+n,7251000+n,7250001,7250001,CASE WHEN n=1 THEN 'AGENDADA'::public.status_viagem ELSE 'CONCLUIDA'::public.status_viagem END,CASE WHEN n=1 THEN NULL ELSE 100 END,
          CASE WHEN n=1 THEN NULL WHEN n=2 THEN 100 ELSE 110 END,timestamp '2097-05-02 08:00',timestamp '2097-05-02 09:00' FROM generate_series(1,60) n`;
      await tx`INSERT INTO public.abastecimento(id,veiculo_id,motorista_id,litragem,valor_total,quilometragem,data_abastecimento,posto)
        VALUES (7253001,7250001,7250001,10.25,60.99,110,'2097-05-02','Posto sintético — S10')`;
      await tx`INSERT INTO public.viagem_correcao(id,viagem_id,versao,km_inicial,km_final,justificativa,autor_id,criado_em)
        VALUES (7254001,7252002,1,100,100,'Correção sintética — relatório',-27001,'2097-05-02T12:00:00-03:00')`;
      await tx`INSERT INTO public.solicitacao_obito(id,codigo,atendente_id,local_falecimento,endereco_remocao,solicitante_nome,criado_em,status_triagem,triado_por_id,triado_em)
        VALUES (7255001,'S10-REL-SVO',-27005,'Fixture','Fixture','Fixture','2097-05-02 08:00','CONFIRMADA_SVO',-27005,'2097-05-02 09:00')`;
      await tx`INSERT INTO public.ordem_coleta(id,solicitacao_obito_id,veiculo_id,motorista_id,status,km_inicial,km_final,data_inicio,data_fim)
        VALUES (7256001,7255001,7250001,7250001,'CONCLUIDA',100,110,'2097-05-02 10:00','2097-05-02 11:00')`;
    });
  } catch (error) { await sql.end(); throw error; }
  return {
    sql,
    async limpar() {
      try {
        const admin = await verifiedSql(true);
        try {
          await admin.begin(async tx => {
            await tx`DELETE FROM public.ordem_coleta WHERE id=7256001`;
            await tx`DELETE FROM public.solicitacao_obito WHERE id=7255001`;
            await tx`DELETE FROM public.viagem_correcao WHERE id=7254001`;
            await tx`DELETE FROM public.abastecimento WHERE id=7253001`;
            await tx`DELETE FROM public.viagem WHERE id BETWEEN 7252001 AND 7252060`;
            await tx`DELETE FROM public.solicitacao_viagem WHERE id BETWEEN 7251001 AND 7251060`;
            await tx`DELETE FROM public.veiculo WHERE id=7250001`;
            await tx`DELETE FROM public.motorista WHERE id=7250001`;
          });
        } finally { await admin.end(); }
      } finally { await sql.end(); }
    },
  };
}
