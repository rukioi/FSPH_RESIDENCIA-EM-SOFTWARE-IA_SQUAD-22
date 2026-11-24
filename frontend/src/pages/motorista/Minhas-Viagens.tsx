



import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "./Minhas-Viagens.css";

type TripListItem = {
  id: string;
  group: "Hoje" | "Próximas";
  status: "Agendada" | "Em andamento" | "Concluída";
  date: string;
  time: string;
  origin: string;
  destination: string;
  vehicle: string;
  plate: string;
};

type CompletedTripRecord = {
  startedAt: Date | null;
  finishedAt: Date;
  initialOdometer: string | null;
  finalOdometer: string;
  initialPhoto: string | null;
  finalPhoto: string;
  hasFuelRegistration: boolean;
  hasIncidentRegistration: boolean;
};

type TripNotification = {
  id: number;
  kind: "created" | "updated" | "inProgress" | "completed" | "reminder";
  title: string;
  tripId: string;
  detail: string;
  time: string;
};

const initialNotifications: TripNotification[] = [
  { id: 1, kind: "created", title: "Novo transporte atribuído", tripId: "TRP-1025", detail: "Viagem agendada para 16:20", time: "Hoje, 11:40" },
  { id: 2, kind: "reminder", title: "Lembrete da próxima viagem", tripId: "TRP-1022", detail: "SVO — Sede → Rua das Flores, 240 às 13:30", time: "Hoje, 10:15" },
  { id: 3, kind: "updated", title: "Alteração na sua próxima viagem", tripId: "TRP-1027", detail: "Destino atualizado para Unidade de Saúde Norte", time: "Ontem, 17:02" },
];

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const formatTripDate = (date: Date) => date.toLocaleDateString("pt-BR");

const initialTripListData: TripListItem[] = [
  {
    id: "TRP-1022", group: "Hoje", status: "Agendada", date: formatTripDate(today), time: "13:30",
    origin: "SVO — Sede", destination: "Rua das Flores, 240", vehicle: "VF-01", plate: "PQQ-4A21",
  },
  {
    id: "TRP-1025", group: "Hoje", status: "Agendada", date: formatTripDate(today), time: "15:00",
    origin: "Laboratório Central", destination: "Hospital Universitário", vehicle: "VF-03", plate: "QRT-8B07",
  },
  {
    id: "TRP-1027", group: "Próximas", status: "Agendada", date: formatTripDate(tomorrow), time: "08:00",
    origin: "SVO — Sede", destination: "Unidade de Saúde Norte", vehicle: "VF-02", plate: "NHK-5C33",
  },
];


function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
      <circle cx="7.5" cy="18" r="1.7" />
      <circle cx="17.5" cy="18" r="1.7" />
    </svg>
  );
}


function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
      {visible && <path d="M4 20 20 4" />}
    </svg>
  );
}


function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.7-3 8.2-7 10-4-1.8-7-5.3-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}


function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h5v16h-5M10 8l4 4-4 4M14 12H3" />
    </svg>
  );
}


function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}


function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </svg>
  );
}


function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}


function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18m-9 3v4l3 2" />
    </svg>
  );
}


function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}


function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}


function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6m0 4h.01" />
    </svg>
  );
}


function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.3 2.3 4.8-4.8" />
    </svg>
  );
}


function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("carlos.henrique");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");


  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setNotice("Informe seu usuário e sua senha para continuar.");
      return;
    }
    onLogin();
  }


  return (
    <main className="login-page">
      <section className="login-card" aria-label="Acesso do motorista">
        <header className="login-header">
          <div className="brand-icon"><TruckIcon /></div>
          <h1>Gestão de Frotas</h1>
          <p>Central de Transporte</p>
        </header>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Usuário</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Digite seu usuário"
              required
            />
          </div>
          <div className="field password-field">
            <label htmlFor="password">Senha</label>
            <div className="password-input-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite sua senha"
                required
              />
              <button
                className="visibility-button"
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
            <p className="helper-text">Acesse com os dados fornecidos pela sua transportadora.</p>
          </div>
          <button className="submit-button" type="submit">
            <EnterIcon /><span>Entrar</span>
          </button>
          {notice && <p className="notice" role="status">{notice}</p>}
        </form>
        <div className="profile-note">
          <span className="shield-icon"><ShieldIcon /></span>
          <p>Perfil identificado automaticamente: <strong>MOTORISTA</strong> — Carlos Henrique. Não é necessário escolher perfil.</p>
        </div>
      </section>
    </main>
  );
}


function BottomNavigation({ active = "home", onHome, onTrips, onNotifications, onProfile }: { active?: "home" | "trips" | "notifications" | "profile" | "none"; onHome?: () => void; onTrips?: () => void; onNotifications?: () => void; onProfile?: () => void }) {
  return (
    <nav className="bottom-navigation" aria-label="Navegação principal">
      <button className={`nav-item ${active === "home" ? "active" : ""}`} type="button" onClick={onHome} aria-label="Ir para Início"><HomeIcon /><span>Início</span></button>
      <button className={`nav-item ${active === "trips" ? "active" : ""}`} type="button" onClick={onTrips} aria-label="Ir para Viagens"><TruckIcon /><span>Viagens</span></button>
      <button className={`nav-item ${active === "notifications" ? "active" : ""}`} type="button" onClick={onNotifications} aria-label="Ir para Notificações"><BellIcon /><span>Notificações</span></button>
      <button className={`nav-item ${active === "profile" ? "active" : ""}`} type="button" onClick={onProfile} aria-label="Ir para Perfil"><UserIcon /><span>Perfil</span></button>
    </nav>
  );
}


function HomeScreen({ onViewTrip, onHome, onTrips, onNotifications, onProfile, trips }: { onViewTrip: (trip: TripListItem) => void; onHome: () => void; onTrips: () => void; onNotifications: () => void; onProfile: () => void; trips: TripListItem[] }) {
  const pendingTrips = trips.filter((trip) => trip.status !== "Concluída");
  const featuredTrip = pendingTrips[0];
  const otherTrips = pendingTrips.slice(1);
  return (
    <main className="trips-page">
      <header className="trips-header">
        <h1>Olá, Carlos</h1>
        <p>Confira suas viagens de hoje.</p>
      </header>
      <section className="trips-content">
        <article className="driver-card">
          <div><span className="eyebrow">MOTORISTA</span><h2>Carlos Henrique</h2><p>Jornada 07:00 — 17:00</p></div>
          <span className="availability">Disponível</span>
        </article>
        {featuredTrip ? <article className="next-trip-card">
          <div className="trip-card-top"><span className="eyebrow blue-text">PRÓXIMA VIAGEM</span><span className="status-pill">{featuredTrip.status}</span></div>
          <div className="trip-title-row"><h2>#{featuredTrip.id}</h2><span className="time-pill"><CalendarIcon />{featuredTrip.time}</span></div>
          <p className="trip-destination">{featuredTrip.origin}</p>
          <p className="destination-label">até</p>
          <p className="trip-destination">{featuredTrip.destination}</p>
          <div className="vehicle-line"><TruckIcon />Veículo {featuredTrip.vehicle} • {featuredTrip.plate}</div>
          <button className="view-trip-button" type="button" onClick={() => onViewTrip(featuredTrip)}>Ver viagem</button>
          <p className="trip-date">{featuredTrip.date} • {featuredTrip.time}</p>
        </article> : <article className="next-trip-card"><p style={{ margin: 0 }}>Você não tem viagens pendentes.</p></article>}
        <div className="upcoming-heading"><h2>Próximas viagens</h2><button type="button" onClick={onTrips}>Ver todas <span>›</span></button></div>
        {otherTrips.map((trip) => <button className="upcoming-trip-card" type="button" key={trip.id} onClick={() => onViewTrip(trip)} style={{ width: "100%", textAlign: "left", font: "inherit", cursor: "pointer" }}>
          <div className="upcoming-top"><strong>#{trip.id}</strong><span className="status-pill">{trip.status}</span></div>
          <p className="upcoming-date">{trip.date} • {trip.time}</p>
          <div className="upcoming-route"><div><p>{trip.origin}</p><span>para</span><p>{trip.destination}</p></div><span className="route-arrow">›</span></div>
          <div className="upcoming-vehicle">Veículo {trip.vehicle} • {trip.plate}</div>
        </button>)}
      </section>
      <BottomNavigation active="home" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={onProfile} />
    </main>
  );
}

