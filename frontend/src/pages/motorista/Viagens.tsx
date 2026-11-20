import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "./Viagens.css";

type TripListItem = {
  id: string;
  backendId?: string;
  group: "Hoje" | "Próximas";
  status: "Agendada" | "Em andamento" | "Concluída";
  date: string;
  time: string;
  origin: string;
  destination: string;
  vehicle: string;
  plate: string;
};

type DriverProfile = {
  displayName: string;
  role: string;
  shift: string;
  availability: string;
  employeeId: string;
  institution: string;
};

type TripNotification = {
  id: number | string;
  kind: "created" | "updated" | "inProgress" | "completed" | "reminder";
  title: string;
  tripId: string;
  detail: string;
  time: string;
};

const NotificationCountContext = createContext(0);

// Rotas HTTP do backend (não são caminhos de arquivos no computador).
// Configure a URL do servidor em frontend/.env usando VITE_API_BASE_URL.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
// Endpoint registrado no contrato do backend para a lista do motorista.
const API_TRIPS_PATH = import.meta.env.VITE_API_TRIPS_PATH ?? "/api/viagens/minhas";
const API_NOTIFICATIONS_PATH = import.meta.env.VITE_API_NOTIFICATIONS_PATH ?? "/api/notificacoes";
const API_SESSION_PATH = import.meta.env.VITE_API_SESSION_PATH ?? "/api/auth/sessao";

function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem("token") || localStorage.getItem("token") || null;
  } catch {
    return null;
  }
}

