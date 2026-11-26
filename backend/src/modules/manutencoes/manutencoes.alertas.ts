import { performance } from 'node:perf_hooks';
import type { TransactionSql } from 'postgres';
import { sql } from '../../database/connection.js';
import { registrarFalha } from '../../shared/logging/logger.js';
import { inserirNotificacao } from '../notificacoes/notificacoes.repository.js';
import {
  alertasManutencao, elegibilidadeManutencao, hojeManutencao, type AlertaManutencao,
} from './manutencoes.alertas-criterios.js';
import type { DadosManutencao } from './manutencoes.repository.js';

type Elegibilidade = Record<AlertaManutencao, boolean>;
type EstadoAlerta = Pick<DadosManutencao, 'status' | 'tipo' | 'entrada' | 'conclusaoPrevista'>;
const tamanhoLote = 25;
const maximoPorExecucao = 100;
const orcamentoMs = 35_000;

function chaveAlerta(id: string, alerta: AlertaManutencao, revisao: string) {
  return `manutencao:${id}:${alerta}:${revisao}`;
}

/** Compara estados no mesmo dia civil após os locks da mutação. */
export async function atualizarRevisoesManutencao(tx: TransactionSql, id: string, anterior: EstadoAlerta,
  posterior: EstadoAlerta, operacao: string) {
  let incrementar: readonly AlertaManutencao[] = alertasManutencao;
  if (operacao !== 'REABRIR' && operacao !== 'REATIVAR') {
    if ((operacao !== 'EDITAR' && operacao !== 'INICIAR') ||
        (anterior.status === posterior.status && anterior.tipo === posterior.tipo &&
          anterior.entrada === posterior.entrada && anterior.conclusaoPrevista === posterior.conclusaoPrevista)) return;
    const criterios = elegibilidadeManutencao(tx, hojeManutencao(tx));
    const estado = (ordem: number, d: EstadoAlerta) => tx`(${ordem}::integer, ${d.status}::text, ${d.tipo}::text,
      ${d.entrada}::date::timestamp AT TIME ZONE 'America/Maceio',
      ${d.conclusaoPrevista}::date::timestamp AT TIME ZONE 'America/Maceio')`;
    const [antes,depois] = await tx<Elegibilidade[]>`
      SELECT ${criterios.ATRASO} AS "ATRASO", ${criterios.PREVENTIVA_PROXIMA} AS "PREVENTIVA_PROXIMA"
      FROM (VALUES ${estado(0, anterior)}, ${estado(1, posterior)}) m(ordem, status, tipo, entrada_em, conclusao_prevista_em)
      ORDER BY m.ordem`;
    incrementar = alertasManutencao.filter(alerta => antes[alerta] && !depois[alerta]);
  }
  for (const alerta of incrementar) await tx`INSERT INTO public.manutencao_alerta_revisao (manutencao_id, alerta, revisao)
    VALUES (${id}, ${alerta}, 2) ON CONFLICT (manutencao_id, alerta)
    DO UPDATE SET revisao = manutencao_alerta_revisao.revisao + 1`;
}

async function candidatas(apos: string | null, limite: number) {
  return sql.begin('read only', async tx => {
    await tx`SET LOCAL statement_timeout = '4s'`;
    const criterios = elegibilidadeManutencao(tx, hojeManutencao(tx));
    return tx<{id:string}[]>`
    SELECT m.id::text FROM public.manutencao_veiculo m
    WHERE (${apos}::bigint IS NULL OR m.id > ${apos}::bigint)
      AND m.status IN ('AGENDADA','EM_ANDAMENTO') AND EXISTS (
      SELECT 1
      FROM (VALUES ('ATRASO', ${criterios.ATRASO}), ('PREVENTIVA_PROXIMA', ${criterios.PREVENTIVA_PROXIMA})) a(alerta, elegivel)
      LEFT JOIN public.manutencao_alerta_revisao r ON r.manutencao_id = m.id AND r.alerta = a.alerta
      WHERE a.elegivel AND EXISTS (
        SELECT 1 FROM public.usuario u
        WHERE u.ativo AND u.perfil IN ('ADM','GESTOR_FROTA') AND NOT EXISTS (
          SELECT 1 FROM public.notificacao n WHERE n.usuario_id = u.id
            AND n.chave = 'manutencao:' || m.id || ':' || a.alerta || ':' || COALESCE(r.revisao,1)
        )
      )
    )
    ORDER BY m.id LIMIT ${limite}`;
  });
}