function TripsListScreen({ onSelectTrip, onHome, onNotifications, onProfile, activeTab, onTabChange, trips }: { onSelectTrip: (trip: TripListItem) => void; onHome: () => void; onNotifications: () => void; onProfile: () => void; activeTab: "Hoje" | "Próximas" | "Concluídas"; onTabChange: (tab: "Hoje" | "Próximas" | "Concluídas") => void; trips: TripListItem[] }) {
  const visibleTrips = activeTab === "Hoje" ? trips.filter((trip) => trip.group === "Hoje") : activeTab === "Próximas" ? trips.filter((trip) => trip.group === "Próximas" && trip.status !== "Concluída") : trips.filter((trip) => trip.status === "Concluída");
  const tabCounts = { Hoje: trips.filter((trip) => trip.group === "Hoje").length, Próximas: trips.filter((trip) => trip.group === "Próximas" && trip.status !== "Concluída").length, Concluídas: trips.filter((trip) => trip.status === "Concluída").length };
  return (
    <main className="trips-page trip-list-page">
      <style>{`
        .trip-list-page .trip-list-header { flex: 0 0 88px; min-height: 88px; padding: 19px 14px 13px; }
        .trip-list-header h1 { margin: 0 0 5px; font-size: 20px; line-height: 1.2; }
        .trip-list-header p { margin: 0; font-size: 13px; color: #d9e5f4; }
        .trip-list-content { gap: 12px; padding: 16px 13px 94px; }
        .trip-filter-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; border: 1px solid #d5dfeb; border-radius: 8px; background: #edf1f5; }
        .trip-filter-tab { min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 0; border-radius: 6px; background: transparent; color: #58718e; font: inherit; font-size: 13px; cursor: pointer; }
        .trip-filter-tab small { font-size: 11px; }
        .trip-filter-tab.selected { background: #075ce5; color: #fff; box-shadow: 0 1px 3px #0a4fb333; }
        .trip-list-card { position: relative; display: block; width: 100%; padding: 15px 16px 0; border: 1px solid #d5dfeb; border-radius: 9px; background: #fff; color: #17243a; text-align: left; font: inherit; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
        .trip-list-card:hover { border-color: #9cb9e1; box-shadow: 0 4px 12px #102b4d12; transform: translateY(-1px); }
        .trip-list-card:focus-visible, .trip-filter-tab:focus-visible { outline: 3px solid #80b4ff; outline-offset: 2px; }
        .trip-list-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .trip-list-card-head strong { font-size: 14px; }
        .trip-card-status { padding: 4px 10px; border: 1px solid #b7ddca; border-radius: 999px; background: #edf8f2; color: #138657; font-size: 11px; white-space: nowrap; }
        .trip-card-status.scheduled { border-color: #b8d0ff; background: #eaf1ff; color: #075ce5; }
        .trip-card-status.progress { border-color: #f2d391; background: #fff7e5; color: #a66a00; }
        .trip-list-date { margin: 0 0 13px; color: #58718e; font-size: 13px; }
        .trip-list-route { display: grid; grid-template-columns: 1fr 16px; align-items: center; gap: 8px; margin-bottom: 12px; }
        .trip-list-route p { margin: 0; font-size: 14px; line-height: 1.45; }
        .trip-list-route small { display: block; margin: 2px 0 3px; color: #58718e; font-size: 11px; }
        .trip-list-chevron { color: #58718e; font-size: 25px; font-weight: 300; text-align: right; }
        .trip-list-vehicle { min-height: 44px; display: flex; align-items: center; border-top: 1px solid #d5dfeb; color: #58718e; font-size: 12px; }
        .trip-list-empty { padding: 28px 14px; border: 1px dashed #cbd7e5; border-radius: 9px; color: #58718e; text-align: center; font-size: 13px; }
        .trip-info-content { gap: 12px; padding-bottom: 94px; }
        .trip-info-card { padding: 16px; }
        .trip-info-card .detail-title-row { margin-bottom: 12px; }
        .trip-info-back { width: fit-content; padding: 4px 0 0; border: 0; background: transparent; color: #fff; font: inherit; cursor: pointer; }
        .trip-info-header { flex: 0 0 88px; min-height: 88px; padding: 13px 14px; }
        .trip-info-header h1 { margin: 8px 0 0; font-size: 19px; }
        @media (prefers-reduced-motion: reduce) { .trip-list-card { transition: none; } .trip-list-card:hover { transform: none; } }
      `}</style>
      <header className="trips-header trip-list-header"><h1>Minhas viagens</h1><p>Somente as viagens atribuídas a você</p></header>
      <section className="trips-content trip-list-content" aria-label="Lista de viagens">
        <div className="trip-filter-tabs" role="tablist" aria-label="Filtrar viagens">
          {(["Hoje", "Próximas", "Concluídas"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={`trip-filter-tab${activeTab === tab ? " selected" : ""}`} onClick={() => onTabChange(tab)}><span>{tab}</span><small>{tabCounts[tab]}</small></button>)}
        </div>
        {visibleTrips.length ? visibleTrips.map((trip) => <button className="trip-list-card" type="button" key={trip.id} onClick={() => onSelectTrip(trip)} aria-label={`Ver detalhes da viagem ${trip.id}`}>
          <div className="trip-list-card-head"><strong>#{trip.id}</strong><span className={`trip-card-status${trip.status === "Agendada" ? " scheduled" : trip.status === "Em andamento" ? " progress" : ""}`}>{trip.status}</span></div>
          <p className="trip-list-date">{trip.date} • {trip.time}</p>
          <div className="trip-list-route"><div><p>{trip.origin}</p><small>para</small><p>{trip.destination}</p></div><span className="trip-list-chevron" aria-hidden="true">›</span></div>
          <div className="trip-list-vehicle">Veículo {trip.vehicle} • {trip.plate}</div>
        </button>) : <div className="trip-list-empty">Nenhuma viagem nesta categoria.</div>}
      </section>
      <BottomNavigation active="trips" onHome={onHome} onTrips={() => onTabChange("Hoje")} onNotifications={onNotifications} onProfile={onProfile} />
    </main>
  );
}

function TripInfoScreen({ trip, onBack, onHome, onTrips, onNotifications, onProfile }: { trip: TripListItem; onBack: () => void; onHome: () => void; onTrips: () => void; onNotifications: () => void; onProfile: () => void }) {
  return (
    <main className="trips-page trip-details-page trip-info-page">
      <style>{`
        .trip-info-page .trip-info-header { flex: 0 0 88px; min-height: 88px; padding: 12px 14px 14px; }
        .trip-info-header h1 { margin: 7px 0 0; font-size: 19px; }
        .trip-info-back { width: fit-content; padding: 0; border: 0; background: none; color: #fff; font: inherit; font-size: 13px; cursor: pointer; }
        .trip-info-content { gap: 12px; padding-bottom: 94px; }
        .trip-info-card { padding: 15px; }
        .trip-info-status { padding: 4px 10px; border: 1px solid #b7ddca; border-radius: 999px; background: #edf8f2; color: #138657; font-size: 11px; }
        .trip-info-status.scheduled { border-color: #b8d0ff; background: #eaf1ff; color: #075ce5; }
        .trip-info-status.progress { border-color: #f2d391; background: #fff7e5; color: #a66a00; }
        .trip-info-route { display: grid; gap: 17px; }
        .trip-info-route-row { display: flex; gap: 11px; align-items: flex-start; }
        .trip-info-route-dot { width: 10px; height: 10px; margin-top: 5px; flex: 0 0 auto; border: 2px solid #075ce5; border-radius: 50%; }
        .trip-info-route-row:last-child .trip-info-route-dot { border-color: #138657; }
        .trip-info-route-row div { display: grid; gap: 3px; }
        .trip-info-route-row small { color: #58718e; font-size: 11px; }
        .trip-info-route-row strong { font-size: 14px; font-weight: 500; }
      `}</style>
      <header className="trips-header details-header trip-info-header"><button className="trip-info-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button><h1>Detalhes da viagem</h1></header>
      <section className="trips-content details-content trip-info-content">
        <article className="detail-card trip-info-card"><div className="detail-title-row"><h2>#{trip.id}</h2><span className={`trip-info-status${trip.status === "Agendada" ? " scheduled" : trip.status === "Em andamento" ? " progress" : ""}`}>{trip.status}</span></div><div className="detail-row"><span>Data</span><strong>{trip.date}</strong></div><div className="detail-row"><span>Horário</span><strong>{trip.time}</strong></div></article>
        <article className="detail-card trip-info-card"><p className="detail-section-label">TRAJETO</p><div className="trip-info-route"><div className="trip-info-route-row"><span className="trip-info-route-dot"/><div><small>Origem</small><strong>{trip.origin}</strong></div></div><div className="trip-info-route-row"><span className="trip-info-route-dot"/><div><small>Destino</small><strong>{trip.destination}</strong></div></div></div></article>
        <article className="detail-card vehicle-card trip-info-card"><p className="detail-section-label">VEÍCULO ATRIBUÍDO</p><div className="detail-vehicle"><span className="vehicle-icon"><TruckIcon/></span><div><strong>{trip.vehicle}</strong><span>{trip.plate}</span></div></div></article>
      </section>
      <BottomNavigation active="none" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={onProfile}/>
    </main>
  );
}


function DetailsScreen({ trip, onBack, onStart, onContinue, onHome, onTrips, onNotifications, onProfile, hasStarted, hasFinished, showSuccess, startedAt, finishedAt, initialOdometer, finalOdometer }: { trip: TripListItem; onBack: () => void; onStart: () => void; onContinue: () => void; onHome: () => void; onTrips: () => void; onNotifications: () => void; onProfile: () => void; hasStarted: boolean; hasFinished: boolean; showSuccess: boolean; startedAt: Date | null; finishedAt: Date | null; initialOdometer: string | null; finalOdometer: string | null }) {
  return (
    <main className="trips-page trip-details-page">
      <header className={`trips-header details-header back-header-animated${showSuccess ? " has-success" : ""}`}>
        {showSuccess ? (
          <div className="trip-start-toast" role="status" aria-live="polite">
            <span className="trip-start-toast-icon" aria-hidden="true">✓</span>
            <span>Viagem iniciada com sucesso.</span>
          </div>
        ) : (
          <button className="details-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button>
        )}
        <h1>Detalhes da viagem</h1>
      </header>
      <section className="trips-content details-content">
        <article className="detail-card">
          <div className="detail-title-row"><h2>#{trip.id}</h2><span className="status-pill">{hasFinished ? "Finalizada" : hasStarted ? "Em andamento" : "Agendada"}</span></div>
          <div className="detail-row"><span>Data</span><strong>{trip.date}</strong></div>
          <div className="detail-row"><span>Horário</span><strong>{trip.time}</strong></div>
          <div className="detail-row"><span>Finalidade</span><strong>Atendimento institucional</strong></div>
        </article>
        <article className="detail-card">
          <p className="detail-section-label">TRAJETO</p>
          <div className="route-panel">
            <div className="route-stop origin"><span className="route-dot" /><div><small>Origem</small><strong>{trip.origin}</strong></div></div>
            <div className="route-stop destination"><span className="route-dot" /><div><small>Destino</small><strong>{trip.destination}</strong></div></div>
          </div>
        </article>
        <article className="detail-card vehicle-card">
          <p className="detail-section-label">VEÍCULO ATRIBUÍDO</p>
          <div className="detail-vehicle"><span className="vehicle-icon"><TruckIcon /></span><div><strong>{trip.vehicle}</strong><span>{trip.plate}</span></div></div>
          <div className="vehicle-notice"><span aria-hidden="true">♙</span><p>Veículo definido pelo responsável da operação. Não é possível alterar o veículo ou a alocação.</p></div>
        </article>
        {hasStarted && (
          <>
            <article className="detail-card trip-record-card">
              <p className="detail-section-label">REGISTRO DA VIAGEM</p>
              <div className="detail-row"><span>Início</span><strong>{startedAt ? startedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></div>
              <div className="detail-row"><span>KM inicial</span><strong>{initialOdometer ?? "—"} km</strong></div>
            </article>
            <div className="trip-progress-label">{hasFinished ? "Viagem finalizada" : "Viagem em andamento"}</div>
            {hasFinished && (
              <article className="detail-card trip-record-card">
                <p className="detail-section-label">REGISTRO DE ENCERRAMENTO</p>
                <div className="detail-row"><span>Conclusão</span><strong>{finishedAt ? finishedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</strong></div>
                <div className="detail-row"><span>KM final</span><strong>{finalOdometer ?? "—"} km</strong></div>
              </article>
            )}
          </>
        )}
      </section>
      <div className="details-action">
        {hasFinished ? (
          <>
            <button className="start-trip-button" type="button" disabled><CheckIcon /> VIAGEM FINALIZADA</button>
            <p>Esta viagem foi encerrada com sucesso.</p>
          </>
        ) : (
          <>
            <button className="start-trip-button" type="button" onClick={hasStarted ? onContinue : onStart}><span aria-hidden="true">▷</span> {hasStarted ? "CONTINUAR VIAGEM" : "INICIAR VIAGEM"}</button>
            <p>{hasStarted ? "Será necessário informar a quilometragem final e uma nova foto do painel." : "Será necessário registrar o odômetro antes de sair."}</p>
          </>
        )}
      </div>
      <BottomNavigation active="none" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={onProfile} />
    </main>
  );
}


function FuelIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M3 21h13M7 7h5v5H7zM15 7h2l3 3v7a2 2 0 0 1-4 0v-4" />
    </svg>
  );
}

function IncidentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v5m0 3h.01" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function InProgressScreen({
  trip,
  onRecordFuel,
  onReportIncident,
  onFinish,
  onHome,
  onTrips,
  onNotifications,
  onProfile,
  startedAt,
  initialOdometer,
}: {
  trip: TripListItem;
  onRecordFuel: () => void;
  onReportIncident: () => void;
  onFinish: () => void;
  onHome: () => void;
  onTrips: () => void;
  onNotifications: () => void;
  onProfile: () => void;
  startedAt: Date | null;
  initialOdometer: string | null;
}) {
  const startTime = startedAt
    ? startedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <main className="trips-page in-progress-page">
      <style>{`
        .in-progress-page .in-progress-header { flex: 0 0 108px; min-height: 108px; padding: 19px 10px 15px; }
        .in-progress-header h1 { margin: 0 0 7px; font-size: 20px; }
        .in-progress-header p { max-width: 330px; margin: 0; color: #dbe6f5; font-size: 14px; line-height: 1.45; }
        .in-progress-page .in-progress-content { gap: 15px; padding: 16px 10px 170px; }
        .progress-trip-card { border: 2px solid #1260f2; background: #eaf0fa; }
        .progress-trip-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .progress-status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: #075ce5; color: #fff; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .progress-status i { width: 7px; height: 7px; border-radius: 50%; background: #fff; }
        .progress-trip-card h2 { margin: 12px 0 15px; color: #17243a; font-size: 18px; }
        .progress-destination { display: flex; align-items: flex-start; gap: 9px; }
        .progress-destination svg { width: 16px; height: 16px; flex: 0 0 16px; fill: none; stroke: #1260f2; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .progress-destination div { display: grid; gap: 4px; }
        .progress-destination span { color: #58718e; font-size: 12px; }
        .progress-destination strong { color: #17243a; font-size: 14px; font-weight: 400; }
        .in-progress-page .initial-km { color: #075ce5; }
        .trip-records-card { display: grid; gap: 8px; }
        .trip-records-card .detail-section-label { margin-bottom: 2px; }
        .trip-record-button { width: 100%; min-height: 50px; display: flex; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid #d5dfeb; border-radius: 8px; background: #fff; color: #17243a; text-align: left; font-size: 13px; cursor: pointer; transition: border-color .16s ease, background-color .16s ease; }
        .trip-record-button:hover { border-color: #1260f2; background: #f7faff; }
        .trip-record-button svg { width: 17px; height: 17px; flex: 0 0 17px; fill: none; stroke: #58718e; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .trip-record-button span { flex: 1; }
        .trip-record-button b { color: #58718e; font-size: 22px; font-weight: 400; line-height: 1; }
        .in-progress-action { bottom: calc(74px + env(safe-area-inset-bottom, 0px)); }
        .in-progress-action > p { max-width: 350px; margin: 9px auto 0; line-height: 1.4; }
        .trip-record-button:focus-visible { outline: 3px solid rgba(18, 91, 229, .35); outline-offset: 2px; }
        @media (max-width: 480px) { .in-progress-page .in-progress-content { padding-right: 10px; padding-left: 10px; } }
        @media (prefers-reduced-motion: reduce) { .trip-record-button { transition: none; } }
      `}</style>

      <header className="trips-header in-progress-header">
        <h1>Viagem em andamento</h1>
        <p>Os status são atualizados conforme você registra as ações.</p>
      </header>

      <section className="trips-content in-progress-content">
        <article className="detail-card progress-trip-card">
          <div className="progress-trip-top">
            <span className="eyebrow blue-text">EM DESLOCAMENTO</span>
            <span className="progress-status"><i /> EM ANDAMENTO</span>
          </div>
          <h2>#{trip.id}</h2>
          <div className="progress-destination">
            <MapPinIcon />
            <div><span>Destino</span><strong>{trip.destination}</strong></div>
          </div>
        </article>

        <article className="detail-card">
          <p className="detail-section-label">TRAJETO</p>
          <div className="route-panel">
            <div className="route-stop origin"><span className="route-dot" /><div><small>Origem</small><strong>{trip.origin}</strong></div></div>
            <div className="route-stop destination"><span className="route-dot" /><div><small>Destino</small><strong>{trip.destination}</strong></div></div>
          </div>
        </article>

        <article className="detail-card">
          <p className="detail-section-label">DADOS DA VIAGEM</p>
          <div className="detail-row"><span>Origem</span><strong>{trip.origin}</strong></div>
          <div className="detail-row"><span>Destino</span><strong>{trip.destination}</strong></div>
          <div className="detail-row"><span>Veículo</span><strong>{trip.vehicle} • {trip.plate}</strong></div>
          <div className="detail-row"><span>Início</span><strong>{startTime}</strong></div>
          <div className="detail-row"><span>KM inicial</span><strong className="initial-km">{initialOdometer ?? "—"} km</strong></div>
        </article>

        <article className="detail-card trip-records-card">
          <p className="detail-section-label">REGISTROS DURANTE A VIAGEM</p>
          <button className="trip-record-button" type="button" onClick={onRecordFuel}>
            <FuelIcon /><span>Registrar abastecimento</span><b aria-hidden="true">›</b>
          </button>
          <button className="trip-record-button" type="button" onClick={onReportIncident}>
            <IncidentIcon /><span>Registrar ocorrência</span><b aria-hidden="true">›</b>
          </button>
        </article>
      </section>

      <div className="details-action in-progress-action">
        <button className="start-trip-button" type="button" onClick={onFinish}>
          <span aria-hidden="true">⚐</span> FINALIZAR VIAGEM
        </button>
        <p>Será necessário informar a quilometragem final e uma nova foto do painel.</p>
      </div>
      <BottomNavigation active="none" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={onProfile} />
    </main>
  );
}

