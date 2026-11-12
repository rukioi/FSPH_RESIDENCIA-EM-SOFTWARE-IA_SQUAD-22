import { sql } from '../../database/connection.js';
import type { ConsultaRelatorio } from './relatorios.schemas.js';

/** Consulta somente projeções operacionais; nunca retorna documentos ou dados pessoais do SVO. */
export async function consultarLinhasRelatorio(q: ConsultaRelatorio) {
  const inicio = q.inicio;
  const fim = q.fim;
  const dataInstitucional = ['viagens','motoristas'].includes(q.tipo)
    ? sql`COALESCE(v.data_inicio,s.data_hora_saida)` : sql`COALESCE(s.data_hora_saida,v.data_inicio)`;
  if (q.tipo === 'abastecimentos') return sql`
    SELECT a.id::text AS id, a.data_abastecimento::text AS data, v.placa, m.nome AS motorista,
      a.quilometragem AS odometro, a.litragem::text AS litros, a.valor_total::text AS valor,
      a.posto, CASE WHEN a.tanque_completo THEN 'Sim' ELSE 'Não' END AS "tanqueCompleto"
    FROM public.abastecimento a JOIN public.veiculo v ON v.id=a.veiculo_id JOIN public.motorista m ON m.id=a.motorista_id
    WHERE a.data_abastecimento>=${inicio}::date AND a.data_abastecimento<${fim}::date+1
      AND (${q.veiculoId ?? null}::bigint IS NULL OR a.veiculo_id=${q.veiculoId ?? null}::bigint)
      AND (${q.motoristaId ?? null}::bigint IS NULL OR a.motorista_id=${q.motoristaId ?? null}::bigint)
    ORDER BY a.data_abastecimento DESC,a.id DESC LIMIT 5001`;
  if (q.tipo === 'svo') return sql`
    SELECT o.id::text AS id, s.codigo, to_char(COALESCE(o.data_inicio,s.criado_em),'YYYY-MM-DD"T"HH24:MI:SS') AS data,
      v.placa, m.nome AS motorista, o.status::text AS status,
      o.km_inicial AS "kmInicial",o.km_final AS "kmFinal",
      CASE WHEN o.status='CONCLUIDA' AND o.km_inicial>=0 AND o.km_final>=o.km_inicial THEN o.km_final-o.km_inicial END AS "kmPercorridos",
      CASE WHEN o.validada_por_svo THEN 'Sim' ELSE 'Não' END AS validada
    FROM public.ordem_coleta o LEFT JOIN public.solicitacao_obito s ON s.id=o.solicitacao_obito_id
      LEFT JOIN public.veiculo v ON v.id=o.veiculo_id LEFT JOIN public.motorista m ON m.id=o.motorista_id
    WHERE COALESCE(o.data_inicio,s.criado_em)>=${inicio}::date AND COALESCE(o.data_inicio,s.criado_em)<${fim}::date+1
      AND (${q.veiculoId ?? null}::bigint IS NULL OR o.veiculo_id=${q.veiculoId ?? null}::bigint)
      AND (${q.motoristaId ?? null}::bigint IS NULL OR o.motorista_id=${q.motoristaId ?? null}::bigint)
      AND (${q.status ?? null}::text IS NULL OR o.status::text=${q.status ?? null})
    ORDER BY COALESCE(o.data_inicio,s.criado_em) DESC,o.id DESC LIMIT 5001`;
  if (q.tipo === 'ocorrencias') return sql`
    SELECT c.id::text AS id,s.codigo,to_char(c.criado_em AT TIME ZONE 'America/Maceio','YYYY-MM-DD"T"HH24:MI:SS') AS data,
      ve.placa,m.nome AS motorista,'Correção de quilometragem' AS tipo,c.justificativa,
      c.km_inicial_anterior AS "kmInicialAnterior",c.km_final_anterior AS "kmFinalAnterior",
      c.km_inicial AS "kmInicial",c.km_final AS "kmFinal",c.versao
    FROM public.viagem_correcao c JOIN public.viagem v ON v.id=c.viagem_id
      LEFT JOIN public.solicitacao_viagem s ON s.id=v.solicitacao_id
      LEFT JOIN public.veiculo ve ON ve.id=v.veiculo_id LEFT JOIN public.motorista m ON m.id=v.motorista_id
    WHERE c.criado_em>=(${inicio}::date::timestamp AT TIME ZONE 'America/Maceio')
      AND c.criado_em<(( ${fim}::date+1)::timestamp AT TIME ZONE 'America/Maceio')
      AND (${q.veiculoId ?? null}::bigint IS NULL OR v.veiculo_id=${q.veiculoId ?? null}::bigint)
      AND (${q.motoristaId ?? null}::bigint IS NULL OR v.motorista_id=${q.motoristaId ?? null}::bigint)
    ORDER BY c.criado_em DESC,c.id DESC LIMIT 5001`;
  // FULL JOIN conserva viagens legadas sem solicitação; pedidos sem execução permanecem demandas.
  return sql`
    SELECT COALESCE(s.id::text,'V-'||v.id::text) AS id,s.codigo,
      to_char(${dataInstitucional},'YYYY-MM-DD"T"HH24:MI:SS') AS data,
      s.origem,s.destino,ve.placa,m.nome AS motorista,
      CASE WHEN ${q.tipo}='solicitacoes' THEN s.status::text ELSE COALESCE(v.status::text,s.status::text) END AS status,
      v.km_inicial AS "kmInicial",v.km_final AS "kmFinal",
      CASE WHEN v.status='CONCLUIDA' AND v.km_inicial>=0 AND v.km_final>=v.km_inicial THEN v.km_final-v.km_inicial END AS "kmPercorridos",
      CASE WHEN v.id IS NULL THEN 'Sem execução' WHEN v.validada_por_gestor THEN 'Sim' ELSE 'Não' END AS validada
    FROM public.solicitacao_viagem s FULL JOIN public.viagem v ON v.solicitacao_id=s.id
      LEFT JOIN public.veiculo ve ON ve.id=COALESCE(v.veiculo_id,s.veiculo_id)
      LEFT JOIN public.motorista m ON m.id=COALESCE(v.motorista_id,s.motorista_id)
    WHERE ${dataInstitucional}>=${inicio}::date AND ${dataInstitucional}<${fim}::date+1
      AND (${q.tipo} NOT IN ('viagens','motoristas') OR v.id IS NOT NULL)
      AND (${q.tipo}<>'solicitacoes' OR s.id IS NOT NULL)
      AND (${q.tipo}<>'veiculos' OR COALESCE(v.veiculo_id,s.veiculo_id) IS NOT NULL)
      AND (${q.veiculoId ?? null}::bigint IS NULL OR COALESCE(v.veiculo_id,s.veiculo_id)=${q.veiculoId ?? null}::bigint)
      AND (${q.motoristaId ?? null}::bigint IS NULL OR COALESCE(v.motorista_id,s.motorista_id)=${q.motoristaId ?? null}::bigint)
      AND (${q.status ?? null}::text IS NULL OR (CASE WHEN ${q.tipo}='solicitacoes' THEN s.status::text ELSE COALESCE(v.status::text,s.status::text) END)=${q.status ?? null})
    ORDER BY ${dataInstitucional} DESC,COALESCE(s.id,v.id) DESC,v.id DESC NULLS LAST LIMIT 5001`;
}

/** Catálogo mínimo para filtros, obtido em um único snapshot consistente. */
export async function consultarRecursosRelatorios() {
  return sql.begin('isolation level repeatable read read only', async tx => ({
    veiculos: await tx`SELECT id::text,placa,modelo FROM public.veiculo ORDER BY placa,id`,
    motoristas: await tx`SELECT id::text,nome FROM public.motorista ORDER BY nome,id`,
  }));
}