/** Executa apenas requisições GET autenticadas para consulta de dados. */
async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { method: "GET", headers, signal });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    const message = error && typeof error.message === "string"
      ? error.message
      : `A API respondeu com status ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

/** Autentica no backend e guarda o JWT na mesma chave usada pelo app. */
async function loginWithBackend(email: string, senha: string): Promise<void> {
  const response = await fetch(getApiUrl("/api/auth/login"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
    throw new Error(error && typeof error.message === "string" ? error.message : `Falha no login (HTTP ${response.status}).`);
  }
  if (!isRecord(payload) || typeof payload.token !== "string" || !payload.token) {
    throw new Error("O backend não retornou um token de autenticação válido.");
  }
  sessionStorage.setItem("token", payload.token);
}

function toTripListItem(raw: unknown): TripListItem | null {
  if (!isRecord(raw)) return null;

  const id = String(raw.codigo ?? raw.id ?? "").trim();
  if (!id) return null;

  const rawStatus = String(raw.status ?? "").toUpperCase();
  const status: TripListItem["status"] =
    rawStatus === "EM_TRANSPORTE" || rawStatus === "EM_ANDAMENTO" || rawStatus === "EM ANDAMENTO"
      ? "Em andamento"
      : rawStatus === "CONCLUIDA" || rawStatus === "CONCLUÍDA"
        ? "Concluída"
        : "Agendada";

  const dateStr = typeof raw.dataHoraSaida === "string"
    ? raw.dataHoraSaida
    : typeof raw.dataInicio === "string"
      ? raw.dataInicio
      : typeof raw.date === "string"
        ? raw.date
        : null;

  let formattedDate = "Hoje";
  let formattedTime = "—";
  let group: "Hoje" | "Próximas" = "Hoje";

  if (dateStr) {
    try {
      const parsed = new Date(dateStr);
      if (!Number.isNaN(parsed.getTime())) {
        const today = new Date();
        const isSameDay =
          parsed.getDate() === today.getDate() &&
          parsed.getMonth() === today.getMonth() &&
          parsed.getFullYear() === today.getFullYear();

        group = isSameDay ? "Hoje" : parsed > today ? "Próximas" : "Hoje";
        formattedDate = parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
        formattedTime = parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      } else {
        formattedDate = dateStr;
      }
    } catch {
      formattedDate = dateStr;
    }
  }

  if (typeof raw.time === "string" && raw.time) {
    formattedTime = raw.time;
  }

  const origin = typeof raw.origem === "string" && raw.origem.trim() ? raw.origem.trim() : "Origem não informada";
  const destination = typeof raw.destino === "string" && raw.destino.trim() ? raw.destino.trim() : "Destino não informado";

  let vehicle = "—";
  let plate = "—";
  if (isRecord(raw.veiculo)) {
    vehicle = typeof raw.veiculo.modelo === "string" && raw.veiculo.modelo ? raw.veiculo.modelo : "—";
    plate = typeof raw.veiculo.placa === "string" && raw.veiculo.placa ? raw.veiculo.placa : "—";
  } else {
    if (typeof raw.vehicle === "string" && raw.vehicle) vehicle = raw.vehicle;
    if (typeof raw.plate === "string" && raw.plate) plate = raw.plate;
  }

  const displayCode = id.startsWith("#") ? id.replace(/^#/, "") : id;
  const backendId = raw.id != null && /^-?\d+$/.test(String(raw.id)) ? String(raw.id) : undefined;

  return {
    id: displayCode,
    backendId,
    group: (raw.group === "Hoje" || raw.group === "Próximas") ? raw.group : group,
    status,
    date: formattedDate,
    time: formattedTime,
    origin,
    destination,
    vehicle,
    plate,
  };
}


/** Converte o item do endpoint GET /api/viagens/minhas para o formato da tela. */
function toBackendTripListItem(raw: unknown): TripListItem | null {
  if (!isRecord(raw)) return null;

  const displayCode = typeof raw.codigo === "string" && raw.codigo.trim()
    ? raw.codigo.trim()
    : raw.id != null
      ? String(raw.id).trim()
      : "";
  if (!displayCode) return null;

  const rawStatus = typeof raw.status === "string" ? raw.status.toUpperCase() : "";
  const status: TripListItem["status"] =
    rawStatus === "EM_TRANSPORTE" || rawStatus === "EM_ANDAMENTO" || rawStatus === "EM ANDAMENTO"
      ? "Em andamento"
      : rawStatus === "CONCLUIDA" || rawStatus === "CONCLUÍDA"
        ? "Concluída"
        : "Agendada";

  const backendId = raw.id != null && /^-?\d+$/.test(String(raw.id))
    ? String(raw.id)
    : undefined;

  return {
    id: displayCode.replace(/^#/, ""),
    backendId,
    group: status === "Agendada" ? "Próximas" : "Hoje",
    status,
    // O endpoint não fornece data, horário ou veículo; não inventamos esses dados.
    date: "Data não informada",
    time: "—",
    origin: typeof raw.origem === "string" && raw.origem.trim()
      ? raw.origem.trim()
      : "Origem não informada",
    destination: typeof raw.destino === "string" && raw.destino.trim()
      ? raw.destino.trim()
      : "Destino não informado",
    vehicle: "—",
    plate: "—",
  };
}

function parseBackendTrips(payload: unknown): TripListItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("Formato inesperado na resposta de viagens.");
  }
  return payload.data
    .map(toBackendTripListItem)
    .filter((trip): trip is TripListItem => trip !== null);
}

function toTripNotification(raw: unknown): TripNotification | null {
  if (!isRecord(raw)) return null;

  const id = raw.id != null ? String(raw.id) : String(Math.random());
  const title = typeof raw.titulo === "string" ? raw.titulo : typeof raw.title === "string" ? raw.title : "Notificação";
  const detail = typeof raw.descricao === "string" ? raw.descricao : typeof raw.detail === "string" ? raw.detail : "";

  let tripId = typeof raw.tripId === "string" && raw.tripId ? raw.tripId : "";
  if (!tripId) {
    const match = (title + " " + detail).match(/#?(TRP-\d+)/i);
    tripId = match ? match[1].toUpperCase() : "—";
  }

  let kind: "created" | "updated" | "inProgress" | "completed" | "reminder" = "created";
  const cat = String(raw.categoria ?? "").toLowerCase();
  if (cat === "sucesso") kind = "completed";
  else if (cat === "urgente") kind = "updated";
  else if (cat === "atencao") kind = "reminder";
  else if (raw.kind === "created" || raw.kind === "updated" || raw.kind === "inProgress" || raw.kind === "completed" || raw.kind === "reminder") {
    kind = raw.kind;
  }

  let formattedTime = "Recente";
  const timeRaw = typeof raw.criadoEm === "string" ? raw.criadoEm : typeof raw.time === "string" ? raw.time : null;
  if (timeRaw) {
    try {
      const dt = new Date(timeRaw);
      if (!Number.isNaN(dt.getTime())) {
        formattedTime = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      } else {
        formattedTime = timeRaw;
      }
    } catch {
      formattedTime = timeRaw;
    }
  }

  return {
    id,
    kind,
    title,
    tripId,
    detail,
    time: formattedTime,
  };
}

function toDriverProfile(raw: unknown): DriverProfile | null {
  if (!isRecord(raw)) return null;

  const usuario = isRecord(raw.data) ? (raw.data as Record<string, unknown>) : raw;
  const name = typeof usuario.nome === "string"
    ? usuario.nome
    : typeof usuario.displayName === "string"
      ? usuario.displayName
      : "Motorista";

  const rawPerfil = typeof usuario.perfil === "string" ? usuario.perfil : typeof usuario.role === "string" ? usuario.role : "MOTORISTA";
  const role = rawPerfil === "MOTORISTA" ? "Motorista Operacional" : rawPerfil;
  const employeeId = usuario.id != null ? `MAT-${usuario.id}` : (typeof usuario.employeeId === "string" ? usuario.employeeId : "—");
  const shift = typeof usuario.shift === "string" ? usuario.shift : "Turno Integral";
  const availability = typeof usuario.availability === "string" ? usuario.availability : "Disponível";
  const institution = typeof usuario.institution === "string" ? usuario.institution : "FSPH";

  return {
    displayName: name,
    role,
    shift,
    availability,
    employeeId,
    institution,
  };
}


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


function LoginScreen({ onLogin }: { onLogin: (email: string, senha: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    if (!email.trim() || !password) {
      setNotice("Informe seu e-mail e sua senha para continuar.");
      return;
    }
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
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
            <label htmlFor="username">E-mail</label>
            <input
              id="username"
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Digite seu e-mail"
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
            <p className="helper-text">Acesse com os dados fornecidos pela sua instituição.</p>
          </div>
          <button className="submit-button" type="submit" disabled={loading}>
            <EnterIcon /><span>{loading ? "Entrando…" : "Entrar"}</span>
          </button>
          {notice && <p className="notice" role="alert">{notice}</p>}
        </form>
        <div className="profile-note">
          <span className="shield-icon"><ShieldIcon /></span>
          <p>Entre com as credenciais fornecidas pela sua instituição.</p>
        </div>
      </section>
    </main>
  );
}

function BottomNavigation({ active = "home", onHome, onTrips, onNotifications, onProfile }: { active?: "home" | "trips" | "notifications" | "profile" | "none"; onHome?: () => void; onTrips?: () => void; onNotifications?: () => void; onProfile?: () => void }) {
  const notificationCount = useContext(NotificationCountContext);

  return (
    <nav className="bottom-navigation" aria-label="Navegação principal">
      <style>{`.bottom-navigation .nav-item:nth-child(3)::after { content: none !important; display: none !important; } .notification-count-badge { position: absolute; top: 0; left: calc(50% + 2px); min-width: 18px; height: 18px; padding: 0 4px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border: 1px solid #fff; border-radius: 999px; background: #ef2938; color: #fff; font-size: 10px; font-weight: 700; line-height: 1; }`}</style>
      <button className={`nav-item ${active === "home" ? "active" : ""}`} type="button" onClick={onHome} aria-label="Ir para Início"><HomeIcon /><span>Início</span></button>
      <button className={`nav-item ${active === "trips" ? "active" : ""}`} type="button" onClick={onTrips} aria-label="Ir para Viagens"><TruckIcon /><span>Viagens</span></button>
      <button className={`nav-item ${active === "notifications" ? "active" : ""}`} type="button" onClick={onNotifications} aria-label={notificationCount > 0 ? `Ir para Notificações, ${notificationCount} mensagens` : "Ir para Notificações"} style={{ position: "relative" }}>
        <BellIcon />
        {notificationCount > 0 && <span className="notification-count-badge" aria-label={`${notificationCount} mensagens`}>{notificationCount > 99 ? "99+" : notificationCount}</span>}
        <span>Notificações</span>
      </button>
      <button className={`nav-item ${active === "profile" ? "active" : ""}`} type="button" onClick={onProfile} aria-label="Ir para Perfil"><UserIcon /><span>Perfil</span></button>
    </nav>
  );
}


