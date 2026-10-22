import "../../app/ADM.css";

type IconName =
  | "clock"
  | "calendar"
  | "car"
  | "users"
  | "check"
  | "play"
  | "file"
  | "wrench"
  | "arrow";

const kpis: {
  icon: IconName;
  label: string;
  value: string;
  detail: string;
  variant: "warning" | "blue";
}[] = [
  {
    icon: "clock",
    label: "Solicitações pendentes",
    value: "2",
    detail: "Aguardando análise",
    variant: "warning",
  },
  {
    icon: "calendar",
    label: "Viagens hoje",
    value: "5",
    detail: "2 agendadas • 1 em andamento • 2 concluídas",
    variant: "blue",
  },
  {
    icon: "car",
    label: "Veículos disponíveis",
    value: "3 de 9",
    detail: "Frota total",
    variant: "blue",
  },
  {
    icon: "users",
    label: "Motoristas disponíveis",
    value: "3",
    detail: "de 5 motoristas",
    variant: "blue",
  },
];

const statusSolicitacoes = [
  { label: "Pendentes", value: 2, color: "orange" },
  { label: "Agendadas", value: 2, color: "blue" },
  { label: "Prontas para iniciar", value: 1, color: "cyan" },
  { label: "Em andamento", value: 1, color: "navy" },
  { label: "Concluídas", value: 1, color: "pale-blue" },
  { label: "Reprovadas", value: 1, color: "red" },
];

const atividades: { icon: IconName; text: string; time: string; color: string }[] = [
  {
    icon: "check",
    text: "Solicitação #TRP-1024 aprovada",
    time: "09:42",
    color: "green",
  },
  {
    icon: "play",
    text: "Viagem #TRP-1022 iniciada",
    time: "09:15",
    color: "blue",
  },
  {
    icon: "file",
    text: "Nova solicitação registrada pela Hemose",
    time: "08:50",
    color: "cyan",
  },
  {
    icon: "wrench",
    text: "Veículo VF-04 enviado para manutenção",
    time: "08:32",
    color: "orange",
  },
];

const situacaoFrota = [
  { label: "Disponíveis", value: 3, color: "green" },
  { label: "Em viagem", value: 2, color: "blue" },
  { label: "Em manutenção", value: 2, color: "orange" },
  { label: "Indisponíveis", value: 2, color: "red" },
];

const proximasViagens = [
  {
    time: "16:20",
    route: "Hemose – Centro → Unidade Messejana",
    ticket: "#TRP-1021",
    status: "Agendada",
    statusClass: "scheduled",
  },
  {
    time: "17:00",
    route: "Lacen → Unidade Caucaia",
    ticket: "#TRP-1020",
    status: "Pronta para iniciar",
    statusClass: "ready",
  },
];

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M12 14v4M10 16h4" />
      </>
    ),
    car: (
      <>
        <path d="m5 11 1.5-5h11L19 11" />
        <path d="M3 11h18v8H3zM5 19v2M19 19v2M7 15h.01M17 15h.01" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    play: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m10 8 6 4-6 4z" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M12 12v6M9 15h6" />
      </>
    ),
    wrench: (
      <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3z" />
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
  };

  return (
    <svg
      className="dashboard-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export default function InformacoesDashboard() {
  return (
    <section className="dashboard-info" aria-label="Informações da operação">
      <div className="dashboard-kpis">
        {kpis.map((item) => (
          <article className="dashboard-kpi-card" key={item.label}>
            <span className={`dashboard-kpi-icon ${item.variant}`}>
              <Icon name={item.icon} />
            </span>
            <div className="dashboard-kpi-copy">
              <p>{item.label}</p>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-middle-grid">
        <article className="dashboard-panel dashboard-requests">
          <header className="dashboard-panel-header">
            <div>
              <h2>Visão geral das solicitações</h2>
              <p>Distribuição por status</p>
            </div>
            <button className="dashboard-text-button" type="button">
              Ver solicitações
            </button>
          </header>

          <div className="dashboard-chart-content">
            <div className="dashboard-donut-wrap">
              <div className="dashboard-donut" aria-label="8 solicitações no total">
                <div className="dashboard-donut-center">
                  <span>Total</span>
                  <strong>8</strong>
                  <span>solicitações</span>
                </div>
              </div>
            </div>

            <ul className="dashboard-status-list">
              {statusSolicitacoes.map((item) => (
                <li key={item.label}>
                  <span className={`dashboard-status-dot ${item.color}`} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="dashboard-panel dashboard-activity">
          <header className="dashboard-panel-header">
            <h2>Atividade recente</h2>
            <button className="dashboard-text-button" type="button">
              Ver todas
            </button>
          </header>

          <ul className="dashboard-activity-list">
            {atividades.map((item) => (
              <li className="dashboard-activity-item" key={item.text}>
                <span className={`dashboard-activity-icon ${item.color}`}>
                  <Icon name={item.icon} />
                </span>
                <div>
                  <p>{item.text}</p>
                  <time>{item.time}</time>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <div className="dashboard-bottom-grid">
        <article className="dashboard-panel dashboard-fleet">
          <header className="dashboard-panel-header">
            <div>
              <h2>Situação da frota</h2>
              <p>9 veículos</p>
            </div>
            <button className="dashboard-text-button" type="button">
              Ver veículos
            </button>
          </header>

          <div className="dashboard-fleet-list">
            {situacaoFrota.map((item) => (
              <div className="dashboard-fleet-row" key={item.label}>
                <div className="dashboard-fleet-label">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="dashboard-progress-track">
                  <span
                    className={`dashboard-progress-fill ${item.color}`}
                    style={{ width: `${(item.value / 9) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel dashboard-trips">
          <header className="dashboard-panel-header">
            <h2>Próximas viagens</h2>
            <button className="dashboard-text-button" type="button">
              Ver todas as viagens <Icon name="arrow" />
            </button>
          </header>

          <div className="dashboard-trip-list">
            {proximasViagens.map((trip) => (
              <div className="dashboard-trip-row" key={trip.ticket}>
                <strong className="dashboard-trip-time">{trip.time}</strong>
                <div className="dashboard-trip-route">
                  <p>{trip.route}</p>
                  <a href="#">{trip.ticket}</a>
                </div>
                <span className={`dashboard-trip-status ${trip.statusClass}`}>
                  {trip.status}
                </span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
