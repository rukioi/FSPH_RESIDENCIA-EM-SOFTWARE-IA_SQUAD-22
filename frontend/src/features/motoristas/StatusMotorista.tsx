import { useCallback } from 'react';
import { buscarImpedimentosMotorista, buscarTransicoesMotorista } from '../../shared/services/motoristas.service';
import { useConsultaMotorista } from './useConsultaMotorista';

type Periodo = { inicio: string; fim: string | null; estado?: string; tipo?: string };

/** Ausência vigente que cobre o instante informado (registros cancelados não contam). */
export function ausenciaVigente(itens: readonly Periodo[], agora = Date.now()): Periodo | undefined {
  return itens.find(p => p.estado !== 'CANCELADA'
    && new Date(p.inicio).getTime() <= agora
    && (p.fim === null || new Date(p.fim).getTime() > agora));
}

/**
 * Status exibido: inativação profissional > ausência vigente agora > status do cadastro.
 * O cadastro do motorista não é alterado pela API de disponibilidade, por isso a tela combina as fontes.
 */
export function StatusMotorista({ motoristaId, status, legivel, classe }: {
  motoristaId: string; status?: string | null;
  legivel: (s?: string | null) => string; classe: (s?: string | null) => string;
}) {
  const carregar = useCallback(async (signal: AbortSignal) => {
    const agora = new Date();
    const depois = new Date(agora.getTime() + 60_000);
    const [transicoes, ausencias] = await Promise.all([
      buscarTransicoesMotorista(motoristaId, { page: 1, limit: 1 }, signal),
      buscarImpedimentosMotorista(motoristaId, { page: 1, limit: 20, inicio: agora.toISOString(), fim: depois.toISOString() }, signal),
    ]);
    if (transicoes.situacao.inativo) return 'INATIVO';
    const vigente = ausenciaVigente(ausencias.data as unknown as Periodo[], agora.getTime());
    return vigente?.tipo ?? null;
  }, [motoristaId]);
  const consulta = useConsultaMotorista(carregar);
  if (consulta.carregando && consulta.data === null) return <span className="motorista-status" role="status">Consultando…</span>;
  if (consulta.erro) return <span className="motorista-status" role="alert">Status indisponível{' '}
    <button type="button" className="btn" onClick={evento => { evento.stopPropagation(); consulta.atualizar(); }}>Tentar novamente</button></span>;
  const efetivo = consulta.data ?? status;
  const texto = consulta.data === 'INATIVO' ? 'Inativo' : legivel(efetivo);
  return <span className={`motorista-status motorista-status--${classe(efetivo)}`}>{texto}</span>;
}