function ApiLoadStatus({ isLoading, error, onRetry }: { isLoading: boolean; error: string | null; onRetry: () => void }) {
  if (!isLoading && !error) return null;
  return (
    <div role={error ? "alert" : "status"} style={{ padding: "14px", border: "1px solid #d5dfeb", borderRadius: 9, background: "#fff", color: "#58718e", fontSize: 13, textAlign: "center" }}>
      {isLoading ? "Carregando dados da API…" : <>
        <p style={{ margin: "0 0 10px" }}>{error}</p>
        <button type="button" onClick={onRetry} style={{ padding: "8px 12px", border: 0, borderRadius: 6, background: "#075ce5", color: "#fff", cursor: "pointer" }}>Tentar novamente</button>
      </>}
    </div>
  );
}

function HomeScreen({ onViewTrip, onHome, onTrips, onNotifications, onProfile, trips, driver, isLoading, loadError, onRetry }: { onViewTrip: (trip: TripListItem) => void; onHome: () => void; onTrips: () => void; onNotifications: () => void; onProfile: () => void; trips: TripListItem[]; driver: DriverProfile | null; isLoading: boolean; loadError: string | null; onRetry: () => void }) {
  const pendingTrips = trips.filter((trip) => trip.status !== "Concluída");
  const featuredTrip = pendingTrips[0];
  const otherTrips = pendingTrips.slice(1);
  return (
    <main className="trips-page">
      <header className="trips-header">
        <h1>{driver ? `Olá, ${driver.displayName.split(" ")[0]}` : "Olá"}</h1>
        <p>Confira suas viagens de hoje.</p>
      </header>
      <section className="trips-content">
        <article className="driver-card">
          <div><span className="eyebrow">{driver?.role ?? "PERFIL"}</span><h2>{driver?.displayName ?? "Dados do perfil indisponíveis"}</h2><p>{driver?.shift ?? ""}</p></div>
          <span className="availability">{driver?.availability ?? "—"}</span>
        </article>
        <ApiLoadStatus isLoading={isLoading} error={loadError} onRetry={onRetry} />
        {!isLoading && !loadError && (featuredTrip ? <article className="next-trip-card">
          <div className="trip-card-top"><span className="eyebrow blue-text">PRÓXIMA VIAGEM</span><span className="status-pill">{featuredTrip.status}</span></div>
          <div className="trip-title-row"><h2>#{featuredTrip.id}</h2><span className="time-pill"><CalendarIcon />{featuredTrip.time}</span></div>
          <p className="trip-destination">{featuredTrip.origin}</p>
          <p className="destination-label">até</p>
          <p className="trip-destination">{featuredTrip.destination}</p>
          <div className="vehicle-line"><TruckIcon />Veículo {featuredTrip.vehicle} • {featuredTrip.plate}</div>
          <button className="view-trip-button" type="button" onClick={() => onViewTrip(featuredTrip)}>Ver viagem</button>
          <p className="trip-date">{featuredTrip.date} • {featuredTrip.time}</p>
        </article> : <article className="next-trip-card"><p style={{ margin: 0 }}>Você não tem viagens pendentes.</p></article>)}
        <div className="upcoming-heading"><h2>Próximas viagens</h2><button type="button" onClick={onTrips}>Ver todas <span>›</span></button></div>
        {!isLoading && !loadError && otherTrips.map((trip) => <button className="upcoming-trip-card" type="button" key={trip.id} onClick={() => onViewTrip(trip)} style={{ width: "100%", textAlign: "left", font: "inherit", cursor: "pointer" }}>
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

function TripsListScreen({ onSelectTrip, onHome, onNotifications, onProfile, activeTab, onTabChange, trips, isLoading, loadError, onRetry }: { onSelectTrip: (trip: TripListItem) => void; onHome: () => void; onNotifications: () => void; onProfile: () => void; activeTab: "Hoje" | "Próximas" | "Concluídas"; onTabChange: (tab: "Hoje" | "Próximas" | "Concluídas") => void; trips: TripListItem[]; isLoading: boolean; loadError: string | null; onRetry: () => void }) {
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
        <ApiLoadStatus isLoading={isLoading} error={loadError} onRetry={onRetry} />
        {!isLoading && !loadError && (visibleTrips.length ? visibleTrips.map((trip) => <button className="trip-list-card" type="button" key={trip.id} onClick={() => onSelectTrip(trip)} aria-label={`Ver detalhes da viagem ${trip.id}`}>
          <div className="trip-list-card-head"><strong>#{trip.id}</strong><span className={`trip-card-status${trip.status === "Agendada" ? " scheduled" : trip.status === "Em andamento" ? " progress" : ""}`}>{trip.status}</span></div>
          <p className="trip-list-date">{trip.date} • {trip.time}</p>
          <div className="trip-list-route"><div><p>{trip.origin}</p><small>para</small><p>{trip.destination}</p></div><span className="trip-list-chevron" aria-hidden="true">›</span></div>
          <div className="trip-list-vehicle">Veículo {trip.vehicle} • {trip.plate}</div>
        </button>) : <div className="trip-list-empty">Nenhuma viagem nesta categoria.</div>)}
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
          <div className="detail-row"><span>Finalidade</span><strong>—</strong></div>
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
            <p>Status recebido da API: concluída.</p>
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
        <p>Os registros operacionais ficarão disponíveis após a integração com a API.</p>
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

function IncidentRegistrationScreen({ trip, onBack }: { trip: TripListItem; onBack: () => void }) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const dateText = "Disponível após integração";
  const timeText = "Disponível após integração";

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    if (!description.trim()) return;
    setSaveNotice("A API de gravação ainda não está disponível. Nenhuma ocorrência foi salva.");
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
        .incident-save-notice { margin: 0 14px 8px; color: #9a5800; font-size: 12px; text-align: center; }
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
          <p className={`incident-required-note ${submitAttempted && !description.trim() ? "has-error" : ""}`}>{submitAttempted && !description.trim() ? "Informe a descrição da ocorrência." : "Campo obrigatório. O texto fica apenas nesta tela."}</p>
        </article>

        <article className="incident-form-card incident-photo-card">
          <label>Adicionar foto (opcional)</label>
          <div className="incident-photo-box">
            {photoPreview ? (
              <>
                <img className="incident-photo-preview" src={photoPreview} alt="Prévia local da foto da ocorrência, ainda não enviada" />
                <div className="incident-photo-actions">
                  <span className="incident-photo-registered-badge">Prévia local</span>
                  <button className="incident-retake-button" type="button" onClick={() => setPhotoPreview(null)}>Remover prévia</button>
                </div>
              </>
            ) : (
              <>
                <span className="incident-camera-placeholder"><CameraIcon /></span>
                <p className="incident-photo-copy">Se possível, fotografe o problema identificado no veículo.</p>
                <button className="incident-camera-button" type="button" onClick={() => cameraInputRef.current?.click()}><CameraIcon />Tirar foto do painel</button>
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
      {saveNotice && <p className="incident-save-notice" role="status">{saveNotice}</p>}
      <footer className="incident-footer">
        <button className="incident-submit-button" type="button" onClick={(event) => event.currentTarget.closest(".incident-registration-page")?.querySelector("form")?.requestSubmit()}><IncidentIcon />Registrar ocorrência</button>
      </footer>
    </main>
  );
}

function FuelRegistrationScreen({
  trip,
  onBack,
  showMissingErrors = false,
}: {
  trip: TripListItem;
  onBack: () => void;
  showMissingErrors?: boolean;
}) {
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [currentOdometer, setCurrentOdometer] = useState("");
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(showMissingErrors);
  const [saveNotice, setSaveNotice] = useState("");

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setReceiptPreview(reader.result);
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
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
    const photoMissing = !receiptPreview;
    if (!Number.isFinite(km) || km <= 0 || !Number.isFinite(liters) || liters <= 0 || !Number.isFinite(amount) || amount <= 0 || photoMissing) return;
    setSaveNotice("A API de gravação ainda não está disponível. Nenhum abastecimento foi salvo.");
  }

  const dateText = "Disponível após integração";
  const timeText = "Disponível após integração";

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
        .fuel-register-button:disabled { background: #80a8eb; cursor: not-allowed; }
        .fuel-save-notice { margin: 0 14px 8px; color: #9a5800; font-size: 12px; text-align: center; }
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
          <div className={`fuel-receipt-box ${submitAttempted && !receiptPreview ? "has-error" : ""}`}>
            {receiptPreview ? (
              <>
                <div className="fuel-odometer-photo-preview">
                  <img src={receiptPreview} alt="Prévia local da foto do odômetro, ainda não enviada" />
                </div>
                <div className="fuel-photo-controls">
                  <span className="fuel-photo-badge">Prévia local</span>
                  <button className="fuel-retake-photo" type="button" onClick={() => setReceiptPreview(null)}>Remover prévia</button>
                </div>
              </>
            ) : (
              <>
                <span className="fuel-camera-placeholder"><CameraIcon /></span>
                <p className="fuel-receipt-copy">Registre uma foto do odômetro atual do veículo.</p>
                <button className="fuel-take-photo" type="button" onClick={() => receiptInputRef.current?.click()}><CameraIcon />Tirar foto do painel</button>
                <button className="fuel-file-button" type="button" onClick={() => receiptInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={receiptInputRef} className="fuel-hidden-input" type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} aria-label="Tirar foto ou selecionar imagem do odômetro"/>
            {submitAttempted && !receiptPreview && <p className="fuel-photo-error" role="alert">Selecione uma foto do odômetro.</p>}
          </div>
        </article>
        <div aria-hidden="true" style={{ height: 2, flex: "0 0 2px" }} />
      </form>
      {saveNotice && <p className="fuel-save-notice" role="status">{saveNotice}</p>}
      <footer className="fuel-register-footer">
        <button className="fuel-register-button" type="button" onClick={(event) => {
          const form = event.currentTarget.closest(".fuel-registration-page")?.querySelector("form");
          form?.requestSubmit();
        }}><FuelIcon />Registrar abastecimento</button>
      </footer>
    </main>
  );
}



function FinishTripScreen({
  trip,
  onBack,
  initialOdometer,
  startedAt,
}: {
  trip: TripListItem;
  onBack: () => void;
  initialOdometer: string | null;
  startedAt: Date | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [finalOdometer, setFinalOdometer] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const initialKm = Number(initialOdometer ?? 0);
  const parsedFinalKm = Number(finalOdometer.trim().replace(",", "."));
  const kmEntered = finalOdometer.trim() !== "" && Number.isFinite(parsedFinalKm);
  const kmNotLower = kmEntered && parsedFinalKm >= initialKm;
  const photoRegistered = photoPreview !== null;
  const distance = kmNotLower ? parsedFinalKm - initialKm : null;
  const startTime = startedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—";

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
                <div className="finish-photo-preview"><img src={photoPreview ?? ""} alt="Prévia local da foto final do odômetro, ainda não enviada" /></div>
                <div className="finish-photo-controls"><span className="finish-photo-badge">Prévia local</span><button className="finish-retake-button" type="button" onClick={() => setPhotoPreview(null)}>Remover prévia</button></div>
              </>
            ) : (
              <>
                <span className="finish-camera-placeholder"><CameraIcon /></span>
                <p className="finish-photo-copy">Registre a nova foto do painel para concluir a viagem.</p>
                <button className="finish-take-photo" type="button" onClick={() => fileInputRef.current?.click()}><CameraIcon />Tirar foto do painel</button>
                <button className="finish-file-button" type="button" onClick={() => fileInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={fileInputRef} className="finish-hidden-input" type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} aria-label="Escolher foto final do odômetro" />
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
        <button className="finish-confirm-button" type="button" disabled title="Disponível quando a API de gravação estiver integrada"><CheckIcon />CONFIRMAR FINALIZAÇÃO</button>
        <p>A finalização será habilitada quando a API de gravação estiver integrada.</p>
      </footer>
    </main>
  );
}

function StartTripScreen({ trip, onBack }: { trip: TripListItem; onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [odometer, setOdometer] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const hasValidOdometer =
    odometer.trim() !== "" &&
    Number.isFinite(Number(odometer)) &&
    Number(odometer) >= 0;
  const photoRegistered = photoPreview !== null;


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
      }
    };
    reader.readAsDataURL(selectedPhoto);
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
                  <img src={photoPreview ?? ""} alt="Prévia local da foto do odômetro, ainda não enviada" />
                </div>
                <div className="photo-registered-controls">
                  <span className="photo-registered-badge">Prévia local</span>
                  <button className="retake-photo-button" type="button" onClick={() => { setPhotoPreview(null); setPhotoName(""); fileInputRef.current?.click(); }}>
                    <span aria-hidden="true">↻</span>Tirar novamente
                  </button>
                </div>
                {photoName && <p className="photo-help">{photoName}</p>}
              </>
            ) : (
              <>
                <div className="camera-placeholder"><CameraIcon /></div>
                <p className="photo-help">A foto do painel é obrigatória para iniciar a viagem.</p>
                <button className="take-photo-button" type="button" onClick={() => fileInputRef.current?.click()}>
                  <CameraIcon /><span>Tirar foto do painel</span>
                </button>
                <input
                  ref={fileInputRef}
                  className="visually-hidden-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Tirar ou escolher imagem do odômetro"
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
          <button className="confirm-start-button" type="button" disabled aria-disabled="true" title="Disponível quando a API de gravação estiver integrada">
            <CheckIcon /><span>CONFIRMAR INÍCIO</span>
          </button>
          <p>O início será habilitado quando a API de gravação estiver integrada.</p>
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
  onHome: () => void;
  onTrips: () => void;
  onNotifications: () => void;
  onProfile: () => void;
}) {
  const startTime = startedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const endTime = finishedAt?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) ?? "—";
  const initialKm = Number((initialOdometer ?? "0").trim().replace(",", "."));
  const finalKm = Number((finalOdometer ?? "0").trim().replace(",", "."));
  const distance = initialOdometer !== null && finalOdometer !== null && Number.isFinite(initialKm) && Number.isFinite(finalKm) ? Math.max(0, finalKm - initialKm) : null;

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
        <div className="completed-toast" role="status" aria-live="polite"><CheckIcon /><span>Dados da viagem concluída.</span></div>
        <h1>Detalhes da viagem</h1>
      </header>
      <section className="trips-content details-content">
        <article className="detail-card">
          <div className="detail-title-row"><h2>#{trip.id}</h2><span className="completed-status">Concluída</span></div>
          <div className="detail-row"><span>Data</span><strong>{trip.date}</strong></div>
          <div className="detail-row"><span>Horário</span><strong>{trip.time}</strong></div>
          <div className="detail-row"><span>Finalidade</span><strong>—</strong></div>
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
          <div className="detail-row"><span>Distância percorrida</span><strong style={{ color: "#075ce5" }}>{distance === null ? "—" : `${distance} km`}</strong></div>
        </article>
        <article className="detail-card completed-evidence-card">
          <p className="detail-section-label">EVIDÊNCIAS</p>
          {initialPhoto || finalPhoto ? <>
            {initialPhoto && <div className="completed-evidence-row"><span className="completed-evidence-label">Foto inicial</span><img src={initialPhoto} alt="Foto do odômetro no início da viagem" /></div>}
            {finalPhoto && <div className="completed-evidence-row"><span className="completed-evidence-label">Foto final</span><img src={finalPhoto} alt="Foto do odômetro no encerramento da viagem" /></div>}
          </> : <div className="trip-list-empty">Nenhuma foto recebida da API.</div>}
        </article>
        <article className="detail-card"><p className="detail-section-label">ABASTECIMENTOS REGISTRADOS</p><div className="trip-list-empty">Nenhum abastecimento recebido da API.</div></article>
        <article className="detail-card"><p className="detail-section-label">OCORRÊNCIAS REGISTRADAS</p><div className="trip-list-empty">Nenhuma ocorrência recebida da API.</div></article>
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


function ProfileScreen({ onHome, onTrips, onNotifications, onLogout, driver }: { onHome: () => void; onTrips: () => void; onNotifications: () => void; onLogout: () => void; driver: DriverProfile | null }) {
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
          <div className="profile-identity"><span className="profile-avatar"><UserIcon /></span><div className="profile-name"><strong>{driver?.displayName ?? "Dados indisponíveis"}</strong><span>{driver?.role ?? ""}</span></div></div>
          <div className="profile-status-row"><span>Status</span><span className="profile-availability">{driver?.availability ?? "—"}</span></div>
        </article>
        {!driver && <div className="trip-list-empty" role="status">Os dados do perfil aparecerão aqui quando a API estiver disponível.</div>}
        <article className="profile-information-card" style={{ display: driver ? undefined : "none" }}>
          <h2>INFORMAÇÕES DA CONTA</h2>
          <div className="profile-information-row"><span>Nome</span><strong>{driver?.displayName ?? "—"}</strong></div>
          <div className="profile-information-row"><span>Perfil</span><strong>{driver?.role ?? "—"}</strong></div>
          <div className="profile-information-row"><span>Identificação</span><strong>{driver?.employeeId ?? "—"}</strong></div>
          <div className="profile-information-row"><span>Jornada cadastrada</span><strong>{driver?.shift ?? "—"}</strong></div>
          <div className="profile-information-row"><span>Instituição</span><strong>{driver?.institution ?? "—"}</strong></div>
        </article>
        <aside className="profile-notice-card"><InfoIcon /><p>Dados cadastrais são mantidos pelo responsável da operação. O motorista não altera informações administrativas por este aplicativo.</p></aside>
        <button className="profile-logout-button" type="button" onClick={onLogout}><LogoutIcon /><span>Sair da conta</span></button>
      </section>
      <BottomNavigation active="profile" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={() => undefined} />
    </main>
  );
}


function NotificationsScreen({ notifications, onHome, onTrips, onProfile, isLoading, loadError, onRetry }: { notifications: TripNotification[]; onHome: () => void; onTrips: () => void; onProfile: () => void; isLoading: boolean; loadError: string | null; onRetry: () => void }) {
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
        <ApiLoadStatus isLoading={isLoading} error={loadError} onRetry={onRetry} />
        {!isLoading && !loadError && (notifications.length ? notifications.map((notification) => (
          <article className="notification-card" key={notification.id}>
            <span className="notification-bell"><BellIcon /></span>
            <div className="notification-copy"><strong>{notification.title}</strong><span className="notification-trip">#{notification.tripId}</span><span className="notification-detail">{notification.detail}</span><time className="notification-time">{notification.time}</time></div>
          </article>
        )) : <div className="notifications-empty">Você não tem notificações no momento.</div>)}
        <p className="notifications-footer-note">Somente avisos das suas atividades de transporte.</p>
      </section>
      <BottomNavigation active="notifications" onHome={onHome} onTrips={onTrips} onNotifications={() => undefined} onProfile={onProfile} />
    </main>
  );
}


function AppContent({ notifications, setNotifications }: { notifications: TripNotification[]; setNotifications: (next: TripNotification[]) => void }) {
  const [screen, setScreen] = useState<"login" | "trips" | "tripList" | "tripInfo" | "details" | "start" | "inProgress" | "fuel" | "incident" | "finish" | "completed" | "notifications" | "profile">("login");
  const [tripTab, setTripTab] = useState<"Hoje" | "Próximas" | "Concluídas">("Hoje");
  const [selectedTrip, setSelectedTrip] = useState<TripListItem | null>(null);
  const [tripListData, setTripListData] = useState<TripListItem[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const loadApiData = useCallback(async (signal?: AbortSignal) => {
    setApiLoading(true);
    setApiError(null);
    try {
      // A lista da tela vem do endpoint autenticado, que responde { data, meta }.
      const tripsPayload = await getJson(getApiUrl(API_TRIPS_PATH), signal);
      const trips = parseBackendTrips(tripsPayload);
      if (signal?.aborted) return;
      setTripListData(trips);

      // Notificações e perfil são complementares: falhas nessas rotas não ocultam viagens.
      const [notificationsResult, sessionResult] = await Promise.allSettled([
        getJson(getApiUrl(API_NOTIFICATIONS_PATH), signal),
        getJson(getApiUrl(API_SESSION_PATH), signal),
      ]);
      if (signal?.aborted) return;

      let nextNotifications: TripNotification[] = [];
      if (notificationsResult.status === "fulfilled") {
        const payload = notificationsResult.value;
        const list = Array.isArray(payload)
          ? payload
          : isRecord(payload) && Array.isArray(payload.data)
            ? payload.data
            : isRecord(payload) && Array.isArray(payload.items)
              ? payload.items
              : [];
        nextNotifications = list
          .map(toTripNotification)
          .filter((item): item is TripNotification => item !== null);
      }

      let driver: DriverProfile | null = null;
      if (sessionResult.status === "fulfilled") {
        driver = toDriverProfile(sessionResult.value);
      }
      if (signal?.aborted) return;
      setNotifications(nextNotifications);
      setDriverProfile(driver);
      setSelectedTrip((current) => current ? trips.find((trip) => trip.id === current.id) ?? null : null);
    } catch (err) {
      if (signal?.aborted) return;
      console.warn("Não foi possível carregar as viagens da API:", err);
      setApiError(err instanceof Error ? err.message : "Não foi possível carregar as viagens. Verifique a conexão e tente novamente.");
    } finally {
      if (!signal?.aborted) setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (screen === "login" || !getStoredToken()) {
      setApiLoading(false);
      return;
    }
    const controller = new AbortController();
    void loadApiData(controller.signal);
    return () => controller.abort();
  }, [loadApiData, screen]);

  const hasStarted = selectedTrip?.status === "Em andamento";
  const hasFinished = selectedTrip?.status === "Concluída";
  const showSuccess = false;
  const startedAt: Date | null = null;
  const initialOdometer: string | null = null;
  const finishedAt: Date | null = null;
  const finalOdometer: string | null = null;

  function openTrip(trip: TripListItem) {
    setSelectedTrip(trip);
    setScreen(trip.status === "Concluída" ? "completed" : trip.status === "Em andamento" ? "inProgress" : "details");
    // Consulta detalhe enriquecido da viagem via GET sem bloquear navegação
    void (async () => {
      try {
        const targetId = trip.backendId || (/^-?\d+$/.test(trip.id) ? trip.id : null);
        if (!targetId) return;
        const detailPayload = await getJson(getApiUrl(`/api/viagens/${targetId}`));
        const parsed = isRecord(detailPayload) && isRecord(detailPayload.data)
          ? toTripListItem(detailPayload.data)
          : toTripListItem(detailPayload);
        if (parsed) {
          setSelectedTrip((current) => current?.id === trip.id ? { ...current, ...parsed } : current);
        }
      } catch {
        // Silencioso se o detalhe específico não estiver disponível
      }
    })();
  }

  if (["start", "completed", "tripInfo", "finish", "fuel", "incident", "inProgress", "details"].includes(screen) && !selectedTrip) {
    return <TripsListScreen trips={tripListData} activeTab={tripTab} onTabChange={setTripTab} onSelectTrip={openTrip} onHome={() => setScreen("trips")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} isLoading={apiLoading} loadError={apiError} onRetry={() => { void loadApiData(); }} />;
  }

  if (screen === "start" && selectedTrip) {
    return <StartTripScreen trip={selectedTrip} onBack={() => setScreen("details")} />;
  }

  if (screen === "completed" && selectedTrip) {
    return (
      <CompletedTripScreen
        trip={selectedTrip}
        startedAt={null}
        finishedAt={null}
        initialOdometer={null}
        finalOdometer={null}
        initialPhoto={null}
        finalPhoto={null}
        onHome={() => setScreen("trips")}
        onTrips={() => setScreen("tripList")}
        onNotifications={() => setScreen("notifications")}
        onProfile={() => setScreen("profile")}
      />
    );
  }

  if (screen === "finish" && selectedTrip) {
    return (
      <FinishTripScreen
        trip={selectedTrip}
        onBack={() => setScreen("inProgress")}
        initialOdometer={initialOdometer}
        startedAt={startedAt}
      />
    );
  }

  if (screen === "fuel" && selectedTrip) {
    return (
      <FuelRegistrationScreen
        trip={selectedTrip}
        onBack={() => setScreen("inProgress")}
      />
    );
  }

  if (screen === "incident" && selectedTrip) {
    return <IncidentRegistrationScreen trip={selectedTrip} onBack={() => setScreen("inProgress")} />;
  }

  if (screen === "inProgress" && selectedTrip) {
    return (
      <InProgressScreen
        trip={selectedTrip}
        onRecordFuel={() => setScreen("fuel")}
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

  if (screen === "details" && selectedTrip) {
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

  if (screen === "tripInfo" && selectedTrip) return <TripInfoScreen trip={selectedTrip} onBack={() => setScreen("tripList")} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} />;
  if (screen === "notifications") return <NotificationsScreen notifications={notifications} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onProfile={() => setScreen("profile")} isLoading={apiLoading} loadError={apiError} onRetry={() => { void loadApiData(); }} />;
  if (screen === "profile") return <ProfileScreen onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onLogout={() => { sessionStorage.removeItem("token"); setDriverProfile(null); setTripListData([]); setSelectedTrip(null); setScreen("login"); }} driver={driverProfile} />;
  if (screen === "tripList") return <TripsListScreen trips={tripListData} activeTab={tripTab} onTabChange={setTripTab} onSelectTrip={openTrip} onHome={() => setScreen("trips")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} isLoading={apiLoading} loadError={apiError} onRetry={() => { void loadApiData(); }} />;
  if (screen === "trips") return <HomeScreen trips={tripListData} driver={driverProfile} onViewTrip={openTrip} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} isLoading={apiLoading} loadError={apiError} onRetry={() => { void loadApiData(); }} />;
  return <LoginScreen onLogin={async (email, senha) => { await loginWithBackend(email, senha); setScreen("trips"); }} />;
}

export default function App() {
  const [notifications, setNotifications] = useState<TripNotification[]>([]);

  return (
    <NotificationCountContext.Provider value={notifications.length}>
      <AppContent notifications={notifications} setNotifications={setNotifications} />
    </NotificationCountContext.Provider>
  );
}

