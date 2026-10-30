import { useState } from "react";
import { AguardandoAnalise } from "../../features/dashboard/AguardandoAnalise";
import { Widgets } from "../../features/dashboard/Widgets";
import { KpiCards } from "../../features/dashboard/KpiCards";
import { indicadoresIndisponiveis } from "../../shared/services/dashboard.service";

import "./DashboardGestor.css";

const periodos = ["Hoje", "7 dias", "30 dias", "Personalizado"];


/** Conserva a composição visual e identifica indicadores sem endpoint e dados demonstrativos. */
export function Dashboard() {
  const [periodo, setPeriodo] = useState("Hoje");


  return (
    <>
      <div className="cabecalho-pagina">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral da operação da frota</p>
        </div>

        <div className="periodo" role="group" aria-label="Período">
          {periodos.map((nome) => (
            <button
              key={nome}
              type="button"
              aria-pressed={periodo === nome}
              className={
                periodo === nome
                  ? "periodo__botao periodo__botao--ativo"
                  : "periodo__botao"
              }
              onClick={() => setPeriodo(nome)}
            >
              {nome}
            </button>
          ))}
        </div>
      </div>

      <p className="dashboard-mensagem" role="status">{indicadoresIndisponiveis}</p>
      <KpiCards />

      <Widgets />
      
      <AguardandoAnalise />
    </>
  );
}
