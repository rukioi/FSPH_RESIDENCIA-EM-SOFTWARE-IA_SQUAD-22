import type postgres from 'postgres';

export interface IntervaloReserva { inicio: string; fim: string }
export type ResultadoDisponibilidade = 'disponivel' | 'referencia_inexistente' | 'recurso_inelegivel' | 'conflito_alocacao';

/** Bloqueia motorista e veículo nessa ordem; chamador deve usar READ COMMITTED e manter locks até o commit. */
export async function verificarDisponibilidade(tx: postgres.TransactionSql, motoristaId: string, veiculoId: string,
  intervalo: IntervaloReserva | null, excluirSolicitacaoId: string | null = null): Promise<ResultadoDisponibilidade> {
  const motoristas = await tx`SELECT id, status FROM public.motorista WHERE id=${motoristaId} FOR UPDATE`;
  const veiculos = await tx`SELECT id, status FROM public.veiculo WHERE id=${veiculoId} FOR UPDATE`;
  if (motoristas.length !== 1 || veiculos.length !== 1) return 'referencia_inexistente';
  if (motoristas[0].status !== 'DISPONIVEL' || veiculos[0].status !== 'DISPONIVEL') return 'recurso_inelegivel';
  // Os locks dos recursos serializam ambos os fluxos. Não bloquear linhas de outros
  // pedidos/ordens aqui: isso inverteria a ordem de locks e permitiria deadlock.
  const ordens = await tx`SELECT id FROM public.ordem_coleta
    WHERE status IN ('EM_DESLOCAMENTO', 'EM_TRANSPORTE')
      AND (motorista_id=${motoristaId} OR veiculo_id=${veiculoId}) LIMIT 1`;
  if (ordens.length) return 'conflito_alocacao';
  const reservas = await tx`SELECT id FROM public.solicitacao_viagem
    WHERE status IN ('AGENDADA', 'PRONTA_PARA_INICIAR', 'EM_ANDAMENTO')
      AND (${excluirSolicitacaoId}::bigint IS NULL OR id<>${excluirSolicitacaoId}::bigint)
      AND (motorista_id=${motoristaId} OR veiculo_id=${veiculoId})
      AND (${intervalo?.inicio ?? null}::timestamp IS NULL
        OR data_hora_retorno_previsto IS NULL
        OR data_hora_retorno_previsto <= data_hora_saida
        OR (data_hora_saida < ${intervalo?.fim ?? null}::timestamp
          AND data_hora_retorno_previsto > ${intervalo?.inicio ?? null}::timestamp)) LIMIT 1`;
  return reservas.length ? 'conflito_alocacao' : 'disponivel';
}

/** Bloqueia todos os motoristas (ordenados por BIGINT), depois veículos, mantendo a ordem dos demais fluxos. */
export async function bloquearRecursosDaTroca(tx: postgres.TransactionSql, motoristas: (string|null)[], veiculos: (string|null)[]): Promise<void> {
  const ordenar = (ids: (string|null)[]) => [...new Set(ids.filter((id): id is string => id !== null).map(id => BigInt(id).toString()))]
    .sort((a,b) => BigInt(a)<BigInt(b) ? -1 : BigInt(a)>BigInt(b) ? 1 : 0);
  for (const id of ordenar(motoristas)) await tx`SELECT id FROM public.motorista WHERE id=${id} FOR UPDATE`;
  for (const id of ordenar(veiculos)) await tx`SELECT id FROM public.veiculo WHERE id=${id} FOR UPDATE`;
}

export interface RecursoDisponivel {tipo:'motorista'|'veiculo';id:string;nome:string|null;placa:string|null;modelo:string|null}

/** Consulta informativa sem locks; usa os mesmos estados e intervalo da validação transacional. */
export async function consultarRecursosDisponiveis(tx: postgres.TransactionSql, intervalo: IntervaloReserva): Promise<RecursoDisponivel[]> {
  return tx<RecursoDisponivel[]>`WITH recursos AS (
    SELECT 'motorista'::text AS tipo,id,nome,NULL::text AS placa,NULL::text AS modelo,status::text AS status FROM public.motorista
    UNION ALL SELECT 'veiculo',id,NULL::text,placa,modelo,status::text FROM public.veiculo)
    SELECT r.tipo,r.id::text,r.nome,r.placa,r.modelo FROM recursos r WHERE r.status='DISPONIVEL'
      AND NOT EXISTS (SELECT 1 FROM public.ordem_coleta o
        WHERE o.status IN ('EM_DESLOCAMENTO','EM_TRANSPORTE')
          AND (CASE WHEN r.tipo='motorista' THEN o.motorista_id ELSE o.veiculo_id END)=r.id)
      AND NOT EXISTS (SELECT 1 FROM public.solicitacao_viagem s
        WHERE s.status IN ('AGENDADA','PRONTA_PARA_INICIAR','EM_ANDAMENTO')
          AND (CASE WHEN r.tipo='motorista' THEN s.motorista_id ELSE s.veiculo_id END)=r.id
          AND (s.data_hora_retorno_previsto IS NULL OR s.data_hora_retorno_previsto<=s.data_hora_saida
            OR (s.data_hora_saida<${intervalo.fim}::timestamp AND s.data_hora_retorno_previsto>${intervalo.inicio}::timestamp)))
    ORDER BY r.tipo,r.id`;
}