async function emitirDaOcorrencia(id: string) {
  return sql.begin('isolation level read committed', async tx => {
    await tx`SET LOCAL lock_timeout = '2s'`;
    await tx`SET LOCAL statement_timeout = '4s'`;
    const [travada] = await tx`SELECT id FROM public.manutencao_veiculo WHERE id=${id} FOR UPDATE SKIP LOCKED`;
    if (!travada) return null;
    const criterios = elegibilidadeManutencao(tx, hojeManutencao(tx));
    const [atual] = await tx<(Elegibilidade & {placa:string})[]>`
      SELECT v.placa, ${criterios.ATRASO} AS "ATRASO", ${criterios.PREVENTIVA_PROXIMA} AS "PREVENTIVA_PROXIMA"
      FROM public.manutencao_veiculo m JOIN public.veiculo v ON v.id=m.veiculo_id WHERE m.id=${id}`;
    let emitidos = 0;
    for (const alerta of alertasManutencao) {
      if (!atual[alerta]) continue;
      await tx`INSERT INTO public.manutencao_alerta_revisao (manutencao_id, alerta)
        VALUES (${id},${alerta}) ON CONFLICT (manutencao_id, alerta) DO NOTHING`;
      const [r] = await tx<{revisao:string}[]>`SELECT revisao::text FROM public.manutencao_alerta_revisao
        WHERE manutencao_id=${id} AND alerta=${alerta}`;
      const chave = chaveAlerta(id, alerta, r.revisao);
      const destinatarios = await tx<{id:string}[]>`SELECT u.id::text FROM public.usuario u
        WHERE u.ativo AND u.perfil IN ('ADM','GESTOR_FROTA')
          AND NOT EXISTS (SELECT 1 FROM public.notificacao n WHERE n.usuario_id=u.id AND n.chave=${chave})
        ORDER BY u.id FOR SHARE OF u`;
      if (!destinatarios.length) continue;
      const atraso = alerta === 'ATRASO';
      await inserirNotificacao(tx, destinatarios.map(u => u.id), chave,
        atraso ? 'Manutenção atrasada' : 'Manutenção preventiva próxima',
        'Manutenção #' + id + ' · Veículo ' + atual.placa, atraso ? 'urgente' : 'atencao');
      emitidos += destinatarios.length;
    }
    return emitidos;
  });
}

/** Processa lotes limitados; itens pendentes ficam elegíveis para a próxima execução. */
export async function processarAlertasManutencao() {
  const prazo = performance.now() + orcamentoMs;
  const resultado = { emitidas: 0, falhas: 0, adiadas: 0, restantes: false };
  let cursor: string | null = null;
  for (let tentativas = 0; tentativas < maximoPorExecucao;) {
    const lote = await candidatas(cursor, Math.min(tamanhoLote, maximoPorExecucao - tentativas));
    if (!lote.length) return resultado;
    for (const { id } of lote) {
      if (performance.now() >= prazo) return { ...resultado, restantes: true };
      cursor = id;
      tentativas++;
      try {
        const emitidas = await emitirDaOcorrencia(id);
        if (emitidas === null) resultado.adiadas++;
        else resultado.emitidas += emitidas;
      } catch (erro) {
        resultado.falhas++;
        registrarFalha(erro);
      }
    }
    if (performance.now() >= prazo) return { ...resultado, restantes: true };
  }
  resultado.restantes = (await candidatas(cursor, 1)).length > 0;
  return resultado;
}