function IncidentRegistrationScreen({ trip, onBack, onSubmit }: { trip: TripListItem; onBack: () => void; onSubmit: () => void }) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [registeredAt] = useState(() => new Date());
  const dateText = registeredAt.toLocaleDateString("pt-BR");
  const timeText = registeredAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  }

  function handleCapturePhoto() {
    setPhotoPreview(DEMO_ODOMETER_IMAGE);
    setCaptureOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!description.trim()) return;
    onSubmit();
  }

  return (
    <main className="trips-page incident-registration-page">
      <style>{`
        .incident-registration-page { overflow: hidden; }
        .incident-registration-page .incident-header { flex: 0 0 104px; min-height: 104px; padding: 12px 15px 15px; }
        .incident-registration-page .incident-header h1 { margin: 0; font-size: 19px; }
        .incident-registration-page .incident-back { margin-bottom: 12px; }
        .incident-registration-page .incident-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; gap: 16px; padding: 16px 14px 20px; }
        .incident-form-card { flex: 0 0 auto; padding: 16px; border: 1px solid #d5dfeb; border-radius: 9px; background: #fff; }
        .incident-registration-page .incident-record-card { position: relative; overflow: hidden; background: #fff !important; }
        .incident-registration-page .incident-record-card::before,
        .incident-registration-page .incident-record-card::after { content: none !important; display: none !important; }
        .incident-registration-page .incident-record-card img,
        .incident-registration-page .incident-record-card picture,
        .incident-registration-page .incident-record-card video,
        .incident-registration-page .incident-record-card canvas,
        .incident-registration-page .incident-record-card iframe { display: none !important; }
        .incident-info-row { min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #dfe5ed; color: #58718e; font-size: 13px; }
        .incident-info-row strong { color: #17243a; font-size: 13px; font-weight: 400; }
        .incident-form-card .detail-section-label { margin: 0 0 12px; }
        .incident-info-notice { display: flex; align-items: flex-start; gap: 7px; margin: 10px 0 0; padding-top: 9px; border-top: 1px solid #dfe5ed; color: #58718e; font-size: 11px; line-height: 1.45; }
        .incident-info-notice svg { width: 13px; height: 13px; flex: 0 0 13px; margin-top: 1px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        .incident-description-card label, .incident-photo-card > label { display: block; margin: 0 0 7px; color: #17243a; font-size: 13px; }
        .incident-description-card textarea { width: 100%; min-height: 138px; resize: vertical; padding: 11px 12px; border: 1px solid #cdd8e5; border-radius: 8px; outline: 0; color: #17243a; background: #fff; font: inherit; font-size: 14px; line-height: 1.55; }
        .incident-description-card textarea::placeholder { color: #647b98; }
        .incident-description-card textarea:focus { border-color: #1760e8; box-shadow: 0 0 0 3px rgba(23,96,232,.12); }
        .incident-description-card textarea.has-error { border-color: #ff3434; }
        .incident-required-note { margin: 7px 0 0; color: #58718e; font-size: 11px; }
        .incident-required-note.has-error { color: #ff3434; }
        .incident-photo-box { display: flex; flex-direction: column; align-items: center; padding: 16px; border: 1px dashed #cdd8e5; border-radius: 8px; text-align: center; }
        .incident-camera-placeholder { width: 48px; height: 48px; display: grid; place-items: center; margin-bottom: 12px; border-radius: 50%; background: #edf2f6; color: #647b98; }
        .incident-camera-placeholder svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .incident-photo-copy { max-width: 280px; margin: 0 0 11px; color: #58718e; font-size: 13px; line-height: 1.5; }
        .incident-camera-button { width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 8px; background: #125be5; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .incident-camera-button:hover { background: #0d4fcf; }
        .incident-camera-button svg, .incident-file-button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .incident-file-button { min-height: 45px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; background: transparent; color: #58718e; font-size: 13px; cursor: pointer; }
        .incident-photo-preview { display: block; width: 100%; max-height: 220px; margin-bottom: 12px; border-radius: 7px; object-fit: contain; background: #edf2f6; }
        .incident-photo-actions { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .incident-photo-registered-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid #a7d9bf; border-radius: 999px; background: #eff8f2; color: #078548; font-size: 12px; white-space: nowrap; }
        .incident-photo-registered-badge svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; }
        .incident-retake-button { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 11px; border: 1px solid #d1dce8; border-radius: 7px; background: #fff; color: #17243a; font-size: 12px; cursor: pointer; transition: background .16s ease, border-color .16s ease, transform .16s ease; }
        .incident-retake-button:hover { background: #f7f9fc; border-color: #aebed0; transform: translateY(-1px); }
        .incident-retake-button:active { transform: translateY(0); }
        .incident-lock-note { display: flex; align-items: flex-start; gap: 8px; flex: 0 0 auto; padding: 11px; border: 1px solid #d5dfeb; border-radius: 8px; background: #fff; color: #58718e; font-size: 12px; line-height: 1.45; }
        .incident-lock-note svg { width: 16px; height: 16px; flex: 0 0 16px; fill: none; stroke: #075ce5; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .incident-footer { flex: 0 0 auto; padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #d5dfeb; background: #f7f8fa; }
        .incident-submit-button { width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 8px; background: #125be5; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .incident-submit-button:hover { background: #0d4fcf; }
        .incident-submit-button svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .incident-hidden-input { display: none; }
        .incident-capture-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; min-height: 100dvh; padding: 16px 12px; background: rgba(15,29,48,.76); color: #f7f9fc; }
        .incident-capture-card { display: flex; flex-direction: column; width: min(100%,390px); max-height: calc(100dvh - 32px); padding: 10px 12px 14px; overflow-y: auto; border-radius: 15px; background: #182536; box-shadow: 0 18px 44px rgba(0,0,0,.28); }
        .incident-capture-header { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; min-height: 32px; margin-bottom: 4px; font-size: 14px; font-weight: 500; }
        .incident-capture-close { display: grid; width: 32px; height: 32px; place-items: center; padding: 0; border: 0; background: transparent; color: #e6ebf2; font-size: 27px; line-height: 1; cursor: pointer; }
        .incident-capture-viewfinder { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: clamp(200px,31vh,268px); border: 2px dashed #7f8996; border-radius: 8px; background: #303c4c; text-align: center; }
        .incident-capture-viewfinder > svg { width: 34px; height: 34px; margin: auto 0 10px; fill: none; stroke: #d6dde6; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .incident-capture-label { position: absolute; top: 13px; left: 12px; color: #c6d4e6; font-size: 11px; }
        .incident-capture-instruction { max-width: 290px; margin: 0 auto auto; padding: 0 12px; color: #e1e9f3; font-size: 14px; line-height: 1.5; }
        .incident-capture-action { display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; gap: 10px; padding-top: 24px; color: #e1e9f3; font-size: 12px; }
        .incident-capture-button { display: grid; width: 64px; height: 64px; place-items: center; border: 0; border-radius: 50%; background: #f5f6f8; color: #182536; cursor: pointer; transition: transform .16s ease, background .16s ease; }
        .incident-capture-button:hover { transform: scale(1.05); background: #fff; }
        .incident-capture-button svg { width: 27px; height: 27px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        @media (max-width: 480px) { .incident-registration-page .incident-content { padding-right: 14px; padding-left: 14px; } }
      `}</style>
      <header className="trips-header details-header back-header-animated incident-header">
        <button className="details-back incident-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button>
        <h1>Registrar ocorrência</h1>
      </header>

      {captureOpen && (
        <section className="incident-capture-overlay" role="dialog" aria-modal="true" aria-label="Captura da foto da ocorrência">
          <div className="incident-capture-card">
            <header className="incident-capture-header">
              <span>Adicionar foto (opcional)</span>
              <button className="incident-capture-close" type="button" aria-label="Fechar captura" onClick={() => setCaptureOpen(false)}>×</button>
            </header>
            <div className="incident-capture-viewfinder">
              <span className="incident-capture-label">câmera simulada</span>
              <CameraIcon />
              <p className="incident-capture-instruction">Aponte para o painel do veículo e enquadre o problema.</p>
            </div>
            <div className="incident-capture-action">
              <button className="incident-capture-button" type="button" aria-label="Toque para capturar a foto" onClick={handleCapturePhoto}><CameraIcon /></button>
              <span>Toque para capturar a foto</span>
            </div>
          </div>
        </section>
      )}

      <form className="trips-content incident-content" onSubmit={handleSubmit} noValidate>
        <article className="incident-form-card incident-record-card">
          <p className="detail-section-label">REGISTRO VINCULADO</p>
          <div className="incident-info-row"><span>Viagem</span><strong>#{trip.id}</strong></div>
          <div className="incident-info-row"><span>Veículo</span><strong>{trip.vehicle} · {trip.plate}</strong></div>
          <div className="incident-info-row"><span>Data</span><strong>{dateText}</strong></div>
          <div className="incident-info-row"><span>Horário</span><strong>{timeText}</strong></div>
          <p className="incident-info-notice"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg><span>A ocorrência fica vinculada à viagem, ao veículo, ao motorista e ao horário do registro.</span></p>
        </article>

        <article className="incident-form-card incident-description-card">
          <label htmlFor="incident-description">Descrição da ocorrência</label>
          <textarea id="incident-description" className={submitAttempted && !description.trim() ? "has-error" : ""} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva o problema identificado no veículo." aria-invalid={submitAttempted && !description.trim()} />
          <p className={`incident-required-note ${submitAttempted && !description.trim() ? "has-error" : ""}`}>{submitAttempted && !description.trim() ? "Informe a descrição da ocorrência." : "Campo obrigatório."}</p>
        </article>

        <article className="incident-form-card incident-photo-card">
          <label>Adicionar foto (opcional)</label>
          <div className="incident-photo-box">
            {photoPreview ? (
              <>
                <img className="incident-photo-preview" src={photoPreview} alt="Foto anexada à ocorrência" />
                <div className="incident-photo-actions">
                  <span className="incident-photo-registered-badge"><CheckIcon />Foto registrada</span>
                  <button className="incident-retake-button" type="button" onClick={() => setCaptureOpen(true)}><span aria-hidden="true">↻</span>Tirar novamente</button>
                </div>
              </>
            ) : (
              <>
                <span className="incident-camera-placeholder"><CameraIcon /></span>
                <p className="incident-photo-copy">Se possível, fotografe o problema identificado no veículo.</p>
                <button className="incident-camera-button" type="button" onClick={() => setCaptureOpen(true)}><CameraIcon />Tirar foto do painel</button>
                <button className="incident-file-button" type="button" onClick={() => fileInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={cameraInputRef} className="incident-hidden-input" type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} aria-label="Tirar foto da ocorrência" />
            <input ref={fileInputRef} className="incident-hidden-input" type="file" accept="image/*" onChange={handlePhotoChange} aria-label="Escolher foto da ocorrência" />
          </div>
        </article>

        <div className="incident-lock-note">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          <span>A ocorrência será enviada ao responsável da operação junto com a viagem e o veículo.</span>
        </div>
      </form>
      <footer className="incident-footer">
        <button className="incident-submit-button" type="button" onClick={(event) => event.currentTarget.closest(".incident-registration-page")?.querySelector("form")?.requestSubmit()}><IncidentIcon />Registrar ocorrência</button>
      </footer>
    </main>
  );
}

const FUEL_RECEIPT_DEMO_IMAGE = "data:image/png;base64,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";

function FuelRegistrationScreen({
  trip,
  onBack,
  onSubmit,
  showMissingErrors = false,
}: {
  trip: TripListItem;
  onBack: () => void;
  onSubmit: () => void;
  showMissingErrors?: boolean;
}) {
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [currentOdometer, setCurrentOdometer] = useState("");
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [demoOdometerPhoto, setDemoOdometerPhoto] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(showMissingErrors);
  const [registeredAt] = useState(() => new Date());

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setReceiptPreview(URL.createObjectURL(file));
    setDemoOdometerPhoto(false);
  }

  function handleDemoCapture() {
    setCaptureOpen(true);
  }

  function handleCapturePhoto() {
    setReceiptPreview(null);
    setDemoOdometerPhoto(true);
    setCaptureOpen(false);
  }

  function parseAmount(value: string) {
    return Number(value.trim().replace(/\./g, "").replace(",", "."));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const km = parseAmount(currentOdometer);
    const liters = parseAmount(quantity);
    const amount = parseAmount(total);
    setSubmitAttempted(true);
    const photoMissing = !demoOdometerPhoto && !receiptPreview;
    if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(liters) || liters <= 0 || !Number.isFinite(amount) || amount <= 0 || photoMissing) return;
    onSubmit();
  }

  const dateText = registeredAt.toLocaleDateString("pt-BR");
  const timeText = registeredAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="trips-page fuel-registration-page">
      <style>{`
        .fuel-registration-page { overflow: hidden; }
        .fuel-registration-page .fuel-header { flex: 0 0 99px; min-height: 99px; padding: 12px 15px 16px; }
        .fuel-registration-page .fuel-header h1 { margin: 0; font-size: 19px; }
        .fuel-registration-page .fuel-back { margin-bottom: 13px; }
        .fuel-registration-page .fuel-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; gap: 16px; padding: 16px 14px 20px; }
        .fuel-form-card { flex: 0 0 auto; padding: 16px; border: 1px solid #d5dfeb; border-radius: 9px; background: #fff; }
        .fuel-form-card .detail-section-label { margin: 0 0 12px; }
        .fuel-lock-note { display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; padding: 11px; border-radius: 7px; background: #edf2f6; color: #58718e; font-size: 12px; line-height: 1.45; }
        .fuel-lock-note svg, .fuel-time-note svg { width: 16px; height: 16px; flex: 0 0 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .fuel-lock-note svg { color: #075ce5; }
        .fuel-info-row { min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #dfe5ed; color: #58718e; font-size: 13px; }
        .fuel-info-row:last-of-type { border-bottom: 1px solid #dfe5ed; }
        .fuel-info-row strong { color: #17243a; font-size: 13px; font-weight: 400; }
        .fuel-time-note { display: flex; align-items: center; gap: 6px; margin: 10px 0 0; color: #58718e; font-size: 11px; }
        .fuel-field { margin-top: 17px; }
        .fuel-field:first-of-type { margin-top: 0; }
        .fuel-field label { display: block; margin: 0 0 7px; color: #17243a; font-size: 13px; }
        .fuel-input-wrap { position: relative; }
        .fuel-input-wrap input { width: 100%; height: 49px; padding: 0 43px 0 13px; border: 1px solid #cdd8e5; border-radius: 8px; outline: 0; background: #fff; color: #17243a; font-size: 14px; }
        .fuel-input-wrap input:focus { border-color: #1760e8; box-shadow: 0 0 0 3px rgba(23, 96, 232, .12); }
        .fuel-field.has-error .fuel-input-wrap input { border-color: #ff3434; }
        .fuel-field.has-error .fuel-input-wrap input:focus { border-color: #ff3434; box-shadow: 0 0 0 2px rgba(255, 52, 52, .12); }
        .fuel-field-error { margin: 8px 0 0; color: #ff3434; font-size: 12px; line-height: 1.35; }
        .fuel-input-wrap input::placeholder { color: #647b98; }
        .fuel-unit { position: absolute; top: 50%; right: 13px; transform: translateY(-50%); color: #58718e; font-size: 12px; pointer-events: none; }
        .fuel-helper { margin: 7px 0 0; color: #58718e; font-size: 11px; line-height: 1.4; }
        .fuel-receipt-card { padding: 11px 16px 16px; }
        .fuel-receipt-card > label { display: block; margin: 0 0 8px; color: #17243a; font-size: 13px; }
        .fuel-receipt-box { display: flex; flex-direction: column; align-items: center; padding: 16px; border: 1px dashed #cdd8e5; border-radius: 8px; text-align: center; }
        .fuel-receipt-box.has-error { border-color: #ff3434; }
        .fuel-photo-error { width: 100%; margin: 9px 0 0; color: #ff3434; text-align: left; font-size: 12px; line-height: 1.4; }
        .fuel-receipt-preview { width: 100%; max-height: 170px; margin-bottom: 12px; border-radius: 7px; object-fit: contain; background: #edf2f6; }
        .fuel-odometer-photo-preview { width: 100%; overflow: hidden; margin-bottom: 12px; border: 1px solid #d5dfeb; border-radius: 7px; background: #fff; }
        .fuel-odometer-photo-preview .odometer-demo-image, .fuel-odometer-photo-preview img { display: block; width: 100%; aspect-ratio: 300 / 158; object-fit: cover; }
        .fuel-photo-controls { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .fuel-photo-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid #a7d9bf; border-radius: 999px; background: #eff8f2; color: #078548; font-size: 12px; white-space: nowrap; }
        .fuel-photo-badge svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; }
        .fuel-retake-photo { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 11px; border: 1px solid #d1dce8; border-radius: 7px; background: #fff; color: #17243a; font-size: 12px; cursor: pointer; }
        .fuel-camera-placeholder { width: 48px; height: 48px; display: grid; place-items: center; margin-bottom: 12px; border-radius: 50%; background: #edf2f6; color: #647b98; }
        .fuel-camera-placeholder svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .fuel-receipt-copy { max-width: 250px; margin: 0 0 11px; color: #58718e; font-size: 13px; line-height: 1.5; }
        .fuel-take-photo { width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 8px; background: #125be5; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .fuel-take-photo:hover { background: #0d4fcf; }
        .fuel-take-photo svg, .fuel-file-button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .fuel-file-button { min-height: 45px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; background: transparent; color: #58718e; font-size: 13px; cursor: pointer; }
        .fuel-register-footer { flex: 0 0 auto; padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #d5dfeb; background: #f7f8fa; }
        .fuel-register-button { width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 8px; background: #125be5; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .fuel-register-button:hover { background: #0d4fcf; }
        .fuel-register-button svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .fuel-hidden-input { display: none; }
        .fuel-capture-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; min-height: 100dvh; padding: 16px 12px; background: rgba(15, 29, 48, .76); color: #f7f9fc; }
        .fuel-capture-card { display: flex; flex-direction: column; width: min(100%, 390px); max-height: calc(100dvh - 32px); padding: 10px 12px 14px; overflow-y: auto; border-radius: 15px; background: #182536; box-shadow: 0 18px 44px rgba(0, 0, 0, .28); }
        .fuel-capture-header { display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; min-height: 32px; margin-bottom: 4px; font-size: 14px; font-weight: 500; }
        .fuel-capture-close { display: grid; width: 32px; height: 32px; place-items: center; padding: 0; border: 0; background: transparent; color: #e6ebf2; font-size: 27px; line-height: 1; cursor: pointer; }
        .fuel-capture-viewfinder { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: clamp(200px, 31vh, 268px); border: 2px dashed #7f8996; border-radius: 8px; background: #303c4c; text-align: center; }
        .fuel-capture-viewfinder > svg { width: 34px; height: 34px; margin: auto 0 10px; fill: none; stroke: #d6dde6; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .fuel-capture-label { position: absolute; top: 13px; left: 12px; color: #c6d4e6; font-size: 11px; }
        .fuel-capture-instruction { max-width: 290px; margin: 0 auto auto; padding: 0 12px; color: #e1e9f3; font-size: 14px; line-height: 1.5; }
        .fuel-capture-action { display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; gap: 10px; padding-top: 24px; color: #e1e9f3; font-size: 12px; }
        .fuel-capture-button { display: grid; width: 64px; height: 64px; place-items: center; border: 0; border-radius: 50%; background: #f5f6f8; color: #182536; cursor: pointer; transition: transform .16s ease, background .16s ease; }
        .fuel-capture-button:hover { transform: scale(1.05); background: #fff; }
        .fuel-capture-button svg { width: 27px; height: 27px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        @media (max-width: 480px) { .fuel-registration-page .fuel-content { padding-right: 14px; padding-left: 14px; } }
      `}</style>
      <header className="trips-header details-header back-header-animated fuel-header">
        <button className="details-back fuel-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button>
        <h1>Registrar abastecimento</h1>
      </header>

      {captureOpen && (
        <section className="fuel-capture-overlay" role="dialog" aria-modal="true" aria-label="Captura da foto do odômetro">
          <div className="fuel-capture-card">
            <header className="fuel-capture-header">
              <span>Foto do odômetro</span>
              <button className="fuel-capture-close" type="button" aria-label="Fechar captura" onClick={() => setCaptureOpen(false)}>×</button>
            </header>
            <div className="fuel-capture-viewfinder">
              <span className="fuel-capture-label">câmera simulada</span>
              <CameraIcon />
              <p className="fuel-capture-instruction">Aponte para o painel do veículo e enquadre o odômetro.</p>
            </div>
            <div className="fuel-capture-action">
              <button className="fuel-capture-button" type="button" aria-label="Toque para capturar a foto" onClick={handleCapturePhoto}><CameraIcon /></button>
              <span>Toque para capturar a foto</span>
            </div>
          </div>
        </section>
      )}

      <form className="trips-content fuel-content" onSubmit={handleSubmit}>
        <article className="fuel-form-card">
          <p className="detail-section-label">REGISTRO VINCULADO</p>
          <div className="fuel-info-row"><span>Viagem</span><strong>#{trip.id}</strong></div>
          <div className="fuel-info-row"><span>Veículo</span><strong>{trip.vehicle} · {trip.plate}</strong></div>
          <div className="fuel-lock-note">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <span>O abastecimento fica vinculado a esta viagem e a este veículo. Não é possível trocar o veículo.</span>
          </div>
        </article>

        <article className="fuel-form-card">
          <p className="detail-section-label">DATA E HORA</p>
          <div className="fuel-info-row"><span>Data</span><strong>{dateText}</strong></div>
          <div className="fuel-info-row"><span>Horário</span><strong>{timeText}</strong></div>
          <p className="fuel-time-note"><CalendarIcon /> Preenchidos automaticamente pelo sistema.</p>
        </article>

        <article className="fuel-form-card">
          <p className="detail-section-label">DADOS DO ABASTECIMENTO</p>
          <div className={`fuel-field ${submitAttempted && (!Number.isFinite(parseAmount(currentOdometer)) || parseAmount(currentOdometer) <= 0) ? "has-error" : ""}`}>
            <label htmlFor="fuel-odometer">Quilometragem atual</label>
            <div className="fuel-input-wrap"><input id="fuel-odometer" inputMode="numeric" value={currentOdometer} onChange={(event) => setCurrentOdometer(event.target.value)} placeholder="Ex.: 48262" aria-label="Quilometragem atual" aria-invalid={submitAttempted && (!Number.isFinite(parseAmount(currentOdometer)) || parseAmount(currentOdometer) <= 0)} aria-describedby={submitAttempted && (!Number.isFinite(parseAmount(currentOdometer)) || parseAmount(currentOdometer) <= 0) ? "fuel-odometer-error" : undefined}/><span className="fuel-unit">km</span></div>
            {submitAttempted && (!Number.isFinite(parseAmount(currentOdometer)) || parseAmount(currentOdometer) <= 0) && <p className="fuel-field-error" id="fuel-odometer-error">Informe a quilometragem atual.</p>}
          </div>
          <div className={`fuel-field ${submitAttempted && (!Number.isFinite(parseAmount(quantity)) || parseAmount(quantity) <= 0) ? "has-error" : ""}`}>
            <label htmlFor="fuel-quantity">Quantidade abastecida</label>
            <div className="fuel-input-wrap"><input id="fuel-quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Ex.: 32,5" aria-label="Quantidade abastecida" aria-invalid={submitAttempted && (!Number.isFinite(parseAmount(quantity)) || parseAmount(quantity) <= 0)} aria-describedby={submitAttempted && (!Number.isFinite(parseAmount(quantity)) || parseAmount(quantity) <= 0) ? "fuel-quantity-error" : undefined}/><span className="fuel-unit">L</span></div>
            {submitAttempted && (!Number.isFinite(parseAmount(quantity)) || parseAmount(quantity) <= 0) ? <p className="fuel-field-error" id="fuel-quantity-error">Informe a quantidade abastecida.</p> : <p className="fuel-helper">Somente valores maiores que zero.</p>}
          </div>
          <div className={`fuel-field ${submitAttempted && (!Number.isFinite(parseAmount(total)) || parseAmount(total) <= 0) ? "has-error" : ""}`}>
            <label htmlFor="fuel-total">Valor total (R$)</label>
            <div className="fuel-input-wrap"><input id="fuel-total" inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} placeholder="Ex.: 214,50" aria-label="Valor total em reais" aria-invalid={submitAttempted && (!Number.isFinite(parseAmount(total)) || parseAmount(total) <= 0)} aria-describedby={submitAttempted && (!Number.isFinite(parseAmount(total)) || parseAmount(total) <= 0) ? "fuel-total-error" : undefined}/></div>
            {submitAttempted && (!Number.isFinite(parseAmount(total)) || parseAmount(total) <= 0) ? <p className="fuel-field-error" id="fuel-total-error">Informe o valor total.</p> : <p className="fuel-helper">Use vírgula para os centavos.</p>}
          </div>
        </article>

        <article className="fuel-form-card fuel-receipt-card">
          <label>Foto do odômetro</label>
          <div className={`fuel-receipt-box ${submitAttempted && !demoOdometerPhoto && !receiptPreview ? "has-error" : ""}`}>
            {(demoOdometerPhoto || receiptPreview) ? (
              <>
                <div className="fuel-odometer-photo-preview">
                  {demoOdometerPhoto ? <img className="odometer-demo-image" src={FUEL_RECEIPT_DEMO_IMAGE} alt="Comprovante de abastecimento demonstrativo com odômetro zerado" /> : <img src={receiptPreview ?? ""} alt="Foto registrada do odômetro" />}
                </div>
                <div className="fuel-photo-controls">
                  <span className="fuel-photo-badge"><CheckIcon />Foto registrada</span>
                  <button className="fuel-retake-photo" type="button" onClick={() => { setDemoOdometerPhoto(false); setReceiptPreview(null); handleDemoCapture(); }}><span aria-hidden="true">↻</span>Tirar novamente</button>
                </div>
              </>
            ) : (
              <>
                <span className="fuel-camera-placeholder"><CameraIcon /></span>
                <p className="fuel-receipt-copy">Registre uma foto do odômetro atual do veículo.</p>
                <button className="fuel-take-photo" type="button" onClick={handleDemoCapture}><CameraIcon />Tirar foto do painel</button>
                <button className="fuel-file-button" type="button" onClick={() => receiptInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={receiptInputRef} className="fuel-hidden-input" type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} aria-label="Tirar foto ou selecionar imagem do odômetro"/>
            {submitAttempted && !demoOdometerPhoto && !receiptPreview && <p className="fuel-photo-error" role="alert">Envie uma foto do odômetro para registrar o abastecimento.</p>}
          </div>
        </article>
        <div aria-hidden="true" style={{ height: 2, flex: "0 0 2px" }} />
      </form>
      <footer className="fuel-register-footer">
        <button className="fuel-register-button" type="button" onClick={(event) => {
          const form = event.currentTarget.closest(".fuel-registration-page")?.querySelector("form");
          form?.requestSubmit();
        }}><FuelIcon />Registrar abastecimento</button>
      </footer>
    </main>
  );
}

