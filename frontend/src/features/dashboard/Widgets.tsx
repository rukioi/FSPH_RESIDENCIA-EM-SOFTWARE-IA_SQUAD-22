import "../../app/Widgets.css";
import { Chamados } from "../../features/dashboard/chamados";
import { Atividades } from "../../features/dashboard/Atividades";
import { Frota } from "../../features/dashboard/Frota";
import { Viagens } from "../../features/dashboard/Viagens";
import { Pendencias } from "../../features/dashboard/Pendencias";

export function Widgets() {
  return (
    <div className="dashboard-modulos">
      <Chamados />
      <Atividades />
      <Frota />
      <Viagens />
      <Pendencias />
    </div>
  );
}

