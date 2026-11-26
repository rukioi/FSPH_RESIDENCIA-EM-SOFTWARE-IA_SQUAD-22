import type postgres from 'postgres';

/**
 * SCRUM-240: impedimentos CONHECIDOS do motorista. Decisão do responsável (25/11):
 * só fatos registrados bloqueiam; ausência de escala ou de matriz CNH × classe é
 * indeterminada e não bloqueia nem aprova. Matriz não é avaliada: veículo não tem
 * classe veicular homologada.
 */
export type ImpedimentoMotorista = 'INATIVO' | 'AUSENCIA' | 'FORA_DE_ESCALA';

/** Período civil de Maceió `[inicio, fim)`, no formato dos intervalos de reserva. */
export interface PeriodoCivil { inicio: string; fim: string }

type Fragmento = postgres.PendingQuery<postgres.Row[]>;

/** Instantes do período; sem período (despacho imediato) usa o instante da transação. */
export function faixaInstantes(tx: postgres.TransactionSql, periodo: PeriodoCivil | null): Fragmento {
  return periodo
    ? tx`tstzrange((${periodo.inicio}::text::timestamp AT TIME ZONE 'America/Maceio'),
        (${periodo.fim}::text::timestamp AT TIME ZONE 'America/Maceio'), '[)')`
    : tx`tstzrange(transaction_timestamp(), transaction_timestamp(), '[]')`;
}

/** Condição SQL única usada por escrita e consultas; `motorista` referencia o id avaliado. */
export function condicaoImpedimento(tx: postgres.TransactionSql, motorista: Fragmento, faixa: Fragmento): Fragmento {
  return tx`(
    coalesce((SELECT t.acao = 'INATIVACAO' FROM public.motorista_transicao_profissional t
      WHERE t.motorista_id = ${motorista} ORDER BY t.versao DESC LIMIT 1), false)
    OR EXISTS (SELECT 1 FROM public.indisponibilidade_motorista i WHERE i.motorista_id = ${motorista}
      AND i.estado = 'VIGENTE' AND tstzrange(i.inicio, i.fim, '[)') && ${faixa})
    OR EXISTS (SELECT 1 FROM public.escala_motorista e WHERE e.motorista_id = ${motorista}
      AND e.estado = 'VIGENTE' AND e.situacao = 'FORA_DE_ESCALA' AND tstzrange(e.inicio, e.fim, '[)') && ${faixa}))`;
}

/**
 * Primeiro impedimento conhecido, em ordem fixa. O chamador já deve ter o lock FOR UPDATE
 * do motorista: registros de escala/ausência/transição tomam o mesmo lock antes de gravar.
 */
export async function impedimentoMotorista(tx: postgres.TransactionSql, motoristaId: string,
  periodo: PeriodoCivil | null): Promise<ImpedimentoMotorista | null> {
  const faixa = faixaInstantes(tx, periodo);
  const [linha] = await tx<{ inativo: boolean; ausencia: boolean; fora: boolean }[]>`SELECT
    coalesce((SELECT t.acao = 'INATIVACAO' FROM public.motorista_transicao_profissional t
      WHERE t.motorista_id = ${motoristaId} ORDER BY t.versao DESC LIMIT 1), false) AS inativo,
    EXISTS (SELECT 1 FROM public.indisponibilidade_motorista i WHERE i.motorista_id = ${motoristaId}
      AND i.estado = 'VIGENTE' AND tstzrange(i.inicio, i.fim, '[)') && ${faixa}) AS ausencia,
    EXISTS (SELECT 1 FROM public.escala_motorista e WHERE e.motorista_id = ${motoristaId}
      AND e.estado = 'VIGENTE' AND e.situacao = 'FORA_DE_ESCALA' AND tstzrange(e.inicio, e.fim, '[)') && ${faixa}) AS fora`;
  if (linha.inativo) return 'INATIVO';
  if (linha.ausencia) return 'AUSENCIA';
  if (linha.fora) return 'FORA_DE_ESCALA';
  return null;
}
