import type { z } from 'zod';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { filtroIndicadoresAbastecimentos, indicadoresAbastecimentos } from './abastecimentos.schemas.js';

type Filtro = z.infer<typeof filtroIndicadoresAbastecimentos>;
type Janela = { inicio: string; fim: string };

type ResultadoConsumo = { veiculoId: string | null; valor: string | null; trechosValidos: number };

function medirConsumo(resultado?: ResultadoConsumo) {
  return resultado?.valor != null
    ? { estado: 'DISPONIVEL' as const, valor: resultado.valor, motivo: null, trechosValidos: resultado.trechosValidos }
    : { estado: 'DADOS_INSUFICIENTES' as const, valor: null, motivo: 'SEM_TRECHO_VALIDO' as const, trechosValidos: 0 as const };
}

const periodoInvalido = () => new ErroHttp(400, 'DADOS_INVALIDOS', 'Informe veículo e datas válidas para os indicadores.');

async function agregarIndicadores(filtro: Filtro, janela?: Janela) {
  return sql.begin('isolation level repeatable read read only', async tx => {
    if (filtro.veiculoId) {
      const [veiculo] = await tx`SELECT id FROM public.veiculo WHERE id = ${filtro.veiculoId}`;
      if (!veiculo) throw new ErroHttp(404, 'NAO_ENCONTRADO', 'Veículo não encontrado.');
    }

    const inicio = janela
      ? tx`(${janela.inicio}::text::timestamptz AT TIME ZONE 'America/Maceio')::date`
      : tx`${filtro.inicio ?? null}::text::date`;
    const fim = janela
      ? tx`((${janela.fim}::text::timestamptz AT TIME ZONE 'America/Maceio') - interval '1 microsecond')::date`
      : tx`${filtro.fim ?? null}::text::date`;
    const onde = tx`WHERE (${filtro.veiculoId ?? null}::text::bigint IS NULL OR a.veiculo_id = ${filtro.veiculoId ?? null}::text::bigint)
      AND (${inicio} IS NULL OR a.data_abastecimento >= ${inicio})
      AND (${fim} IS NULL OR a.data_abastecimento <= ${fim})`;

    const [totais] = await tx`
      SELECT count(*)::int AS quantidade,
        coalesce(sum(a.litragem), 0.00)::text AS "totalLitros",
        coalesce(sum(a.valor_total), 0.00)::text AS "totalCusto",
        round(sum(a.valor_total) / nullif(sum(a.litragem), 0), 4)::text AS "custoPorLitro",
        to_char(min(a.data_abastecimento), 'YYYY-MM-DD') AS inicio,
        to_char(max(a.data_abastecimento), 'YYYY-MM-DD') AS fim
      FROM public.abastecimento a ${onde}`;
    const leituras = await tx`
      SELECT a.veiculo_id::text AS "veiculoId", count(a.quilometragem)::int AS "leiturasComKm",
        (count(*) - count(a.quilometragem))::int AS "leiturasSemKm",
        min(a.quilometragem) AS "menorKm", max(a.quilometragem) AS "maiorKm"
      FROM public.abastecimento a ${onde}
      GROUP BY a.veiculo_id ORDER BY a.veiculo_id`;

    // Cada linha pertence ao trecho que começa no último tanque completo anterior.
    // O tanque de abertura vira a âncora e seus litros só entram no trecho anterior.
    const consumos = await tx<ResultadoConsumo[]>`
      WITH ordenados AS (
        SELECT a.veiculo_id, a.quilometragem, a.litragem, a.tanque_completo,
          lag(a.quilometragem) OVER ordem AS km_anterior,
          count(*) FILTER (WHERE a.tanque_completo) OVER (
            ordem ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
          ) AS trecho
        FROM public.abastecimento a ${onde}
        WINDOW ordem AS (PARTITION BY a.veiculo_id ORDER BY a.data_abastecimento, a.criado_em NULLS LAST, a.id)
      ), aberturas AS (
        SELECT veiculo_id, trecho + 1 AS trecho, quilometragem AS km_inicial
        FROM ordenados WHERE tanque_completo
      ), trechos_validos AS (
        SELECT o.veiculo_id, sum(o.litragem) AS litros,
          max(o.quilometragem) FILTER (WHERE o.tanque_completo) - b.km_inicial AS distancia
        FROM ordenados o
        JOIN aberturas b ON b.veiculo_id = o.veiculo_id AND b.trecho = o.trecho
        GROUP BY o.veiculo_id, o.trecho, b.km_inicial
        HAVING count(*) FILTER (WHERE o.tanque_completo) = 1
          AND b.km_inicial >= 0
          AND max(o.quilometragem) FILTER (WHERE o.tanque_completo) > b.km_inicial
          AND bool_and(coalesce(o.quilometragem >= o.km_anterior AND o.litragem > 0, false))
      )
      SELECT veiculo_id::text AS "veiculoId", count(*)::int AS "trechosValidos",
        round(sum(distancia)::numeric / nullif(sum(litros), 0), 4)::text AS valor
      FROM trechos_validos GROUP BY GROUPING SETS ((veiculo_id), ())`;
    const porId = new Map(consumos.map(resultado => [resultado.veiculoId, resultado]));
    const porVeiculo = leituras.map(({ veiculoId }) => ({
      veiculoId, ...medirConsumo(porId.get(veiculoId)),
    }));

    return indicadoresAbastecimentos.parse({ data: {
      estado: totais.quantidade === 0 ? 'SEM_ABASTECIMENTOS' : 'DISPONIVEL',
      quantidade: totais.quantidade, totalLitros: totais.totalLitros, totalCusto: totais.totalCusto,
      custoPorLitro: totais.custoPorLitro, periodoObservado: { inicio: totais.inicio, fim: totais.fim },
      kmObservadosPorVeiculo: leituras,
      consumoPorDistancia: { ...medirConsumo(porId.get(null)), unidade: 'km/L', porVeiculo },
    } });
  });
}

/** Consulta os acumulados persistidos para um veículo e/ou intervalo civil inclusivo. */
export async function obterIndicadoresAbastecimentos(params: URLSearchParams) {
  for (const chave of params.keys()) {
    if (params.getAll(chave).length !== 1) throw periodoInvalido();
  }
  const filtro = filtroIndicadoresAbastecimentos.safeParse(Object.fromEntries(params));
  if (!filtro.success) throw periodoInvalido();
  return agregarIndicadores(filtro.data);
}

/** Converte o período validado do painel nos dias civis abrangidos. */
export async function obterIndicadoresAbastecimentosDoDashboard(janela: Janela) {
  return agregarIndicadores({}, janela);
}
