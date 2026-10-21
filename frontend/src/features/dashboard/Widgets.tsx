import type { ComponentProps } from "react";
import "../../app/Widgets.css";

import { Chamados } from "../../features/dashboard/chamados";
import { Atividades } from "../../features/dashboard/Atividades";
import { Frota } from "../../features/dashboard/Frota";
import { Viagens } from "../../features/dashboard/Viagens";
import { Pendencias } from "../../features/dashboard/Pendencias";

type WidgetsData = {
  chamados: ComponentProps<typeof Chamados>["dados"];
  atividades: ComponentProps<typeof Atividades>["dados"];
  frota: ComponentProps<typeof Frota>["dados"];
  viagens: ComponentProps<typeof Viagens>["dados"];
  pendencias: ComponentProps<typeof Pendencias>["dados"];
};

interface WidgetsProps {
  data?: Partial<WidgetsData>;
}

export function Widgets({ data }: WidgetsProps) {
  const demonstracao = data === undefined;

  return (
    <div className="dashboard-modulos">
      <Chamados dados={data?.chamados} demonstracao={demonstracao} />
      <Atividades dados={data?.atividades} demonstracao={demonstracao} />
      <Frota dados={data?.frota} demonstracao={demonstracao} />
      <Viagens dados={data?.viagens} demonstracao={demonstracao} />
      <Pendencias dados={data?.pendencias} demonstracao={demonstracao} />
    </div>
  );
}
