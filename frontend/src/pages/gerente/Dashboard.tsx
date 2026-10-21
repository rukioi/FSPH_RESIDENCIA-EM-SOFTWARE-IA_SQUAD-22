import { useEffect, useState } from "react";
import { AguardandoAnalise } from "../../features/dashboard/AguardandoAnalise";
import { Widgets } from "../../features/dashboard/Widgets";
import { KpiCards } from "../../features/dashboard/KpiCards";
import { buscarDashboardKpis } from "../../shared/services/dashboard.service";

import type {
  DashboardKpis,
  DashboardPeriodo,
} from "../../shared/types/dashboard";
import "./Dashboard.css";

const periodos = ["Hoje", "7 dias", "30 dias", "Personalizado"];

const periodoApi: Partial<Record<string, DashboardPeriodo>> = {
  Hoje: "hoje",
  "7 dias": "7dias",
  "30 dias": "30dias",
};

export function Dashboard() {
  const [periodo, setPeriodo] = useState("Hoje");

  const [kpis, setKpis] = useState<DashboardKpis>({
    chamadosPendentes: 0,
    viagensHoje: 0,
    veiculosDisponiveis: 0,
    motoristasDisponiveis: 0,
  });

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const periodoSelecionado = periodoApi[periodo];

    if (!periodoSelecionado) {
      setCarregando(false);
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setErro("Token de autenticação não encontrado.");
      setCarregando(false);
      return;
    }

    const authToken = token;
    const periodoValido: DashboardPeriodo = periodoSelecionado;

    async function carregarKpis() {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await buscarDashboardKpis(
          periodoValido,
          authToken,
        );

        setKpis(resposta.data);
      } catch {
        setErro("Não foi possível carregar os indicadores.");
      } finally {
        setCarregando(false);
      }
    }

    void carregarKpis();
  }, [periodo]);

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

      {carregando && (
        <p className="dashboard-mensagem">
          Carregando indicadores...
        </p>
      )}

      {erro && (
        <p className="dashboard-mensagem dashboard-mensagem--erro">
          {erro}
        </p>
      )}

      <KpiCards kpis={kpis} />

      <Widgets />
      
      <AguardandoAnalise />
    </>
  );
}
