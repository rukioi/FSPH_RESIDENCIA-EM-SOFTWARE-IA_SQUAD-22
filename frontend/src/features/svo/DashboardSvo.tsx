import { useState } from "react";
import {
  AguardandoDespacho,
  type OrdemColeta,
} from "./AguardandoDespacho";
import type { OrdemPronta } from "./ProntasParaIniciar";
import { OrdensColetaRecentes } from "./OrdensColetaRecentes";
import { PrepararDespachoModal } from "./PrepararDespachoModal";
import { GraficoAtendimentos } from "./GraficoAtendimentos";
import {
  AtividadeRecente,
  type AtividadeSvo,
} from "./AtividadeRecente";
import type {
  MotoristaApi,
  VeiculoApi,
} from "../../shared/types/svo";
import "./DashboardSvo.css";

type DashboardSvoProps = {
  solicitacoesConfirmadas: number;
  ordensAguardando: OrdemColeta[];
  ordensProntas: OrdemPronta[];
  atividades: AtividadeSvo[];
  erroOrdens: string;
  carregando: boolean;
  onTentarNovamente: () => void;
  motoristas: MotoristaApi[];
  veiculos: VeiculoApi[];
  onNovaSolicitacao?: () => void;
  onConfirmarDespacho: (
    ordem: OrdemColeta,
    motoristaId: number,
    veiculoId: number,
  ) => void | Promise<void>;
};

/** Apresenta ordens consultadas e delimita contadores/atividades ao recorte desta sessão. */
export function DashboardSvo({
  solicitacoesConfirmadas,
  ordensAguardando,
  ordensProntas,
  atividades,
  erroOrdens,
  carregando,
  onTentarNovamente,
  motoristas,
  veiculos,
  onNovaSolicitacao,
  onConfirmarDespacho,
}: DashboardSvoProps) {
  const [ordemSelecionada, setOrdemSelecionada] =
    useState<OrdemColeta | null>(null);

  const aguardandoDespacho = ordensAguardando.length;
  const prontasParaIniciar = ordensProntas.length;
  const ordensColeta =
    ordensAguardando.length + ordensProntas.length;

  async function confirmarDespacho(
    motoristaId: number,
    veiculoId: number,
  ) {
    if (!ordemSelecionada) {
      return;
    }

    await onConfirmarDespacho(
      ordemSelecionada,
      motoristaId,
      veiculoId,
    );

    setOrdemSelecionada(null);
  }

  return (
    <section className="svo-dashboard">
      <header className="svo-dashboard__cabecalho">
        <div>
          <h1>Dashboard SVO</h1>
          <p>
            Resumo desta sessão — contadores e atividades locais não representam o histórico completo.
          </p>
        </div>

        <button
          type="button"
          className="svo-dashboard__nova-solicitacao"
          onClick={onNovaSolicitacao}
        >
          + Nova Solicitação
        </button>
      </header>

      <div className="svo-dashboard__kpis">
        <article className="svo-dashboard__card">
          <div className="svo-dashboard__card-topo">
            <span>Solicitações confirmadas</span>
            <span
              className="svo-dashboard__icone svo-dashboard__icone--verde"
              aria-hidden="true"
            >
              ✓
            </span>
          </div>

          <strong>{solicitacoesConfirmadas}</strong>
          <small>Confirmados nesta sessão</small>
        </article>

        <article className="svo-dashboard__card">
          <div className="svo-dashboard__card-topo">
            <span>Aguardando despacho</span>
            <span
              className="svo-dashboard__icone svo-dashboard__icone--amarelo"
              aria-hidden="true"
            >
              ⏳
            </span>
          </div>

          <strong>{aguardandoDespacho}</strong>
          <small>Ordens aguardando preparação</small>
        </article>

        <article className="svo-dashboard__card">
          <div className="svo-dashboard__card-topo">
            <span>Ordens de coleta</span>
            <span
              className="svo-dashboard__icone svo-dashboard__icone--azul"
              aria-hidden="true"
            >
              ↔
            </span>
          </div>

          <strong>{ordensColeta}</strong>
          <small>Ordens carregadas e despachadas nesta sessão</small>
        </article>

        <article className="svo-dashboard__card">
          <div className="svo-dashboard__card-topo">
            <span>Em andamento</span>
            <span
              className="svo-dashboard__icone svo-dashboard__icone--verde"
              aria-hidden="true"
            >
              ▶
            </span>
          </div>

          <strong>{prontasParaIniciar}</strong>
          <small>Despachadas nesta sessão</small>
        </article>
      </div>

      <div className="svo-dashboard__resumo">
        <GraficoAtendimentos />
        <AtividadeRecente atividades={atividades} />
      </div>

      {carregando && <p role="status">Carregando ordens...</p>}
      {erroOrdens && <button type="button" onClick={onTentarNovamente}>Tentar novamente</button>}
      <AguardandoDespacho
        ordens={ordensAguardando}
        erro={erroOrdens}
        onPrepararDespacho={setOrdemSelecionada}
      />

      <OrdensColetaRecentes
        aguardando={ordensAguardando}
        prontas={ordensProntas}
        onPrepararDespacho={setOrdemSelecionada}
      />

      {ordemSelecionada && (
        <PrepararDespachoModal
          ordemId={ordemSelecionada.id}
          motoristas={motoristas}
          veiculos={veiculos}
          onFechar={() => setOrdemSelecionada(null)}
          onConfirmar={confirmarDespacho}
        />
      )}
    </section>
  );
}
