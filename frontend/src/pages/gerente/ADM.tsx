import WidgetsADM from "../../features/dashboard/WidgetsADM";

import { useState } from "react";
import "./ADM.css";

type MenuIconName =
  | "dashboard"
  | "solicitacoes"
  | "calendario"
  | "veiculos"
  | "motoristas"
  | "svo"
  | "documentos"
  | "abastecimentos"
  | "relatorios"
  | "notificacoes";

const menuItems: { icon: MenuIconName; label: string }[] = [
  { icon: "dashboard", label: "Dashboard" },
  { icon: "solicitacoes", label: "Solicitações" },
  { icon: "calendario", label: "Calendário" },
  { icon: "veiculos", label: "Veículos" },
  { icon: "motoristas", label: "Motoristas" },
  { icon: "svo", label: "SVO" },
  { icon: "documentos", label: "Documentos" },
  { icon: "abastecimentos", label: "Abastecimentos" },
  { icon: "relatorios", label: "Relatórios" },
  { icon: "notificacoes", label: "Notificações" },
];

const periods = ["Hoje", "7 dias", "30 dias", "Personalizado"];

const iconPaths: Record<MenuIconName, string> = {
  dashboard:
    "M3 3h7v7H3z M14 3h7v5h-7z M14 12h7v9h-7z M3 14h7v7H3z",
  solicitacoes:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8 M8 9h2",
  calendario:
    "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01",
  veiculos:
    "M5 11l1.5-5h11L19 11 M3 11h18v8H3z M5 19v2 M19 19v2 M7 15h.01 M17 15h.01 M6.5 6h11",
  motoristas:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8",
  svo:
    "M6 3v5a4 4 0 0 0 8 0V3 M4 3h4 M12 3h4 M10 12v2a5 5 0 0 0 10 0v-1 M20 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4",
  documentos:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h6 M8 17h5 M17 13v4l2 2 2-2v-4",
  abastecimentos:
    "M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17 M3 22h12 M6 7h6 M6 11h6 M15 11h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-3-3",
  relatorios:
    "M3 3v18h18 M8 17v-5 M13 17V8 M18 17v-8",
  notificacoes:
    "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M10 21h4",
};

function MenuIcon({ name }: { name: MenuIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={iconPaths[name]} />
    </svg>
  );
}

export default function ADM() {
  const [selectedPeriod, setSelectedPeriod] = useState("Hoje");

  return (
    <div className="fleet-dashboard">
      <aside className="fleet-sidebar">
        <div className="fleet-brand">
          <span className="fleet-brand-icon">▰</span>
          <span>
            <strong>Gestão de Frotas</strong>
            <small>Central de Transporte</small>
          </span>
        </div>

        <nav className="fleet-nav" aria-label="Menu principal">
          {menuItems.map(({ icon, label }, index) => (
            <a
              key={label}
              href="#"
              className={`fleet-nav-item ${index === 0 ? "active" : ""}`}
              aria-current={index === 0 ? "page" : undefined}
            >
              <span className="fleet-nav-icon">
                <MenuIcon name={icon} />
              </span>
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="fleet-sidebar-bottom">
          <a href="#" className="fleet-nav-item">
            <span className="fleet-nav-icon" aria-hidden="true">
              ⚙
            </span>
            <span>Configurações</span>
          </a>

          <div className="fleet-user">
            <span className="fleet-avatar">AD</span>
            <span className="fleet-user-info">
              <strong>Administrador</strong>
              <small>Administrador do Sistema</small>
            </span>
            <span className="fleet-user-arrow" aria-hidden="true">
              ⌄
            </span>
          </div>
        </div>
      </aside>

      <div className="fleet-main">
        <header className="fleet-topbar">
          <div className="fleet-topbar-left">
            <button
              className="fleet-menu-button"
              type="button"
              aria-label="Abrir menu"
            >
              ☰
            </button>
            <span>Dashboard</span>
          </div>

          <div className="fleet-topbar-right">
            <button
              className="fleet-notification"
              type="button"
              aria-label="Notificações"
            >
              ♧<span>5</span>
            </button>

            <span className="fleet-avatar fleet-avatar-light">AD</span>

            <span className="fleet-topbar-user">
              <strong>Administrador</strong>
              <small>Administrador do Sistema</small>
            </span>

            <span aria-hidden="true">⌄</span>
          </div>
        </header>

        <main className="fleet-content">
          <div className="fleet-page-heading">
            <div>
              <h1>Dashboard</h1>
              <p>Visão geral da operação</p>
            </div>

            <div className="fleet-periods" aria-label="Período do dashboard">
              {periods.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={selectedPeriod === period ? "selected" : ""}
                  onClick={() => setSelectedPeriod(period)}
                  aria-pressed={selectedPeriod === period}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <WidgetsADM />

        </main>
      </div>
    </div>
  );
}
