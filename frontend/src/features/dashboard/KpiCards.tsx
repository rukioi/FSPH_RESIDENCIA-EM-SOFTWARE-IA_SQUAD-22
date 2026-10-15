import './KpiCards.css'
import type { DashboardKpis } from '../../shared/types/dashboard'

interface KpiCardsProps {
  kpis: DashboardKpis
}

export function KpiCards({ kpis }: KpiCardsProps) {
  return (
    <section className="cards-kpis">
      <article className="card-kpi">
        <div className="card-kpi__topo">
          <span>Chamados pendentes</span>
          <span
            className="card-kpi__icone card-kpi__icone--amarelo"
            aria-hidden="true"
          >
            ⏳
          </span>
        </div>

        <strong>{kpis.chamadosPendentes}</strong>
        <small>Aguardando análise</small>
      </article>

      <article className="card-kpi">
        <div className="card-kpi__topo">
          <span>Viagens de hoje</span>
          <span
            className="card-kpi__icone card-kpi__icone--azul"
            aria-hidden="true"
          >
            ↔
          </span>
        </div>

        <strong>{kpis.viagensHoje}</strong>
        <small>Viagens programadas para hoje</small>
      </article>

      <article className="card-kpi">
        <div className="card-kpi__topo">
          <span>Veículos disponíveis</span>
          <span
            className="card-kpi__icone card-kpi__icone--verde"
            aria-hidden="true"
          >
            ▣
          </span>
        </div>

        <strong>{kpis.veiculosDisponiveis}</strong>
        <small>Frota disponível para operação</small>
      </article>

      <article className="card-kpi">
        <div className="card-kpi__topo">
          <span>Motoristas disponíveis</span>
          <span
            className="card-kpi__icone card-kpi__icone--verde"
            aria-hidden="true"
          >
            ♙
          </span>
        </div>

        <strong>{kpis.motoristasDisponiveis}</strong>
        <small>Disponíveis para novas viagens</small>
      </article>
    </section>
  )
}
