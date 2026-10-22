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
import "./DashboardSvo.css";

type DashboardSvoProps = {
  solicitacoesConfirmadas: number;
  ordensAguardando: OrdemColeta[];
  ordensProntas: OrdemPronta[];
  atividades: AtividadeSvo[];
  onNovaSolicitacao?: () => void;
  onConfirmarDespacho: (
    ordem: OrdemColeta,
    veiculo: string,
    motorista: string,
  ) => void;
};

export function DashboardSvo({
  solicitacoesConfirmadas,
  ordensAguardando,
  ordensProntas,
  atividades,
  onNovaSolicitacao,
  onConfirmarDespacho,
}: DashboardSvoProps) {
  const [ordemSelecionada, setOrdemSelecionada] =
    useState<OrdemColeta | null>(null);

  const aguardandoDespacho = ordensAguardando.length;
  const prontasParaIniciar = ordensProntas.length;
  const ordensColeta =
    ordensAguardando.length + ordensProntas.length;

  function confirmarDespacho(
    veiculo: string,
    motorista: string,
  ) {
    if (!ordemSelecionada) {
      return;
    }

    onConfirmarDespacho(
      ordemSelecionada,
      veiculo,
      motorista,
    );

    setOrdemSelecionada(null);
  }

  return (
    <section className="svo-dashboard">
      <header className="svo-dashboard__cabecalho">
        <div>
          <h1>Dashboard SVO</h1>
          <p>
            Visão geral dos atendimentos e ordens de coleta
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
          <small>Atendimentos registrados</small>
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
          <small>Total de ordens em andamento</small>
        </article>

        <article className="svo-dashboard__card">
          <div className="svo-dashboard__card-topo">
            <span>Prontas para iniciar</span>
            <span
              className="svo-dashboard__icone svo-dashboard__icone--verde"
              aria-hidden="true"
            >
              ▶
            </span>
          </div>

          <strong>{prontasParaIniciar}</strong>
          <small>Despachos preparados</small>
        </article>
      </div>

      <div className="svo-dashboard__resumo">
        <GraficoAtendimentos />
        <AtividadeRecente atividades={atividades} />
      </div>

      <AguardandoDespacho
        ordens={ordensAguardando}
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
          onFechar={() => setOrdemSelecionada(null)}
          onConfirmar={confirmarDespacho}
        />
      )}
    </section>
  );
}
