import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { dataResponsavelPeloAtraso, elegibilidadeManutencao, hojeManutencao } from './manutencoes.alertas-criterios.js';
import { indicadoresManutencao, type FiltrosIndicadores } from './manutencoes.schemas.js';

/** Lê estoque, período e alertas no snapshot de uma única instrução. */
export async function consultarIndicadoresManutencao(filtros: FiltrosIndicadores) {
  const { veiculoId = null, tipo = null, inicio = null, fim = null } = filtros;
  const referenciaAtraso = dataResponsavelPeloAtraso(sql);
  const criterios = elegibilidadeManutencao(sql, hojeManutencao(sql));
  const [resultado] = await sql`
    WITH referencia AS (
      SELECT statement_timestamp() AS instante,
        (statement_timestamp() AT TIME ZONE 'America/Maceio')::date AS hoje,
        (${inicio}::date::timestamp AT TIME ZONE 'America/Maceio') AS inicio,
        ((${fim}::date + 1)::timestamp AT TIME ZONE 'America/Maceio') AS fim
    ), ocorrencias AS (
      SELECT m.id, m.veiculo_id, v.placa, m.tipo, m.status, m.custo, m.entrada_em, m.concluida_em,
        (m.entrada_em AT TIME ZONE 'America/Maceio')::date AS entrada,
        (m.conclusao_prevista_em AT TIME ZONE 'America/Maceio')::date AS previsao,
        ${referenciaAtraso} AS dia_atraso, ${criterios.ATRASO} AS atrasada,
        ${criterios.PREVENTIVA_PROXIMA} AS preventiva_proxima
      FROM public.manutencao_veiculo m JOIN public.veiculo v ON v.id = m.veiculo_id
      WHERE (${veiculoId}::bigint IS NULL OR m.veiculo_id = ${veiculoId}::bigint)
        AND (${tipo}::public.tipo_manutencao_veiculo IS NULL OR m.tipo = ${tipo}::public.tipo_manutencao_veiculo)
    ), veiculos_em_manutencao AS (
      SELECT veiculo_id AS id FROM ocorrencias WHERE status = 'EM_ANDAMENTO'
      UNION
      SELECT id FROM public.veiculo WHERE status = 'EM_MANUTENCAO'
        AND ${tipo}::text IS NULL AND (${veiculoId}::bigint IS NULL OR id = ${veiculoId}::bigint)
    ), totais AS (
      SELECT count(*) FILTER (WHERE status = 'AGENDADA') AS agendadas,
        count(*) FILTER (WHERE status = 'EM_ANDAMENTO') AS em_andamento,
        count(*) FILTER (WHERE status = 'CONCLUIDA'
          AND (r.inicio IS NULL OR concluida_em >= r.inicio)
          AND (r.fim IS NULL OR concluida_em < r.fim)) AS concluidas
      FROM ocorrencias CROSS JOIN referencia r
    ), custo AS (
      SELECT sum(custo)::text AS total, count(custo) AS informados, count(*) - count(custo) AS desconhecidos
      FROM ocorrencias CROSS JOIN referencia r
      WHERE status <> 'CANCELADA' AND (r.inicio IS NULL OR entrada_em >= r.inicio)
        AND (r.fim IS NULL OR entrada_em < r.fim)
    ), alertas AS (
      SELECT o.*, 'preventiva' AS grupo, entrada AS ordem
      FROM ocorrencias o
      WHERE preventiva_proxima
      UNION ALL
      SELECT o.*, 'atraso' AS grupo, dia_atraso AS ordem
      FROM ocorrencias o WHERE atrasada
    ), alertas_numerados AS (
      SELECT a.*, row_number() OVER (PARTITION BY grupo ORDER BY ordem, id) AS posicao
      FROM alertas a
    ), grupos AS (
      SELECT grupo, count(*) AS total,
        jsonb_agg(jsonb_build_object('id',id::text,'veiculo',jsonb_build_object('id',veiculo_id::text,'placa',placa),
          'tipo',tipo,'status',status,'entrada',to_char(entrada,'YYYY-MM-DD'),
          'conclusaoPrevista',to_char(previsao,'YYYY-MM-DD')) ORDER BY posicao)
          FILTER (WHERE posicao <= 20) AS itens
      FROM alertas_numerados GROUP BY grupo
    )
    SELECT (${veiculoId}::bigint IS NULL OR EXISTS (SELECT 1 FROM public.veiculo WHERE id = ${veiculoId}::bigint)) AS existe,
      jsonb_build_object('data',jsonb_build_object(
        'referencia',jsonb_build_object('instante',to_char(r.instante AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
          'dataCivil',to_char(r.hoje,'YYYY-MM-DD'),'fuso','America/Maceio'),
        'filtros',jsonb_build_object('veiculoId',${veiculoId}::bigint::text,'tipo',${tipo}::text),
        'estoqueAtual',jsonb_build_object('veiculosEmManutencao',(SELECT count(*) FROM veiculos_em_manutencao),
          'agendadas',t.agendadas,'emAndamento',t.em_andamento,'atrasadas',coalesce(a.total,0)),
        'periodo',jsonb_build_object('inicio',${inicio}::text,'fim',${fim}::text,
          'fimExclusivo',CASE WHEN ${fim}::date = '9999-12-31'::date THEN '+0' ELSE '' END || to_char(r.fim AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'criterioConcluidas','CONCLUSAO_EFETIVA','criterioCusto','ENTRADA_PLANEJADA','concluidas',t.concluidas,
          'custo',jsonb_build_object('totalConhecido',c.total,'comCustoInformado',c.informados,'comCustoDesconhecido',c.desconhecidos)),
        'alertas',jsonb_build_object(
          'preventivasProximos7Dias',jsonb_build_object('inicio',to_char(r.hoje,'YYYY-MM-DD'),
            'fimExclusivo',to_char(r.hoje+7,'YYYY-MM-DD'),'total',coalesce(p.total,0),'limite',20,'itens',coalesce(p.itens,'[]')),
          'atrasos',jsonb_build_object('total',coalesce(a.total,0),'limite',20,'itens',coalesce(a.itens,'[]')))
      )) AS resposta
    FROM referencia r CROSS JOIN totais t CROSS JOIN custo c
    LEFT JOIN grupos a ON a.grupo = 'atraso' LEFT JOIN grupos p ON p.grupo = 'preventiva'`;
  if (!resultado.existe) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Veículo não encontrado.');
  return indicadoresManutencao.parse(resultado.resposta);
}
