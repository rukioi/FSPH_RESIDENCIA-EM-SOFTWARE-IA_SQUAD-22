import type { z } from 'zod';
import { sql } from '../../database/connection.js';
import { ErroHttp } from '../../shared/http/errors.js';
import { filtroIndicadoresAbastecimentos, indicadoresAbastecimentos } from './abastecimentos.schemas.js';

type Filtro = z.infer<typeof filtroIndicadoresAbastecimentos>;
type Janela = { inicio: string; fim: string };

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

    return indicadoresAbastecimentos.parse({ data: {
      estado: totais.quantidade === 0 ? 'SEM_ABASTECIMENTOS' : 'DISPONIVEL',
      quantidade: totais.quantidade, totalLitros: totais.totalLitros, totalCusto: totais.totalCusto,
      custoPorLitro: totais.custoPorLitro, periodoObservado: { inicio: totais.inicio, fim: totais.fim },
      kmObservadosPorVeiculo: leituras,
      consumoPorDistancia: { valor: null, estado: 'INDISPONIVEL', motivo: 'REGRA_DE_NEGOCIO_PENDENTE' },
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
