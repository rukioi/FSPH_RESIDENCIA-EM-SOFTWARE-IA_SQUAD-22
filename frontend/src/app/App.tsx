import { GestorLayout } from "../layouts/GestorLayout";
import { Dashboard } from "../pages/gerente/Dashboard";
import { Svo } from "../features/svo/Svo";

export function App() {
  const pagina = window.location.pathname;

  return (
    <GestorLayout>
      {pagina === "/svo" ? <Svo /> : <Dashboard />}
    </GestorLayout>
  );
}