function TripPlaceholderScreen({ title, onBack, onHome, onTrips, onNotifications, onProfile }: { title: string; onBack: () => void; onHome: () => void; onTrips: () => void; onNotifications: () => void; onProfile: () => void }) {
  return (
    <main className="trips-page trip-details-page">
      <header className="trips-header details-header back-header-animated">
        <button className="details-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button>
        <h1>{title}</h1>
      </header>
      <section className="trips-content details-content">
        <article className="detail-card">
          <p className="detail-section-label">#TRP-1022</p>
          <p>Esta tela será definida em uma próxima etapa.</p>
        </article>
      </section>
      <BottomNavigation active="none" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={onProfile} />
    </main>
  );
}


const DEMO_ODOMETER_IMAGE = "data:image/jpeg;base64,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";


function OdometerDemoImage() {
  return (
    <img
      className="odometer-demo-image"
      src={DEMO_ODOMETER_IMAGE}
      alt="Painel de veículo com odômetro inicial marcando 000067 quilômetros"
    />
  );
}


function FinishTripScreen({
  trip,
  onBack,
  onConfirm,
  initialOdometer,
  startedAt,
}: {
  trip: TripListItem;
  onBack: () => void;
  onConfirm: (finalOdometer: string, photo: string) => void;
  initialOdometer: string | null;
  startedAt: Date | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [finalOdometer, setFinalOdometer] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [demoPhoto, setDemoPhoto] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const initialKm = Number(initialOdometer ?? 0);
  const parsedFinalKm = Number(finalOdometer.trim().replace(",", "."));
  const kmEntered = finalOdometer.trim() !== "" && Number.isFinite(parsedFinalKm);
  const kmNotLower = kmEntered && parsedFinalKm >= initialKm;
  const photoRegistered = demoPhoto || photoPreview !== null;
  const canConfirm = kmEntered && kmNotLower && photoRegistered;
  const distance = kmNotLower ? parsedFinalKm - initialKm : null;
  const startTime = startedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—";

  function handleCapture() {
    setPhotoPreview(null);
    setDemoPhoto(true);
    setCaptureOpen(false);
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.currentTarget.files?.[0];
    if (!selectedPhoto || !selectedPhoto.type.startsWith("image/")) {
      event.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoPreview(reader.result);
        setDemoPhoto(false);
      }
    };
    reader.readAsDataURL(selectedPhoto);
    event.currentTarget.value = "";
  }

  return (
    <main className="trips-page finish-trip-page">
      <style>{`
        .finish-trip-page { overflow: hidden; }
        .finish-trip-page .finish-header { flex: 0 0 98px; min-height: 98px; padding: 10px 12px 13px; }
        .finish-trip-page .finish-header h1 { margin: 0; font-size: 19px; }
        .finish-trip-page .finish-back { margin-bottom: 10px; }
        .finish-trip-content { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; gap: 15px; padding: 16px 12px 18px; }
        .finish-trip-card { flex: 0 0 auto; padding: 15px 16px; border: 1px solid #d5dfeb; border-radius: 9px; background: #fff; }
        .finish-trip-summary-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 15px; }
        .finish-trip-summary-head strong { color: #17243a; font-size: 16px; }
        .finish-trip-vehicle { display: inline-flex; align-items: center; gap: 6px; color: #58718e; font-size: 12px; white-space: nowrap; }
        .finish-trip-vehicle svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        .finish-trip-info-row { min-height: 41px; display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid #dfe5ed; color: #58718e; font-size: 13px; }
        .finish-trip-info-row:last-child { border-bottom: 0; }
        .finish-trip-info-row strong { color: #17243a; font-size: 13px; font-weight: 400; }
        .finish-trip-tip { display: flex; align-items: flex-start; gap: 8px; flex: 0 0 auto; padding: 12px; border: 1px solid #a9c5ff; border-radius: 8px; background: #eaf0fa; color: #17243a; font-size: 13px; line-height: 1.5; }
        .finish-trip-tip svg { width: 17px; height: 17px; flex: 0 0 17px; fill: none; stroke: #075ce5; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .finish-trip-card .detail-section-label { margin: 0 0 10px; }
        .finish-km-label, .finish-photo-title, .finish-note-label { display: block; margin: 0 0 7px; color: #17243a; font-size: 13px; }
        .finish-km-wrap { position: relative; }
        .finish-km-wrap input { width: 100%; height: 49px; padding: 0 42px 0 12px; border: 1px solid #cdd8e5; border-radius: 8px; outline: 0; color: #17243a; background: #fff; font-size: 14px; }
        .finish-km-wrap input:focus { border-color: #1760e8; box-shadow: 0 0 0 3px rgba(23,96,232,.12); }
        .finish-km-wrap input::placeholder, .finish-note-input::placeholder { color: #647b98; }
        .finish-km-unit { position: absolute; top: 50%; right: 13px; transform: translateY(-50%); color: #58718e; font-size: 12px; pointer-events: none; }
        .finish-distance { min-height: 41px; display: flex; align-items: center; justify-content: space-between; margin-top: 12px; padding: 0 12px; border-radius: 7px; background: #edf2f6; color: #58718e; font-size: 12px; }
        .finish-distance strong { color: #075ce5; font-weight: 600; }
        .finish-helper { margin: 8px 0 0; color: #58718e; font-size: 11px; line-height: 1.4; }
        .finish-photo-box { display: flex; flex-direction: column; align-items: center; padding: 15px; border: 1px dashed #cdd8e5; border-radius: 8px; text-align: center; }
        .finish-camera-placeholder { width: 48px; height: 48px; display: grid; place-items: center; margin-bottom: 12px; border-radius: 50%; background: #edf2f6; color: #647b98; }
        .finish-camera-placeholder svg { width: 23px; height: 23px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .finish-photo-copy { max-width: 280px; margin: 0 0 11px; color: #58718e; font-size: 13px; line-height: 1.5; }
        .finish-take-photo { width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 9px; border: 0; border-radius: 8px; background: #125be5; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .finish-take-photo:hover { background: #0d4fcf; }
        .finish-take-photo svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .finish-file-button { min-height: 42px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; background: transparent; color: #58718e; font-size: 13px; cursor: pointer; }
        .finish-file-button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; }
        .finish-photo-preview { width: 100%; overflow: hidden; margin-bottom: 12px; border: 1px solid #d5dfeb; border-radius: 7px; background: #fff; }
        .finish-photo-preview img { display: block; width: 100%; aspect-ratio: 300 / 158; object-fit: cover; }
        .finish-photo-controls { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .finish-photo-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border: 1px solid #a7d9bf; border-radius: 999px; background: #eff8f2; color: #078548; font-size: 12px; white-space: nowrap; }
        .finish-photo-badge svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; }
        .finish-retake-button { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; border: 1px solid #d1dce8; border-radius: 7px; background: #fff; color: #17243a; font-size: 12px; cursor: pointer; }
        .finish-note-input { width: 100%; min-height: 94px; resize: vertical; padding: 11px 12px; border: 1px solid #cdd8e5; border-radius: 8px; outline: 0; color: #17243a; font: inherit; font-size: 14px; line-height: 1.5; }
        .finish-note-input:focus { border-color: #1760e8; box-shadow: 0 0 0 3px rgba(23,96,232,.12); }
        .finish-validation { display: grid; gap: 9px; flex: 0 0 auto; padding: 12px; border: 1px solid #d5dfeb; border-radius: 8px; background: #fff; }
        .finish-validation p { display: flex; align-items: flex-start; gap: 8px; margin: 0; color: #f03d37; font-size: 12px; line-height: 1.4; }
        .finish-validation p.is-valid { color: #078548; }
        .finish-validation svg { width: 15px; height: 15px; flex: 0 0 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        .finish-footer { flex: 0 0 auto; padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px)); background: #f7f8fa; }
        .finish-confirm-button { width: 100%; min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 0; border-radius: 8px; background: #125be5; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; }
        .finish-confirm-button:disabled { background: #80a8eb; cursor: not-allowed; }
        .finish-confirm-button svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; }
        .finish-footer p { margin: 9px 0 0; color: #58718e; text-align: center; font-size: 10px; line-height: 1.4; }
        .finish-hidden-input { display: none; }
        .finish-capture-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; min-height: 100dvh; padding: 16px 12px; background: rgba(15,29,48,.76); color: #f7f9fc; }
        .finish-capture-card { display: flex; flex-direction: column; width: min(100%,390px); max-height: calc(100dvh - 32px); padding: 10px 12px 14px; overflow-y: auto; border-radius: 15px; background: #182536; box-shadow: 0 18px 44px rgba(0,0,0,.28); }
        .finish-capture-head { display: flex; align-items: center; justify-content: space-between; min-height: 32px; margin-bottom: 4px; font-size: 14px; }
        .finish-capture-close { width: 32px; height: 32px; border: 0; background: transparent; color: #e6ebf2; font-size: 26px; cursor: pointer; }
        .finish-capture-viewfinder { position: relative; display: flex; flex: 0 0 auto; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: clamp(200px,31vh,268px); border: 2px dashed #7f8996; border-radius: 8px; background: #303c4c; text-align: center; }
        .finish-capture-viewfinder > svg { width: 34px; height: 34px; margin: auto 0 10px; fill: none; stroke: #d6dde6; stroke-width: 1.8; }
        .finish-capture-label { position: absolute; top: 13px; left: 12px; color: #c6d4e6; font-size: 11px; }
        .finish-capture-instruction { max-width: 290px; margin: 0 auto auto; padding: 0 12px; color: #e1e9f3; font-size: 14px; line-height: 1.5; }
        .finish-capture-action { display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 24px; color: #e1e9f3; font-size: 12px; }
        .finish-capture-button { display: grid; width: 64px; height: 64px; place-items: center; border: 0; border-radius: 50%; background: #f5f6f8; color: #182536; cursor: pointer; }
        .finish-capture-button svg { width: 27px; height: 27px; fill: none; stroke: currentColor; stroke-width: 2; }
        @media (max-width: 480px) { .finish-trip-content { padding-right: 12px; padding-left: 12px; } }
      `}</style>
      <header className="trips-header details-header back-header-animated finish-header">
        <button className="details-back finish-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button>
        <h1>Finalizar viagem</h1>
      </header>

      {captureOpen && (
        <section className="finish-capture-overlay" role="dialog" aria-modal="true" aria-label="Captura da foto final do odômetro">
          <div className="finish-capture-card">
            <header className="finish-capture-head"><span>Foto final do odômetro</span><button className="finish-capture-close" type="button" aria-label="Fechar captura" onClick={() => setCaptureOpen(false)}>×</button></header>
            <div className="finish-capture-viewfinder"><span className="finish-capture-label">câmera simulada</span><CameraIcon /><p className="finish-capture-instruction">Aponte para o painel do veículo e enquadre o odômetro final.</p></div>
            <div className="finish-capture-action"><button className="finish-capture-button" type="button" aria-label="Capturar foto" onClick={handleCapture}><CameraIcon /></button><span>Toque para capturar a foto</span></div>
          </div>
        </section>
      )}

      <section className="trips-content finish-trip-content">
        <article className="finish-trip-card">
          <div className="finish-trip-summary-head"><strong>#{trip.id}</strong><span className="finish-trip-vehicle"><TruckIcon /> {trip.vehicle} · {trip.plate}</span></div>
          <div className="finish-trip-info-row"><span>KM inicial</span><strong>{initialOdometer ?? "—"} km</strong></div>
          <div className="finish-trip-info-row"><span>Horário de início</span><strong>{startTime}</strong></div>
        </article>

        <div className="finish-trip-tip"><CameraIcon /><span>Para concluir, registre a quilometragem atual e uma nova foto do odômetro.</span></div>

        <article className="finish-trip-card">
          <p className="detail-section-label">QUILOMETRAGEM</p>
          <label className="finish-km-label" htmlFor="final-odometer">Quilometragem final</label>
          <div className="finish-km-wrap"><input id="final-odometer" type="number" min={initialKm} inputMode="numeric" placeholder="Ex.: 48278" value={finalOdometer} onChange={(event) => setFinalOdometer(event.target.value)} aria-label="Quilometragem final" /><span className="finish-km-unit">km</span></div>
          <div className="finish-distance"><span>Distância percorrida</span><strong>{distance === null ? "—" : `${distance} km`}</strong></div>
          <p className="finish-helper">Calculada automaticamente: KM final menos KM inicial.</p>
        </article>

        <article className="finish-trip-card">
          <p className="detail-section-label">ODÔMETRO</p>
          <label className="finish-photo-title">Foto final do odômetro</label>
          <div className="finish-photo-box">
            {photoRegistered ? (
              <>
                <div className="finish-photo-preview"><img src={demoPhoto ? DEMO_ODOMETER_IMAGE : photoPreview ?? ""} alt="Foto final do odômetro registrada" /></div>
                <div className="finish-photo-controls"><span className="finish-photo-badge"><CheckIcon />Foto registrada</span><button className="finish-retake-button" type="button" onClick={() => setCaptureOpen(true)}><span aria-hidden="true">↻</span>Tirar novamente</button></div>
              </>
            ) : (
              <>
                <span className="finish-camera-placeholder"><CameraIcon /></span>
                <p className="finish-photo-copy">Registre a nova foto do painel para concluir a viagem.</p>
                <button className="finish-take-photo" type="button" onClick={() => setCaptureOpen(true)}><CameraIcon />Tirar foto do painel</button>
                <button className="finish-file-button" type="button" onClick={() => fileInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={fileInputRef} className="finish-hidden-input" type="file" accept="image/*" onChange={handlePhotoChange} aria-label="Escolher foto final do odômetro" />
          </div>
        </article>

        <article className="finish-trip-card">
          <label className="finish-note-label" htmlFor="finish-note">OBSERVAÇÃO FINAL (OPCIONAL)</label>
          <textarea id="finish-note" className="finish-note-input" placeholder="Ex.: Sem intercorrências no trajeto." />
        </article>

        <div className="finish-validation" aria-live="polite">
          <p className={kmEntered ? "is-valid" : ""}>{kmEntered ? <CheckIcon /> : <AlertIcon />}<span>{kmEntered ? "Quilometragem final informada." : "Informe a quilometragem final."}</span></p>
          <p className={kmNotLower ? "is-valid" : ""}>{kmNotLower ? <CheckIcon /> : <AlertIcon />}<span>{kmNotLower ? "Quilometragem final válida." : `A quilometragem final não pode ser menor que a quilometragem inicial de ${initialKm} km.`}</span></p>
          <p className={photoRegistered ? "is-valid" : ""}>{photoRegistered ? <CheckIcon /> : <AlertIcon />}<span>{photoRegistered ? "Foto final do odômetro registrada." : "Registre uma foto final do odômetro."}</span></p>
        </div>
      </section>

      <footer className="finish-footer">
        <button className="finish-confirm-button" type="button" disabled={!canConfirm} onClick={() => onConfirm(finalOdometer, demoPhoto ? DEMO_ODOMETER_IMAGE : photoPreview ?? "")}><CheckIcon />CONFIRMAR FINALIZAÇÃO</button>
        <p>O horário de conclusão é registrado automaticamente.</p>
      </footer>
    </main>
  );
}

function StartTripScreen({ trip, onBack, onConfirm }: { trip: TripListItem; onBack: () => void; onConfirm: (odometer: string, photo: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [odometer, setOdometer] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [demoPhoto, setDemoPhoto] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const hasValidOdometer =
    odometer.trim() !== "" &&
    Number.isFinite(Number(odometer)) &&
    Number(odometer) >= 0;
  const photoRegistered = demoPhoto || photoPreview !== null;
  const canConfirm = hasValidOdometer && photoRegistered;


  function handleDemoCapture() {
    // Abre primeiro a tela simulada de captura; a imagem só aparece ao capturar.
    setCaptureOpen(true);
  }


  function handleCapturePhoto() {
    setPhotoPreview(null);
    setPhotoName("Foto de demonstração");
    setDemoPhoto(true);
    setCaptureOpen(false);
  }


  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.target.files?.[0];
    if (!selectedPhoto) return;
    if (!selectedPhoto.type.startsWith("image/")) {
      event.currentTarget.value = "";
      return;
    }


    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPhotoPreview(reader.result);
        setPhotoName(selectedPhoto.name);
        setDemoPhoto(false);
      }
    };
    reader.readAsDataURL(selectedPhoto);
  }


  function handleConfirmStart() {
    if (!canConfirm) return;
    onConfirm(odometer, demoPhoto ? DEMO_ODOMETER_IMAGE : photoPreview ?? "");
  }


  return (
    <main className="trips-page start-trip-page">
      <style>{`
        .start-trip-page {
          --start-safe-bottom: env(safe-area-inset-bottom, 0px);
        }
        .start-trip-page > .bottom-navigation { display: none !important; }
        .odometer-capture-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100dvh;
          padding: 16px 12px;
          background: rgba(15, 29, 48, .76);
          color: #f7f9fc;
        }
        .odometer-capture-card {
          display: flex;
          flex-direction: column;
          width: min(100%, 390px);
          max-height: calc(100dvh - 32px);
          padding: 10px 12px 14px;
          overflow-y: auto;
          border-radius: 15px;
          background: #182536;
          box-shadow: 0 18px 44px rgba(0, 0, 0, .28);
        }
        .odometer-capture-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
          min-height: 32px;
          margin-bottom: 4px;
          font-size: 14px;
          font-weight: 500;
        }
        .odometer-capture-close {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          padding: 0;
          border: 0;
          background: transparent;
          color: #e6ebf2;
          font-size: 27px;
          line-height: 1;
          cursor: pointer;
        }
        .odometer-capture-viewfinder {
          position: relative;
          display: flex;
          flex: 0 0 auto;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: clamp(200px, 31vh, 268px);
          min-height: 0;
          border: 2px dashed #7f8996;
          border-radius: 8px;
          background: #303c4c;
          text-align: center;
        }
        .odometer-capture-simulation-label {
          position: absolute;
          top: 13px;
          left: 12px;
          color: #c6d4e6;
          font-size: 11px;
        }
        .odometer-capture-viewfinder > svg {
          width: 34px;
          height: 34px;
          margin: auto 0 10px;
          fill: none;
          stroke: #d6dde6;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .odometer-capture-instruction {
          max-width: 290px;
          margin: 0 auto auto;
          padding: 0 12px;
          color: #e1e9f3;
          font-size: 14px;
          line-height: 1.5;
        }
        .odometer-capture-action {
          display: flex;
          flex: 0 0 auto;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding-top: 24px;
          color: #e1e9f3;
          font-size: 12px;
        }
        .odometer-capture-button {
          display: grid;
          width: 64px;
          height: 64px;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: #f5f6f8;
          color: #182536;
          cursor: pointer;
          transition: transform .16s ease, background .16s ease;
        }
        .odometer-capture-button:hover { transform: scale(1.05); background: #fff; }
        .odometer-capture-button svg {
          width: 27px;
          height: 27px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .start-trip-page .start-trip-content {
          flex: 1 1 0;
          min-height: 0;
          padding: 16px 14px 18px;
          overflow-x: hidden;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .start-trip-page .start-trip-bottom-area {
          position: static;
          z-index: auto;
          flex: 0 0 auto;
          max-height: none;
          overflow: visible;
          margin-top: 4px;
          padding: 12px 2px calc(12px + var(--start-safe-bottom));
          border-top: 1px solid #d5dfeb;
          background: #f7f8fa;
          box-shadow: none;
        }
        .start-trip-page .start-trip-warnings {
          position: static;
          display: grid;
          gap: 9px;
          margin: 0 0 12px;
          padding: 0;
          border: 0;
          background: transparent;
        }
        .start-trip-page .start-trip-warnings p {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 0;
          color: #e44444;
          font-size: 13px;
          line-height: 1.4;
        }
        .start-trip-page .start-trip-warnings p.is-complete { color: #56708f; }
        .start-trip-page .start-trip-warnings svg {
          width: 16px;
          height: 16px;
          flex: 0 0 16px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .start-trip-page .start-trip-warnings p.is-complete svg { color: #09945a; }
        .start-trip-page .start-trip-footer {
          position: static;
          margin: 0;
          padding: 0;
          border: 0;
          background: transparent;
          text-align: center;
        }
        .start-trip-page .confirm-start-button {
          width: 100%;
          min-height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 0;
          border-radius: 8px;
          background: #125be5;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }
        .start-trip-page .confirm-start-button:disabled {
          background: #80a8eb;
          cursor: not-allowed;
          opacity: 1;
        }
        .start-trip-page .confirm-start-button svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .start-trip-page .start-trip-footer > p {
          margin: 9px 0 0;
          color: #58718e;
          font-size: 10px;
          line-height: 1.4;
        }
        .start-trip-page .photo-upload-box { align-items: stretch; text-align: left; }
        .start-trip-page .photo-upload-box > .camera-placeholder,
        .start-trip-page .photo-upload-box > .photo-help { align-self: center; text-align: center; }
        .start-trip-page .odometer-photo-preview {
          width: 100%;
          overflow: hidden;
          border: 1px solid #d5dfeb;
          border-radius: 7px;
          background: #fff;
        }
        .start-trip-page .odometer-demo-image,
        .start-trip-page .odometer-photo-preview img {
          display: block;
          width: 100%;
          aspect-ratio: 300 / 158;
          object-fit: cover;
        }
        .start-trip-page .photo-registered-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 12px;
        }
        .start-trip-page .photo-registered-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border: 1px solid #a7d9bf;
          border-radius: 999px;
          background: #eff8f2;
          color: #078548;
          font-size: 12px;
          white-space: nowrap;
        }
        .start-trip-page .photo-registered-badge svg {
          width: 15px;
          height: 15px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
        }
        .start-trip-page .retake-photo-button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 11px;
          border: 1px solid #d1dce8;
          border-radius: 7px;
          background: #fff;
          color: #17243a;
          font-size: 12px;
          cursor: pointer;
        }
        .start-trip-page .retake-photo-button svg {
          width: 16px;
          height: 16px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.8;
        }
        .start-trip-page .camera-placeholder svg,
        .start-trip-page .odometer-info svg,
        .start-trip-page .take-photo-button svg,
        .start-trip-page .choose-file-button svg {
          fill: none !important;
          stroke: currentColor !important;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .start-trip-page .take-photo-button { min-height: 52px; }
        .start-trip-page .start-trip-success {
          position: static;
          margin: 0;
          padding: 14px;
          border: 1px solid #b7dfc5;
          border-radius: 9px;
          background: #effaf2;
          color: #237642;
          font-size: 14px;
        }
        @media (max-height: 700px) {
          .start-trip-page .start-trip-content { padding-bottom: 18px; }
          .start-trip-page .start-trip-bottom-area { padding-top: 8px; padding-bottom: calc(9px + var(--start-safe-bottom)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .start-trip-page .take-photo-button { transition: none; }
        }
      `}</style>


      <header className="trips-header details-header back-header-animated">
        <button className="details-back" type="button" onClick={onBack}>
          <span aria-hidden="true">‹</span> Voltar
        </button>
        <h1>Iniciar viagem</h1>
      </header>


      {captureOpen && (
        <section className="odometer-capture-overlay" role="dialog" aria-modal="true" aria-label="Captura da foto do odômetro">
          <div className="odometer-capture-card">
            <header className="odometer-capture-header">
              <span>Foto do odômetro</span>
              <button className="odometer-capture-close" type="button" aria-label="Fechar captura" onClick={() => setCaptureOpen(false)}>×</button>
            </header>
            <div className="odometer-capture-viewfinder">
            <span className="odometer-capture-simulation-label">câmera simulada</span>
            <CameraIcon />
            <p className="odometer-capture-instruction">Aponte para o painel do veículo e enquadre o odômetro.</p>
            </div>
            <div className="odometer-capture-action">
              <button className="odometer-capture-button" type="button" aria-label="Toque para capturar a foto" onClick={handleCapturePhoto}>
                <CameraIcon />
              </button>
              <span>Toque para capturar a foto</span>
            </div>
          </div>
        </section>
      )}


      <section className="trips-content start-trip-content">
        <article className="detail-card start-summary-card">
          <div className="start-summary-title">
            <strong>#{trip.id}</strong>
            <span><TruckIcon />{trip.vehicle} · {trip.plate}</span>
          </div>
          <div className="detail-row"><span>Origem</span><strong>{trip.origin}</strong></div>
          <div className="detail-row"><span>Destino</span><strong>{trip.destination}</strong></div>
        </article>


        <div className="odometer-info" role="note">
          <span aria-hidden="true"><CameraIcon /></span>
          <p>Antes de iniciar, registre a quilometragem atual e uma foto do odômetro do veículo.</p>
        </div>


        <article className="detail-card odometer-card">
          <p className="detail-section-label">QUILOMETRAGEM</p>
          <label htmlFor="starting-odometer">Quilometragem inicial</label>
          <div className="odometer-input-wrap">
            <input
              id="starting-odometer"
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="Ex.: 48250"
              value={odometer}
              onChange={(event) => setOdometer(event.target.value)}
            />
            <span>km</span>
          </div>
        </article>


        <article className="detail-card odometer-photo-card">
          <p className="detail-section-label">ODÔMETRO</p>
          <p className="photo-label">Foto do odômetro</p>
          <div className={`photo-upload-box ${photoRegistered ? "has-registered-photo" : ""}`}>
            {photoRegistered ? (
              <>
                <div className="odometer-photo-preview">
                  {demoPhoto ? (
                    <OdometerDemoImage />
                  ) : (
                    <img src={photoPreview ?? ""} alt="Foto registrada do odômetro" />
                  )}
                </div>
                <div className="photo-registered-controls">
                  <span className="photo-registered-badge"><CheckIcon />Foto registrada</span>
                  <button className="retake-photo-button" type="button" onClick={() => { setDemoPhoto(false); setPhotoPreview(null); setPhotoName(""); handleDemoCapture(); }}>
                    <span aria-hidden="true">↻</span>Tirar novamente
                  </button>
                </div>
                {photoName && !demoPhoto && <p className="photo-help">{photoName}</p>}
              </>
            ) : (
              <>
                <div className="camera-placeholder"><CameraIcon /></div>
                <p className="photo-help">A foto do painel é obrigatória para iniciar a viagem.</p>
                <button className="take-photo-button" type="button" onClick={handleDemoCapture}>
                  <CameraIcon /><span>Tirar foto do painel</span>
                </button>
                <input
                  ref={fileInputRef}
                  className="visually-hidden-input"
                  type="file"
                  accept="image/*"
                  aria-label="Escolher imagem do odômetro"
                  onChange={handlePhotoChange}
                />
                <button className="choose-file-button" type="button" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon /><span>Usar arquivo do dispositivo</span>
                </button>
              </>
            )}
          </div>
        </article>
      <div className="start-trip-bottom-area">
        <div className="start-trip-warnings" role="status" aria-live="polite" aria-label="Pendências para iniciar viagem">
              <p className={hasValidOdometer ? "is-complete" : ""}>
                {hasValidOdometer ? <CheckIcon /> : <AlertIcon />}
                <span>{hasValidOdometer ? "Quilometragem inicial informada" : "Informe a quilometragem inicial."}</span>
              </p>
              <p className={photoRegistered ? "is-complete" : ""}>
                {photoRegistered ? <CheckIcon /> : <AlertIcon />}
                <span>{photoRegistered ? "Foto do odômetro registrada" : "Registre uma foto do odômetro para iniciar a viagem."}</span>
              </p>
        </div>
        <div className="start-trip-footer">
          <button className="confirm-start-button" type="button" onClick={handleConfirmStart} disabled={!canConfirm} aria-disabled={!canConfirm}>
            <CheckIcon /><span>CONFIRMAR INÍCIO</span>
          </button>
          <p>O horário de saída é registrado automaticamente ao confirmar.</p>
        </div>
      </div>
            </section>




    </main>
  );
}


function CompletedTripScreen({
  trip,
  startedAt,
  finishedAt,
  initialOdometer,
  finalOdometer,
  initialPhoto,
  finalPhoto,
  hasFuelRegistration,
  hasIncidentRegistration,
  onHome,
  onTrips,
  onNotifications,
  onProfile,
}: {
  trip: TripListItem;
  startedAt: Date | null;
  finishedAt: Date | null;
  initialOdometer: string | null;
  finalOdometer: string | null;
  initialPhoto: string | null;
  finalPhoto: string | null;
  hasFuelRegistration: boolean;
  hasIncidentRegistration: boolean;
  onHome: () => void;
  onTrips: () => void;
  onNotifications: () => void;
  onProfile: () => void;
}) {
  const startTime = startedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const endTime = finishedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const initialKm = Number((initialOdometer ?? "0").trim().replace(",", "."));
  const finalKm = Number((finalOdometer ?? "0").trim().replace(",", "."));
  const distance = Number.isFinite(initialKm) && Number.isFinite(finalKm) ? Math.max(0, finalKm - initialKm) : 0;
  const initialEvidence = initialPhoto || DEMO_ODOMETER_IMAGE;
  const finalEvidence = finalPhoto || DEMO_ODOMETER_IMAGE;

  return (
    <main className="trips-page trip-details-page completed-trip-page">
      <style>{`
        .completed-trip-page .completed-header { flex: 0 0 130px; min-height: 130px; padding: 12px 11px 14px; }
        .completed-toast { min-height: 36px; display: flex; align-items: center; gap: 9px; margin-bottom: 10px; padding: 7px 12px; border-radius: 7px; background: #f7f8fa; color: #17243a; font-size: 13px; }
        .completed-toast svg { width: 17px; height: 17px; flex: 0 0 auto; fill: #17243a; stroke: #fff; stroke-width: 2; }
        .completed-header h1 { margin: 0; font-size: 19px; }
        .completed-trip-page .details-content { gap: 15px; padding-bottom: 96px; }
        .completed-evidence-card { padding-bottom: 12px; }
        .completed-evidence-row { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #17243a; font-size: 13px; }
        .completed-evidence-label { display: inline-flex; align-items: center; gap: 8px; }
        .completed-evidence-label svg { width: 17px; height: 17px; color: #15945e; }
        .completed-evidence-row img { width: 64px; height: 48px; object-fit: cover; border: 1px solid #d5dfeb; border-radius: 5px; background: #17243a; }
        .completed-status { padding: 4px 10px; border: 1px solid #b7ddca; border-radius: 999px; background: #edf8f2; color: #118354; font-size: 11px; }
        .completed-notice { display: flex; gap: 9px; align-items: flex-start; padding: 11px 12px; border: 1px solid #d5dfeb; border-radius: 8px; background: #fff; color: #58718e; }
        .completed-notice svg { width: 17px; height: 17px; flex: 0 0 auto; color: #15945e; }
        .completed-notice p { margin: 0; font-size: 11px; line-height: 1.4; }
      `}</style>
      <header className="trips-header details-header completed-header">
        <div className="completed-toast" role="status" aria-live="polite"><CheckIcon /><span>Viagem concluída com sucesso.</span></div>
        <h1>Detalhes da viagem</h1>
      </header>
      <section className="trips-content details-content">
        <article className="detail-card">
          <div className="detail-title-row"><h2>#{trip.id}</h2><span className="completed-status">Concluída</span></div>
          <div className="detail-row"><span>Data</span><strong>{trip.date}</strong></div>
          <div className="detail-row"><span>Horário</span><strong>{trip.time}</strong></div>
          <div className="detail-row"><span>Finalidade</span><strong>Atendimento institucional</strong></div>
        </article>
        <article className="detail-card">
          <p className="detail-section-label">TRAJETO</p>
          <div className="route-panel">
            <div className="route-stop origin"><span className="route-dot" /><div><small>Origem</small><strong>{trip.origin}</strong></div></div>
            <div className="route-stop destination"><span className="route-dot" /><div><small>Destino</small><strong>{trip.destination}</strong></div></div>
          </div>
        </article>
        <article className="detail-card vehicle-card">
          <p className="detail-section-label">VEÍCULO ATRIBUÍDO</p>
          <div className="detail-vehicle"><span className="vehicle-icon"><TruckIcon /></span><div><strong>{trip.vehicle}</strong><span>{trip.plate}</span></div></div>
          <div className="vehicle-notice"><span aria-hidden="true">♙</span><p>Veículo definido pelo responsável da operação. Não é possível alterar o veículo ou a alocação.</p></div>
        </article>
        <article className="detail-card trip-record-card">
          <p className="detail-section-label">REGISTRO DA VIAGEM</p>
          <div className="detail-row"><span>Início</span><strong>{startTime}</strong></div>
          <div className="detail-row"><span>KM inicial</span><strong>{initialOdometer ?? "—"} km</strong></div>
          <div className="detail-row"><span>Conclusão</span><strong>{endTime}</strong></div>
          <div className="detail-row"><span>KM final</span><strong>{finalOdometer ?? "—"} km</strong></div>
          <div className="detail-row"><span>Distância percorrida</span><strong style={{ color: "#075ce5" }}>{distance} km</strong></div>
        </article>
        <article className="detail-card completed-evidence-card">
          <p className="detail-section-label">EVIDÊNCIAS</p>
          <div className="completed-evidence-row"><span className="completed-evidence-label"><CheckIcon />Foto inicial registrada</span><img src={initialEvidence} alt="Foto do odômetro no início da viagem" /></div>
          <div className="completed-evidence-row"><span className="completed-evidence-label"><CheckIcon />Foto final registrada</span><img src={finalEvidence} alt="Foto do odômetro no encerramento da viagem" /></div>
        </article>
        <article className="detail-card"><p className="detail-section-label">ABASTECIMENTOS REGISTRADOS</p><p style={{ margin: 0, color: "#58718e", fontSize: 13 }}>{hasFuelRegistration ? "Abastecimento registrado nesta viagem." : "Nenhum abastecimento registrado."}</p></article>
        <article className="detail-card"><p className="detail-section-label">OCORRÊNCIAS REGISTRADAS</p><p style={{ margin: 0, color: "#58718e", fontSize: 13 }}>{hasIncidentRegistration ? "Ocorrência registrada nesta viagem." : "Nenhuma ocorrência registrada."}</p></article>
        <div className="completed-notice"><AlertIcon /><p>Viagem concluída, disponível para validação do responsável. Não é possível editar uma viagem concluída.</p></div>
      </section>
      <BottomNavigation active="none" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={onProfile} />
    </main>
  );
}


function InfoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>;
}

function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>;
}


function ProfileScreen({ onHome, onTrips, onNotifications, onLogout }: { onHome: () => void; onTrips: () => void; onNotifications: () => void; onLogout: () => void }) {
  return (
    <main className="trips-page profile-page">
      <style>{`
        .profile-page .profile-header { flex: 0 0 86px; min-height: 86px; padding: 17px 15px 13px; }
        .profile-header h1 { margin: 0 0 7px; font-size: 18px; line-height: 1.2; }
        .profile-header p { margin: 0; color: #dbe6f5; font-size: 13px; }
        .profile-content { gap: 15px; padding: 16px 15px 96px; }
        .profile-summary-card, .profile-information-card, .profile-notice-card { flex: 0 0 auto; border: 1px solid #d5dfeb; border-radius: 9px; background: #fff; }
        .profile-summary-card { padding: 16px; }
        .profile-identity { display: flex; align-items: center; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid #d5dfeb; }
        .profile-avatar { width: 56px; height: 56px; flex: 0 0 56px; display: grid; place-items: center; border-radius: 50%; background: #edf1f5; color: #075ce5; }
        .profile-avatar svg { width: 27px; height: 27px; }
        .profile-name { display: grid; gap: 4px; }
        .profile-name strong { color: #17243a; font-size: 17px; }
        .profile-name span { color: #58718e; font-size: 14px; }
        .profile-status-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 12px; color: #58718e; font-size: 13px; }
        .profile-availability { padding: 5px 11px; border: 1px solid #b7ddca; border-radius: 999px; background: #edf8f2; color: #138657; font-size: 11px; }
        .profile-information-card { padding: 16px; }
        .profile-information-card h2 { margin: 0 0 10px; color: #58718e; font-size: 12px; font-weight: 400; }
        .profile-information-row { min-height: 41px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid #dfe5ed; color: #58718e; font-size: 13px; }
        .profile-information-row:last-child { border-bottom: 0; }
        .profile-information-row strong { color: #17243a; font-size: 13px; font-weight: 400; text-align: right; }
        .profile-notice-card { display: flex; align-items: flex-start; gap: 9px; padding: 12px; color: #58718e; }
        .profile-notice-card svg { width: 16px; height: 16px; flex: 0 0 16px; color: #075ce5; }
        .profile-notice-card p { margin: 0; font-size: 11px; line-height: 1.4; }
        .profile-logout-button { min-height: 56px; display: flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid #ff9c9c; border-radius: 9px; background: #fff; color: #dc2626; font: inherit; font-size: 14px; cursor: pointer; transition: background-color .16s ease, border-color .16s ease; }
        .profile-logout-button:hover { border-color: #ef4444; background: #fff7f7; }
        .profile-logout-button:focus-visible { outline: 3px solid #fca5a5; outline-offset: 2px; }
        .profile-logout-button svg { width: 17px; height: 17px; }
        .profile-page .nav-item:nth-child(3)::after { display: none; }
        @media (prefers-reduced-motion: reduce) { .profile-logout-button { transition: none; } }
      `}</style>
      <header className="trips-header profile-header"><h1>Perfil</h1><p>Dados básicos da sua conta.</p></header>
      <section className="trips-content profile-content" aria-label="Dados do perfil">
        <article className="profile-summary-card">
          <div className="profile-identity"><span className="profile-avatar"><UserIcon /></span><div className="profile-name"><strong>Carlos Henrique</strong><span>Motorista</span></div></div>
          <div className="profile-status-row"><span>Status</span><span className="profile-availability">Disponível</span></div>
        </article>
        <article className="profile-information-card">
          <h2>INFORMAÇÕES DA CONTA</h2>
          <div className="profile-information-row"><span>Nome</span><strong>Carlos Henrique</strong></div>
          <div className="profile-information-row"><span>Perfil</span><strong>Motorista</strong></div>
          <div className="profile-information-row"><span>Identificação</span><strong>Matrícula 04.8821</strong></div>
          <div className="profile-information-row"><span>Jornada cadastrada</span><strong>Jornada 07:00 — 17:00</strong></div>
          <div className="profile-information-row"><span>Instituição</span><strong>SVO</strong></div>
        </article>
        <aside className="profile-notice-card"><InfoIcon /><p>Dados cadastrais são mantidos pelo responsável da operação. O motorista não altera informações administrativas por este aplicativo.</p></aside>
        <button className="profile-logout-button" type="button" onClick={onLogout}><LogoutIcon /><span>Sair da conta</span></button>
      </section>
      <BottomNavigation active="profile" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={() => undefined} />
    </main>
  );
}


function NotificationsScreen({ notifications, onHome, onTrips, onProfile }: { notifications: TripNotification[]; onHome: () => void; onTrips: () => void; onProfile: () => void }) {
  return (
    <main className="trips-page notifications-page">
      <style>{`
        .notifications-page .notifications-header { flex: 0 0 80px; min-height: 80px; padding: 13px 11px 12px; }
        .notifications-header h1 { margin: 0 0 6px; font-size: 18px; line-height: 1.2; }
        .notifications-header p { margin: 0; color: #dbe6f5; font-size: 13px; }
        .notifications-content { gap: 12px; padding: 16px 11px 96px; }
        .notification-card { display: flex; gap: 12px; align-items: flex-start; padding: 16px; border: 1px solid #d5dfeb; border-radius: 9px; background: #fff; }
        .notification-bell { width: 36px; height: 36px; flex: 0 0 36px; display: grid; place-items: center; border-radius: 50%; background: #edf1f5; color: #075ce5; }
        .notification-bell svg { width: 17px; height: 17px; }
        .notification-copy { min-width: 0; display: grid; gap: 5px; }
        .notification-copy strong { color: #17243a; font-size: 13px; line-height: 1.3; }
        .notification-trip { color: #075ce5; font-size: 12px; }
        .notification-detail { color: #58718e; font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
        .notification-time { color: #58718e; font-size: 12px; }
        .notifications-footer-note { margin: 1px 0 0; color: #58718e; text-align: center; font-size: 11px; }
        .notifications-empty { padding: 27px 15px; border: 1px dashed #cbd7e5; border-radius: 9px; color: #58718e; text-align: center; font-size: 13px; }
        .notifications-page .nav-item:nth-child(3)::after { display: none; }
      `}</style>
      <header className="trips-header notifications-header"><h1>Notificações</h1><p>Avisos das suas viagens e veículos.</p></header>
      <section className="trips-content notifications-content" aria-label="Avisos das viagens">
        {notifications.length ? notifications.map((notification) => (
          <article className="notification-card" key={notification.id}>
            <span className="notification-bell"><BellIcon /></span>
            <div className="notification-copy"><strong>{notification.title}</strong><span className="notification-trip">#{notification.tripId}</span><span className="notification-detail">{notification.detail}</span><time className="notification-time">{notification.time}</time></div>
          </article>
        )) : <div className="notifications-empty">Você não tem notificações no momento.</div>}
        <p className="notifications-footer-note">Somente avisos das suas atividades de transporte.</p>
      </section>
      <BottomNavigation active="notifications" onHome={onHome} onTrips={onTrips} onNotifications={() => undefined} onProfile={onProfile} />
    </main>
  );
}


export default function App() {
  const [screen, setScreen] = useState<"login" | "trips" | "tripList" | "tripInfo" | "details" | "start" | "inProgress" | "fuel" | "incident" | "finish" | "completed" | "notifications" | "profile">("login");
  const [tripTab, setTripTab] = useState<"Hoje" | "Próximas" | "Concluídas">("Hoje");
  const [selectedTrip, setSelectedTrip] = useState<TripListItem>(initialTripListData[0]);
  const [tripListData, setTripListData] = useState<TripListItem[]>(initialTripListData);
  const [notifications, setNotifications] = useState<TripNotification[]>(initialNotifications);

  function addNotification(notification: Omit<TripNotification, "id" | "time">) {
    const now = new Date();
    const time = `Hoje, ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    setNotifications((current) => [{ ...notification, id: now.getTime() + Math.random(), time }, ...current]);
  }
  const [hasStarted, setHasStarted] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [initialOdometer, setInitialOdometer] = useState<string | null>(null);
  const [hasFuelRegistration, setHasFuelRegistration] = useState(false);
  const [fuelValidationRequested, setFuelValidationRequested] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [finishedAt, setFinishedAt] = useState<Date | null>(null);
  const [finalOdometer, setFinalOdometer] = useState<string | null>(null);
  const [initialTripPhoto, setInitialTripPhoto] = useState<string | null>(null);
  const [finalTripPhoto, setFinalTripPhoto] = useState<string | null>(null);
  const [hasIncidentRegistration, setHasIncidentRegistration] = useState(false);
  const [completedTripRecords, setCompletedTripRecords] = useState<Record<string, CompletedTripRecord>>({});

  useEffect(() => {
    if (!showSuccess) return;
    const timeoutId = window.setTimeout(() => setShowSuccess(false), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [showSuccess]);

  function openTrip(trip: TripListItem) {
    setSelectedTrip(trip);
    if (trip.status === "Concluída") {
      setScreen("completed");
      return;
    }
    setHasStarted(false);
    setHasFinished(false);
    setShowSuccess(false);
    setStartedAt(null);
    setFinishedAt(null);
    setInitialOdometer(null);
    setFinalOdometer(null);
    setInitialTripPhoto(null);
    setFinalTripPhoto(null);
    setHasFuelRegistration(false);
    setFuelValidationRequested(false);
    setHasIncidentRegistration(false);
    setScreen("details");
  }

  function confirmTripStart(odometer: string, photo: string) {
    setHasStarted(true);
    setTripListData((currentTrips) => currentTrips.map((trip) => trip.id === selectedTrip.id ? { ...trip, status: "Em andamento" } : trip));
    addNotification({ kind: "inProgress", title: "Viagem em andamento", tripId: selectedTrip.id, detail: `A viagem para ${selectedTrip.destination} foi iniciada.` });
    setStartedAt(new Date());
    setInitialOdometer(odometer);
    setInitialTripPhoto(photo);
    setShowSuccess(true);
    setScreen("details");
  }

  if (screen === "start") {
    return <StartTripScreen trip={selectedTrip} onBack={() => setScreen("details")} onConfirm={confirmTripStart} />;
  }

  if (screen === "completed") {
    const completion = completedTripRecords[selectedTrip.id];
    return (
      <CompletedTripScreen
        trip={selectedTrip}
        startedAt={completion?.startedAt ?? null}
        finishedAt={completion?.finishedAt ?? finishedAt}
        initialOdometer={completion?.initialOdometer ?? initialOdometer}
        finalOdometer={completion?.finalOdometer ?? finalOdometer}
        initialPhoto={completion?.initialPhoto ?? initialTripPhoto}
        finalPhoto={completion?.finalPhoto ?? finalTripPhoto}
        hasFuelRegistration={completion?.hasFuelRegistration ?? hasFuelRegistration}
        hasIncidentRegistration={completion?.hasIncidentRegistration ?? hasIncidentRegistration}
        onHome={() => setScreen("trips")}
        onTrips={() => setScreen("tripList")}
        onNotifications={() => setScreen("notifications")}
        onProfile={() => setScreen("profile")}
      />
    );
  }

  if (screen === "finish") {
    return (
      <FinishTripScreen
        trip={selectedTrip}
        onBack={() => setScreen("inProgress")}
        initialOdometer={initialOdometer}
        startedAt={startedAt}
        onConfirm={(value, photo) => {
          const parsedFinalKm = Number(value.trim().replace(",", "."));
          const parsedInitialKm = Number(initialOdometer ?? 0);
          // Segunda validação no fluxo: não conclui a viagem se o KM final for menor que o inicial.
          if (!value.trim() || !Number.isFinite(parsedFinalKm) || parsedFinalKm < parsedInitialKm) return;

          const completionTime = new Date();
          setFinalOdometer(value);
          setFinalTripPhoto(photo);
          setFinishedAt(completionTime);
          setHasFinished(true);
          addNotification({ kind: "completed", title: "Viagem concluída", tripId: selectedTrip.id, detail: `Viagem para ${selectedTrip.destination} concluída com sucesso.` });
          setCompletedTripRecords((records) => ({
            ...records,
            [selectedTrip.id]: {
              startedAt,
              finishedAt: completionTime,
              initialOdometer,
              finalOdometer: value,
              initialPhoto: initialTripPhoto,
              finalPhoto: photo,
              hasFuelRegistration,
              hasIncidentRegistration,
            },
          }));
          setTripListData((currentTrips) => currentTrips.map((trip) => trip.id === selectedTrip.id ? { ...trip, status: "Concluída" } : trip));
          setScreen("completed");
        }}
      />
    );
  }

  if (screen === "fuel") {
    return (
      <FuelRegistrationScreen
        trip={selectedTrip}
        onBack={() => setScreen("inProgress")}
        showMissingErrors={fuelValidationRequested}
        onSubmit={() => {
          setHasFuelRegistration(true);
          addNotification({ kind: "updated", title: "Abastecimento registrado", tripId: selectedTrip.id, detail: `Os dados do abastecimento da viagem ${selectedTrip.id} foram registrados.` });
          setFuelValidationRequested(false);
          setScreen("inProgress");
        }}
      />
    );
  }

  if (screen === "incident") {
    return <IncidentRegistrationScreen trip={selectedTrip} onBack={() => setScreen("inProgress")} onSubmit={() => { setHasIncidentRegistration(true); addNotification({ kind: "created", title: "Ocorrência registrada", tripId: selectedTrip.id, detail: `Uma ocorrência foi registrada na viagem ${selectedTrip.id}.` }); setScreen("inProgress"); }} />;
  }

  if (screen === "inProgress") {
    return (
      <InProgressScreen
        trip={selectedTrip}
        onRecordFuel={() => {
          setFuelValidationRequested(false);
          setScreen("fuel");
        }}
        onReportIncident={() => setScreen("incident")}
        onHome={() => setScreen("trips")}
        onTrips={() => setScreen("tripList")}
        onNotifications={() => setScreen("notifications")}
        onProfile={() => setScreen("profile")}
        onFinish={() => setScreen("finish")}
        startedAt={startedAt}
        initialOdometer={initialOdometer}
      />
    );
  }

  if (screen === "details") {
    return (
      <DetailsScreen
        trip={selectedTrip}
        onBack={() => setScreen("trips")}
        onHome={() => setScreen("trips")}
        onTrips={() => setScreen("tripList")}
        onNotifications={() => setScreen("notifications")}
        onProfile={() => setScreen("profile")}
        onStart={() => setScreen("start")}
        onContinue={() => setScreen("inProgress")}
        hasStarted={hasStarted}
        hasFinished={hasFinished}
        showSuccess={showSuccess}
        startedAt={startedAt}
        finishedAt={finishedAt}
        initialOdometer={initialOdometer}
        finalOdometer={finalOdometer}
      />
    );
  }

  if (screen === "tripInfo") return <TripInfoScreen trip={selectedTrip} onBack={() => setScreen("tripList")} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} />;
  if (screen === "notifications") return <NotificationsScreen notifications={notifications} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onProfile={() => setScreen("profile")} />;
  if (screen === "profile") return <ProfileScreen onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onLogout={() => setScreen("login")} />;
  if (screen === "tripList") return <TripsListScreen trips={tripListData} activeTab={tripTab} onTabChange={setTripTab} onSelectTrip={openTrip} onHome={() => setScreen("trips")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} />;
  if (screen === "trips") return <HomeScreen trips={tripListData} onViewTrip={openTrip} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} />;
  return <LoginScreen onLogin={() => setScreen("trips")} />;
}

