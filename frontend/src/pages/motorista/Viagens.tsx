import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "./Viagens.css";

type TripStatus =
  | "Pendente"
  | "Aprovada"
  | "Agendada"
  | "Pronta para iniciar"
  | "Em andamento"
  | "Concluída"
  | "Reprovada"
  | "Cancelada";

type TripListItem = {
  id: string;
  backendId?: string;
  group: "Hoje" | "Próximas";
  status: TripStatus;
  date: string;
  time: string;
  origin: string;
  destination: string;
  purpose: string;
  vehicle: string;
  plate: string;
  startedAtIso?: string | null;
  finishedAtIso?: string | null;
  initialOdometer?: string | null;
  finalOdometer?: string | null;
  finalObservation?: string | null;
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
  id: string;
  kind: "created" | "updated" | "inProgress" | "completed" | "reminder";
  title: string;
  tripId: string;
  detail: string;
  time: string;
  read?: boolean;
};

type FuelRecord = {
  id: string;
  odometer: string;
  liters: string;
  total: string;
  date: string;
  time: string;
  photoPreview: string;
};

type IncidentRecord = {
  id: string;
  description: string;
  date: string;
  time: string;
  photoPreview: string | null;
};

const NotificationCountContext = createContext(0);
const READ_NOTIFICATIONS_STORAGE_KEY = "frota_read_notifications_v1";

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

function loadReadNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function saveReadNotificationIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(READ_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignora falhas de armazenamento
  }
}

function extractSessionUser(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  if (isRecord(raw.usuario)) return raw.usuario;
  if (isRecord(raw.user)) return raw.user;
  if (isRecord(raw.data)) return raw.data;
  return raw;
}

function hasMotoristaTag(raw: unknown): boolean {
  const usuario = extractSessionUser(raw);
  if (!usuario) return false;

  const perfil =
    typeof usuario.perfil === "string"
      ? usuario.perfil
      : typeof usuario.role === "string"
        ? usuario.role
        : "";
  if (perfil.trim().toUpperCase() === "MOTORISTA") {
    return true;
  }

  const tags = Array.isArray(usuario.tags)
    ? usuario.tags
    : Array.isArray(usuario.perfis)
      ? usuario.perfis
      : [];
  return tags.some(
    (tag) => typeof tag === "string" && tag.trim().toUpperCase() === "MOTORISTA",
  );
}

/** Executa requisições GET autenticadas para consulta de dados. */
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

/** Converte a imagem para JPEG <= 1 MiB e monta { nome, tipo, dadosBase64 } para evidenciaArquivoSchema. */
async function buildEvidenciaArquivo(dataUrl: string, fallbackName: string) {
  const maxBase64Chars = 1398100; // <= 1 MiB decodificado e dentro do limite de 1398104 do schema
  const base64FromDataUrl = (url: string) => {
    const match = url.match(/^data:[^;]+;base64,(.+)$/);
    return (match?.[1] ?? url).replace(/[^A-Za-z0-9+/=]/g, "");
  };

  const dadosBase64 = await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const qualities = [0.78, 0.62, 0.45];
      const maxDims = [1024, 800, 640];

      for (const maxDim of maxDims) {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        for (const quality of qualities) {
          const b64 = base64FromDataUrl(canvas.toDataURL("image/jpeg", quality));
          if (b64.length > 0 && b64.length <= maxBase64Chars) {
            resolve(b64);
            return;
          }
        }
      }

      resolve(base64FromDataUrl(dataUrl));
    };
    img.onerror = () => resolve(base64FromDataUrl(dataUrl));
    img.src = dataUrl;
  });

  const controlCharsRegex = new RegExp("[\\x00-\\x1f\\x7f]", "g");
  const cleanName = fallbackName
    .replace(/[/\\]/g, "_")
    .replace(controlCharsRegex, "")
    .replace(/\.[^.]+$/, ".jpg")
    .trim() || "odometro.jpg";

  return {
    nome: cleanName.slice(0, 255),
    tipo: "image/jpeg" as const,
    dadosBase64,
  };
}

/** Sincroniza transições de status da viagem usando PATCH (com fallback POST/PUT) e expõe detalhes de erro. */
async function syncTripTransition(path: string, body: Record<string, unknown>): Promise<void> {
  const token = getStoredToken();
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const methods = ["PATCH", "POST", "PUT"] as const;
  let response: Response | null = null;

  for (const method of methods) {
    response = await fetch(getApiUrl(path), {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (response.status !== 405) {
      break;
    }
  }

  if (!response || !response.ok) {
    const errPayload: unknown = response ? await response.json().catch(() => null) : null;
    const errObj = isRecord(errPayload) && isRecord(errPayload.error) ? errPayload.error : null;
    const baseMessage =
      (errObj && typeof errObj.message === "string" && errObj.message) ||
      (isRecord(errPayload) && typeof errPayload.message === "string" && errPayload.message) ||
      `Erro ao sincronizar status da viagem (HTTP ${response?.status ?? 500}).`;

    const rawDetails = errObj?.details ?? errObj?.detalhes ?? errObj?.issues ?? errObj?.campos;
    const detailText = rawDetails ? ` (${JSON.stringify(rawDetails)})` : "";
    throw new Error(`${baseMessage}${detailText}`);
  }
}

/** Envia requisições POST autenticadas tolerando rotas ainda não implementadas no backend. */
async function tryPostJson(path: string, body: Record<string, unknown>): Promise<void> {
  const token = getStoredToken();
  if (!token) return;

  try {
    const response = await fetch(getApiUrl(path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok && response.status !== 404 && response.status !== 405 && response.status !== 501) {
      const errPayload: unknown = await response.json().catch(() => null);
      const errObj = isRecord(errPayload) && isRecord(errPayload.error) ? errPayload.error : null;
      if (errObj && typeof errObj.message === "string") {
        throw new Error(errObj.message);
      }
    }
  } catch (error) {
    if (error instanceof Error && !(error instanceof TypeError)) {
      throw error;
    }
  }
}

/** Autentica no backend, valida a tag/perfil de motorista e guarda o JWT na mesma chave usada pelo app. */
async function loginWithBackend(email: string, senha: string): Promise<DriverProfile | null> {
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

  const sessionResponse = await fetch(getApiUrl(API_SESSION_PATH), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${payload.token}`,
    },
  });
  const sessionPayload: unknown = await sessionResponse.json().catch(() => null);

  if (!sessionResponse.ok) {
    sessionStorage.removeItem("token");
    throw new Error("Não foi possível validar as permissões do usuário.");
  }

  const sessionUser = extractSessionUser(sessionPayload);
  const userSource =
    sessionUser &&
    ("perfil" in sessionUser ||
      "role" in sessionUser ||
      "tags" in sessionUser ||
      "perfis" in sessionUser ||
      "id" in sessionUser)
      ? sessionPayload
      : payload;

  if (!hasMotoristaTag(userSource)) {
    sessionStorage.removeItem("token");
    throw new Error("Acesso negado: este usuário não possui perfil de motorista.");
  }

  sessionStorage.setItem("token", payload.token);
  return toDriverProfile(userSource);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function normalizeTripStatus(rawValue: unknown): TripStatus {
  const normalized = String(rawValue ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");

  switch (normalized) {
    case "PENDENTE":
    case "AGUARDANDO_APROVACAO":
      return "Pendente";
    case "APROVADA":
    case "APROVADO":
      return "Aprovada";
    case "PRONTA_PARA_INICIAR":
    case "PRONTA":
      return "Pronta para iniciar";
    case "EM_TRANSPORTE":
    case "EM_ANDAMENTO":
      return "Em andamento";
    case "CONCLUIDA":
    case "CONCLUIDO":
    case "FINALIZADA":
    case "FINALIZADO":
      return "Concluída";
    case "REPROVADA":
    case "REPROVADO":
    case "RECUSADA":
    case "RECUSADO":
      return "Reprovada";
    case "CANCELADA":
    case "CANCELADO":
      return "Cancelada";
    case "AGENDADA":
    case "AGENDADO":
    default:
      return "Agendada";
  }
}

function getTripStatusBadgeClass(status: TripStatus): string {
  switch (status) {
    case "Pendente":
      return "status-pending";
    case "Aprovada":
      return "status-approved";
    case "Em andamento":
      return "status-progress";
    case "Concluída":
      return "status-completed";
    case "Reprovada":
    case "Cancelada":
      return "status-rejected";
    case "Pronta para iniciar":
    case "Agendada":
    default:
      return "status-scheduled";
  }
}

function isClosedTripStatus(status: TripStatus): boolean {
  return status === "Concluída" || status === "Reprovada" || status === "Cancelada";
}

/** Prioriza viagens "Em andamento" acima de qualquer outra viagem não encerrada. */
function comparePendingTrips(a: TripListItem, b: TripListItem): number {
  const aInProgress = a.status === "Em andamento" ? 0 : 1;
  const bInProgress = b.status === "Em andamento" ? 0 : 1;
  return aInProgress - bInProgress;
}

function extractNumericTripId(trip: Pick<TripListItem, "id" | "backendId">): string | null {
  if (trip.backendId && /^-?\d+$/.test(trip.backendId)) {
    return trip.backendId;
  }
  if (/^-?\d+$/.test(trip.id)) {
    return trip.id;
  }
  const codeMatch = trip.id.match(/^#?[A-Za-z]+-(-?\d+)$/);
  return codeMatch ? codeMatch[1] : null;
}

function toTripListItem(raw: unknown): TripListItem | null {
  if (!isRecord(raw)) return null;

  const rawCodigo = firstNonEmptyString(raw.codigo, raw.codigoExibicao);
  const rawId = raw.id != null ? String(raw.id).trim() : "";
  const id = rawCodigo || rawId;
  if (!id) return null;

  const displayCode = id.replace(/^#/, "");
  const numericFromId = /^-?\d+$/.test(rawId) ? rawId : null;
  const numericFromCode = displayCode.match(/^[A-Za-z]+-(-?\d+)$/)?.[1] ?? null;
  const backendId = numericFromId ?? numericFromCode ?? undefined;

  const solicitacao = isRecord(raw.solicitacao) ? raw.solicitacao : null;
  const agendamento = isRecord(raw.agendamento) ? raw.agendamento : null;

  const rawStatusValue = firstNonEmptyString(
    raw.status,
    solicitacao?.status,
    agendamento?.status,
  );
  const status = normalizeTripStatus(rawStatusValue);

  const dateStr = firstNonEmptyString(
    raw.dataHoraSaida,
    raw.data_hora_saida,
    raw.dataHoraInicio,
    raw.data_hora_inicio,
    raw.dataInicio,
    raw.data_inicio,
    raw.dataSaida,
    raw.data_saida,
    solicitacao?.dataHoraSaida,
    solicitacao?.data_hora_saida,
    agendamento?.dataHoraSaida,
    agendamento?.data_hora_saida,
    raw.date !== "Data não informada" ? raw.date : null,
  );

  let formattedDate = "Data não informada";
  let formattedTime = "—";
  let group: "Hoje" | "Próximas" =
    status === "Em andamento" || isClosedTripStatus(status) ? "Hoje" : "Próximas";

  if (dateStr) {
    const parsed = new Date(dateStr);
    if (!Number.isNaN(parsed.getTime())) {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startOfTarget = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());

      group = status === "Em andamento" || startOfTarget.getTime() <= startOfToday.getTime() ? "Hoje" : "Próximas";
      formattedDate = parsed.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      formattedTime = parsed.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      formattedDate = dateStr;
    }
  }

  const explicitTime = firstNonEmptyString(raw.horario, raw.horaSaida, raw.hora_saida, raw.time);
  if (explicitTime && explicitTime !== "—") {
    formattedTime = explicitTime;
  }

  const origin =
    firstNonEmptyString(raw.origem, solicitacao?.origem, raw.origin) ?? "Origem não informada";
  const destination =
    firstNonEmptyString(raw.destino, solicitacao?.destino, raw.destination) ??
    "Destino não informada";
  const purpose =
    firstNonEmptyString(
      raw.finalidade,
      raw.objetivo,
      raw.motivo,
      raw.descricao,
      solicitacao?.finalidade,
      solicitacao?.objetivo,
      solicitacao?.motivo,
      raw.purpose,
    ) ?? "—";

  const veiculoObj = isRecord(raw.veiculo)
    ? raw.veiculo
    : solicitacao && isRecord(solicitacao.veiculo)
      ? solicitacao.veiculo
      : agendamento && isRecord(agendamento.veiculo)
        ? agendamento.veiculo
        : null;

  const vehicle =
    firstNonEmptyString(
      veiculoObj?.modelo,
      veiculoObj?.nome,
      veiculoObj?.descricao,
      raw.veiculoModelo,
      raw.veiculo_modelo,
      raw.modeloVeiculo,
      raw.modelo_veiculo,
      raw.vehicle !== "—" ? raw.vehicle : null,
    ) ?? "—";

  const plate =
    firstNonEmptyString(
      veiculoObj?.placa,
      raw.veiculoPlaca,
      raw.veiculo_placa,
      raw.placaVeiculo,
      raw.placa_veiculo,
      raw.plate !== "—" ? raw.plate : null,
    ) ?? "—";

  const startedAtIso = firstNonEmptyString(
    raw.dataHoraInicioReal,
    raw.data_hora_inicio_real,
    raw.iniciadaEm,
    raw.iniciada_em,
  );
  const finishedAtIso = firstNonEmptyString(
    raw.dataHoraConclusao,
    raw.data_hora_conclusao,
    raw.concluidaEm,
    raw.concluida_em,
  );

  const rawKmInicial = raw.kmInicial ?? raw.km_inicial ?? raw.quilometragemInicial ?? raw.quilometragem_inicial;
  const rawKmFinal = raw.kmFinal ?? raw.km_final ?? raw.quilometragemFinal ?? raw.quilometragem_final;

  return {
    id: displayCode,
    backendId,
    group: status === "Em andamento" ? "Hoje" : raw.group === "Hoje" || raw.group === "Próximas" ? raw.group : group,
    status,
    date: formattedDate,
    time: formattedTime,
    origin,
    destination,
    purpose,
    vehicle,
    plate,
    startedAtIso,
    finishedAtIso,
    initialOdometer: rawKmInicial != null ? String(rawKmInicial) : null,
    finalOdometer: rawKmFinal != null ? String(rawKmFinal) : null,
  };
}

function parseBackendTrips(payload: unknown): TripListItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("Formato inesperado na resposta de viagens.");
  }
  return payload.data
    .map(toTripListItem)
    .filter((trip): trip is TripListItem => trip !== null);
}

function mergeTripDetails(base: TripListItem, detailed: TripListItem): TripListItem {
  const isLocallyProgressed = base.status === "Em andamento" || base.status === "Concluída";
  return {
    ...base,
    ...detailed,
    backendId: detailed.backendId ?? base.backendId,
    status: isLocallyProgressed ? base.status : detailed.status,
    group: isLocallyProgressed ? base.group : detailed.group,
    date: detailed.date !== "Data não informada" ? detailed.date : base.date,
    time: detailed.time !== "—" ? detailed.time : base.time,
    origin: detailed.origin !== "Origem não informada" ? detailed.origin : base.origin,
    destination: detailed.destination !== "Destino não informada" ? detailed.destination : base.destination,
    purpose: detailed.purpose !== "—" ? detailed.purpose : base.purpose,
    vehicle: detailed.vehicle !== "—" ? detailed.vehicle : base.vehicle,
    plate: detailed.plate !== "—" ? detailed.plate : base.plate,
    startedAtIso: base.startedAtIso ?? detailed.startedAtIso,
    finishedAtIso: base.finishedAtIso ?? detailed.finishedAtIso,
    initialOdometer: base.initialOdometer ?? detailed.initialOdometer,
    finalOdometer: base.finalOdometer ?? detailed.finalOdometer,
    finalObservation: base.finalObservation ?? detailed.finalObservation,
  };
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

  const read = Boolean(raw.lida ?? raw.read ?? false);

  return {
    id,
    kind,
    title,
    tripId,
    detail,
    time: formattedTime,
    read,
  };
}

function toDriverProfile(raw: unknown): DriverProfile | null {
  const usuario = extractSessionUser(raw);
  if (!usuario) return null;

  const name = typeof usuario.nome === "string"
    ? usuario.nome
    : typeof usuario.displayName === "string"
      ? usuario.displayName
      : "Motorista";

  const rawPerfil = typeof usuario.perfil === "string" ? usuario.perfil : typeof usuario.role === "string" ? usuario.role : "";
  const role = rawPerfil.toUpperCase() === "MOTORISTA" || hasMotoristaTag(raw) ? "Motorista Operacional" : rawPerfil || "Motorista";
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

/** Modal de câmera reutilizável para captura de fotos do painel/odômetro e ocorrências. */
function CameraCaptureModal({
  isOpen,
  title,
  instruction,
  fallbackFileName,
  onClose,
  onCapture,
}: {
  isOpen: boolean;
  title: string;
  instruction: string;
  fallbackFileName: string;
  onClose: () => void;
  onCapture: (dataUrl: string, fileName: string) => void;
}) {
  const cameraCaptureInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraRequesting, setCameraRequesting] = useState(false);
  const [cameraFallbackHint, setCameraFallbackHint] = useState<string | null>(null);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const handleClose = useCallback(() => {
    stopCameraStream();
    setCameraRequesting(false);
    setCameraFallbackHint(null);
    onClose();
  }, [onClose, stopCameraStream]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setCameraRequesting(true);
    setCameraFallbackHint(null);
    setCameraActive(false);

    async function startCamera() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraRequesting(false);
          setCameraFallbackHint("Toque no botão abaixo para abrir a câmera do dispositivo.");
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setCameraRequesting(false);
        setCameraActive(true);
      } catch {
        if (!cancelled) {
          setCameraRequesting(false);
          setCameraActive(false);
          setCameraFallbackHint("Permissão indisponível neste navegador. Toque abaixo para usar a câmera do celular.");
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [isOpen, stopCameraStream]);

  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {});
  }, [cameraActive]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  function handleCaptureClick() {
    const video = videoRef.current;
    if (cameraActive && video && video.videoWidth > 0 && video.videoHeight > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        handleClose();
        onCapture(dataUrl, fallbackFileName);
        return;
      }
    }
    cameraCaptureInputRef.current?.click();
  }

  function handleFallbackFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.currentTarget.files?.[0];
    if (!selectedPhoto || !selectedPhoto.type.startsWith("image/")) {
      event.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleClose();
        onCapture(reader.result, selectedPhoto.name);
      }
    };
    reader.readAsDataURL(selectedPhoto);
    event.currentTarget.value = "";
  }

  return (
    <div
      className="odometer-capture-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="odometer-capture-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="odometer-capture-card">
        <div className="odometer-capture-header">
          <span id="odometer-capture-title">{title}</span>
          <button
            className="odometer-capture-close"
            type="button"
            aria-label="Fechar câmera"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        <div className="odometer-capture-viewfinder">
          {cameraActive ? (
            <>
              <video
                ref={videoRef}
                className="odometer-capture-video"
                autoPlay
                playsInline
                muted
              />
              <span className="odometer-capture-simulation-label is-live">câmera ativa</span>
              <p className="odometer-capture-instruction is-overlay">{instruction}</p>
            </>
          ) : (
            <>
              <span className="odometer-capture-simulation-label">
                {cameraRequesting ? "abrindo câmera…" : "câmera do dispositivo"}
              </span>
              <CameraIcon />
              <p className="odometer-capture-instruction">{instruction}</p>
              {cameraFallbackHint && (
                <p className="odometer-capture-fallback-note">{cameraFallbackHint}</p>
              )}
            </>
          )}
        </div>

        <div className="odometer-capture-action">
          <button
            className="odometer-capture-button"
            type="button"
            aria-label="Toque para capturar a foto"
            onClick={handleCaptureClick}
          >
            <CameraIcon />
          </button>
          <span>Toque para capturar a foto</span>
        </div>

        <input
          ref={cameraCaptureInputRef}
          className="visually-hidden-input"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Capturar foto pela câmera"
          onChange={handleFallbackFileChange}
        />
      </div>
    </div>
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
  const pendingTrips = trips
    .filter((trip) => !isClosedTripStatus(trip.status))
    .sort(comparePendingTrips);
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
          <div className="trip-card-top">
            <span className="eyebrow blue-text">
              {featuredTrip.status === "Em andamento" ? "VIAGEM EM ANDAMENTO" : "PRÓXIMA VIAGEM"}
            </span>
            <span className={`status-pill ${getTripStatusBadgeClass(featuredTrip.status)}`}>
              {featuredTrip.status}
            </span>
          </div>
          <div className="trip-title-row"><h2>#{featuredTrip.id}</h2><span className="time-pill"><CalendarIcon />{featuredTrip.time}</span></div>
          <p className="trip-destination">{featuredTrip.origin}</p>
          <p className="destination-label">até</p>
          <p className="trip-destination">{featuredTrip.destination}</p>
          <div className="vehicle-line"><TruckIcon />Veículo {featuredTrip.vehicle} • {featuredTrip.plate}</div>
          <button className="view-trip-button" type="button" onClick={() => onViewTrip(featuredTrip)}>
            {featuredTrip.status === "Em andamento" ? "Continuar viagem" : "Ver viagem"}
          </button>
          <p className="trip-date">{featuredTrip.date} • {featuredTrip.time}</p>
        </article> : <article className="next-trip-card"><p style={{ margin: 0 }}>Você não tem viagens pendentes.</p></article>)}
        <div className="upcoming-heading"><h2>Próximas viagens</h2><button type="button" onClick={onTrips}>Ver todas <span>›</span></button></div>
        {!isLoading && !loadError && otherTrips.map((trip) => <button className="upcoming-trip-card" type="button" key={trip.id} onClick={() => onViewTrip(trip)} style={{ width: "100%", textAlign: "left", font: "inherit", cursor: "pointer" }}>
          <div className="upcoming-top">
            <strong>#{trip.id}</strong>
            <span className={`status-pill ${getTripStatusBadgeClass(trip.status)}`}>{trip.status}</span>
          </div>
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
  const visibleTrips =
    activeTab === "Hoje"
      ? trips.filter((trip) => trip.group === "Hoje" || trip.status === "Em andamento").sort(comparePendingTrips)
      : activeTab === "Próximas"
        ? trips.filter((trip) => trip.group === "Próximas" && !isClosedTripStatus(trip.status) && trip.status !== "Em andamento").sort(comparePendingTrips)
        : trips.filter((trip) => isClosedTripStatus(trip.status));

  const tabCounts = {
    Hoje: trips.filter((trip) => trip.group === "Hoje" || trip.status === "Em andamento").length,
    Próximas: trips.filter((trip) => trip.group === "Próximas" && !isClosedTripStatus(trip.status) && trip.status !== "Em andamento").length,
    Concluídas: trips.filter((trip) => isClosedTripStatus(trip.status)).length,
  };

  return (
    <main className="trips-page trip-list-page">
      <header className="trips-header trip-list-header"><h1>Minhas viagens</h1><p>Somente as viagens atribuídas a você</p></header>
      <section className="trips-content trip-list-content" aria-label="Lista de viagens">
        <div className="trip-filter-tabs" role="tablist" aria-label="Filtrar viagens">
          {(["Hoje", "Próximas", "Concluídas"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={`trip-filter-tab${activeTab === tab ? " selected" : ""}`} onClick={() => onTabChange(tab)}><span>{tab}</span><small>{tabCounts[tab]}</small></button>)}
        </div>
        <ApiLoadStatus isLoading={isLoading} error={loadError} onRetry={onRetry} />
        {!isLoading && !loadError && (visibleTrips.length ? visibleTrips.map((trip) => <button className="trip-list-card" type="button" key={trip.id} onClick={() => onSelectTrip(trip)} aria-label={`Ver detalhes da viagem ${trip.id}`}>
          <div className="trip-list-card-head">
            <strong>#{trip.id}</strong>
            <span className={`trip-card-status ${getTripStatusBadgeClass(trip.status)}`}>{trip.status}</span>
          </div>
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
      <header className="trips-header details-header trip-info-header"><button className="trip-info-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button><h1>Detalhes da viagem</h1></header>
      <section className="trips-content details-content trip-info-content">
        <article className="detail-card trip-info-card">
          <div className="detail-title-row">
            <h2>#{trip.id}</h2>
            <span className={`trip-info-status ${getTripStatusBadgeClass(trip.status)}`}>{trip.status}</span>
          </div>
          <div className="detail-row"><span>Data</span><strong>{trip.date}</strong></div>
          <div className="detail-row"><span>Horário</span><strong>{trip.time}</strong></div>
          <div className="detail-row"><span>Finalidade</span><strong>{trip.purpose || "—"}</strong></div>
        </article>
        <article className="detail-card trip-info-card"><p className="detail-section-label">TRAJETO</p><div className="trip-info-route"><div className="trip-info-route-row"><span className="trip-info-route-dot"/><div><small>Origem</small><strong>{trip.origin}</strong></div></div><div className="trip-info-route-row"><span className="trip-info-route-dot"/><div><small>Destino</small><strong>{trip.destination}</strong></div></div></div></article>
        <article className="detail-card vehicle-card trip-info-card"><p className="detail-section-label">VEÍCULO ATRIBUÍDO</p><div className="detail-vehicle"><span className="vehicle-icon"><TruckIcon/></span><div><strong>{trip.vehicle}</strong><span>{trip.plate}</span></div></div></article>
      </section>
      <BottomNavigation active="none" onHome={onHome} onTrips={onTrips} onNotifications={onNotifications} onProfile={onProfile}/>
    </main>
  );
}

function DetailsScreen({ trip, onBack, onStart, onContinue, onHome, onTrips, onNotifications, onProfile, hasStarted, hasFinished, showSuccess, startedAt, finishedAt, initialOdometer, finalOdometer }: { trip: TripListItem; onBack: () => void; onStart: () => void; onContinue: () => void; onHome: () => void; onTrips: () => void; onNotifications: () => void; onProfile: () => void; hasStarted: boolean; hasFinished: boolean; showSuccess: boolean; startedAt: Date | null; finishedAt: Date | null; initialOdometer: string | null; finalOdometer: string | null }) {
  const isBlocked = trip.status === "Reprovada" || trip.status === "Cancelada";

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
          <div className="detail-title-row">
            <h2>#{trip.id}</h2>
            <span className={`status-pill ${getTripStatusBadgeClass(trip.status)}${hasStarted && !hasFinished ? " trip-in-progress" : ""}`}>
              {trip.status}
            </span>
          </div>
          <div className="detail-row"><span>Data</span><strong>{trip.date}</strong></div>
          <div className="detail-row"><span>Horário</span><strong>{trip.time}</strong></div>
          <div className="detail-row"><span>Finalidade</span><strong>{trip.purpose || "—"}</strong></div>
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
        {hasFinished || isBlocked ? (
          <>
            <button className="start-trip-button" type="button" disabled>
              <CheckIcon /> {isBlocked ? trip.status.toUpperCase() : "VIAGEM FINALIZADA"}
            </button>
            <p>{isBlocked ? "Esta solicitação não está disponível para execução." : "Viagem encerrada."}</p>
          </>
        ) : (
          <>
            <button className="start-trip-button" type="button" onClick={hasStarted ? onContinue : onStart}><span aria-hidden="true">▷</span> {hasStarted ? "CONTINUAR VIAGEM" : "INICIAR VIAGEM"}</button>
            <p>{hasStarted ? "Acompanhe a viagem, registre ocorrências ou finalize ao chegar." : "Será necessário registrar o odômetro antes de sair."}</p>
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
  fuelCount,
  incidentCount,
  statusBanner,
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
  fuelCount: number;
  incidentCount: number;
  statusBanner: string | null;
}) {
  const startTime = startedAt
    ? startedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <main className="trips-page in-progress-page">
      <header className="trips-header in-progress-header">
        <h1>Viagem em andamento</h1>
        <p>Registre abastecimentos, ocorrências ou finalize ao chegar ao destino.</p>
      </header>

      <section className="trips-content in-progress-content">
        {statusBanner && (
          <div className="in-progress-toast" role="status" aria-live="polite">
            <CheckIcon />
            <span>{statusBanner}</span>
          </div>
        )}

        <article className="detail-card progress-trip-card">
          <div className="progress-trip-top">
            <span className="eyebrow blue-text">EM DESLOCAMENTO</span>
            <span className="progress-status"><i /> {trip.status.toUpperCase()}</span>
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
            <FuelIcon />
            <span>Registrar abastecimento</span>
            {fuelCount > 0 && <em className="trip-record-count">{fuelCount}</em>}
            <b aria-hidden="true">›</b>
          </button>
          <button className="trip-record-button" type="button" onClick={onReportIncident}>
            <IncidentIcon />
            <span>Registrar ocorrência</span>
            {incidentCount > 0 && <em className="trip-record-count">{incidentCount}</em>}
            <b aria-hidden="true">›</b>
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

function IncidentRegistrationScreen({
  trip,
  onBack,
  onSaveIncident,
}: {
  trip: TripListItem;
  onBack: () => void;
  onSaveIncident: (record: IncidentRecord) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const now = new Date();
  const dateText = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeText = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);
    if (!description.trim() || submitting) return;

    setSubmitting(true);
    try {
      const recordedAt = new Date();
      await onSaveIncident({
        id: `INC-${Date.now()}`,
        description: description.trim(),
        date: recordedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
        time: recordedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        photoPreview,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível registrar a ocorrência.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="trips-page incident-registration-page">
      <header className="trips-header details-header back-header-animated incident-header">
        <button className="details-back incident-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button>
        <h1>Registrar ocorrência</h1>
      </header>

      <form className="trips-content incident-content" onSubmit={(e) => { void handleSubmit(e); }} noValidate>
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
                <img className="incident-photo-preview" src={photoPreview} alt="Foto da ocorrência" />
                <div className="incident-photo-actions">
                  <span className="incident-photo-registered-badge">Foto registrada</span>
                  <button className="incident-retake-button" type="button" onClick={() => setPhotoPreview(null)}>Remover foto</button>
                </div>
              </>
            ) : (
              <>
                <span className="incident-camera-placeholder"><CameraIcon /></span>
                <p className="incident-photo-copy">Se possível, fotografe o problema identificado no veículo.</p>
                <button className="incident-camera-button" type="button" onClick={() => setIsCameraOpen(true)}><CameraIcon />Tirar foto</button>
                <button className="incident-file-button" type="button" onClick={() => fileInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={fileInputRef} className="incident-hidden-input" type="file" accept="image/*" onChange={handlePhotoChange} aria-label="Escolher foto da ocorrência" />
          </div>
        </article>

        <div className="incident-lock-note">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          <span>A ocorrência será enviada ao responsável da operação junto com a viagem e o veículo.</span>
        </div>
      </form>
      {submitError && <p className="incident-save-notice" role="alert">{submitError}</p>}
      <footer className="incident-footer">
        <button
          className="incident-submit-button"
          type="button"
          disabled={submitting}
          onClick={(event) => event.currentTarget.closest(".incident-registration-page")?.querySelector("form")?.requestSubmit()}
        >
          <IncidentIcon />
          <span>{submitting ? "Registrando…" : "Registrar ocorrência"}</span>
        </button>
      </footer>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        title="Foto da ocorrência"
        instruction="Enquadre o problema identificado no veículo."
        fallbackFileName="ocorrencia.jpg"
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => setPhotoPreview(dataUrl)}
      />
    </main>
  );
}

function FuelRegistrationScreen({
  trip,
  onBack,
  onSaveFuel,
  showMissingErrors = false,
}: {
  trip: TripListItem;
  onBack: () => void;
  onSaveFuel: (record: FuelRecord) => Promise<void> | void;
  showMissingErrors?: boolean;
}) {
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [currentOdometer, setCurrentOdometer] = useState("");
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(showMissingErrors);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const now = new Date();
  const dateText = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeText = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const km = parseAmount(currentOdometer);
    const liters = parseAmount(quantity);
    const amount = parseAmount(total);
    setSubmitAttempted(true);
    setSubmitError(null);

    if (
      !Number.isFinite(km) ||
      km <= 0 ||
      !Number.isFinite(liters) ||
      liters <= 0 ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !receiptPreview ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const recordedAt = new Date();
      await onSaveFuel({
        id: `FUEL-${Date.now()}`,
        odometer: String(km),
        liters: liters.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }),
        total: amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        date: recordedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
        time: recordedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        photoPreview: receiptPreview,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível registrar o abastecimento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="trips-page fuel-registration-page">
      <header className="trips-header details-header back-header-animated fuel-header">
        <button className="details-back fuel-back" type="button" onClick={onBack}><span aria-hidden="true">‹</span> Voltar</button>
        <h1>Registrar abastecimento</h1>
      </header>

      <form className="trips-content fuel-content" onSubmit={(e) => { void handleSubmit(e); }}>
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
                  <img src={receiptPreview} alt="Foto do odômetro no abastecimento" />
                </div>
                <div className="fuel-photo-controls">
                  <span className="fuel-photo-badge">Foto registrada</span>
                  <button className="fuel-retake-photo" type="button" onClick={() => setReceiptPreview(null)}>Remover foto</button>
                </div>
              </>
            ) : (
              <>
                <span className="fuel-camera-placeholder"><CameraIcon /></span>
                <p className="fuel-receipt-copy">Registre uma foto do odômetro atual do veículo.</p>
                <button className="fuel-take-photo" type="button" onClick={() => setIsCameraOpen(true)}><CameraIcon />Tirar foto do painel</button>
                <button className="fuel-file-button" type="button" onClick={() => receiptInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={receiptInputRef} className="fuel-hidden-input" type="file" accept="image/*" onChange={handleReceiptChange} aria-label="Selecionar imagem do odômetro"/>
            {submitAttempted && !receiptPreview && <p className="fuel-photo-error" role="alert">Selecione uma foto do odômetro.</p>}
          </div>
        </article>
        <div aria-hidden="true" style={{ height: 2, flex: "0 0 2px" }} />
      </form>
      {submitError && <p className="fuel-save-notice" role="alert">{submitError}</p>}
      <footer className="fuel-register-footer">
        <button
          className="fuel-register-button"
          type="button"
          disabled={submitting}
          onClick={(event) => {
            const form = event.currentTarget.closest(".fuel-registration-page")?.querySelector("form");
            form?.requestSubmit();
          }}
        >
          <FuelIcon />
          <span>{submitting ? "Registrando…" : "Registrar abastecimento"}</span>
        </button>
      </footer>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        title="Foto do odômetro"
        instruction="Aponte para o painel do veículo e enquadre o odômetro."
        fallbackFileName="odometro-abastecimento.jpg"
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => setReceiptPreview(dataUrl)}
      />
    </main>
  );
}

function FinishTripScreen({
  trip,
  onBack,
  onConfirmFinish,
  initialOdometer,
  startedAt,
}: {
  trip: TripListItem;
  onBack: () => void;
  onConfirmFinish: (data: {
    finalOdometer: string;
    finishedAtIso: string;
    finalPhoto: string;
    observation: string;
  }) => Promise<void> | void;
  initialOdometer: string | null;
  startedAt: Date | null;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [finalOdometer, setFinalOdometer] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [observation, setObservation] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialKm = Number((initialOdometer ?? "0").trim().replace(",", "."));
  const parsedFinalKm = Number(finalOdometer.trim().replace(",", "."));
  const kmEntered = finalOdometer.trim() !== "" && Number.isFinite(parsedFinalKm);
  const kmNotLower = kmEntered && parsedFinalKm >= initialKm;
  const photoRegistered = photoPreview !== null;
  const canConfirm = kmEntered && kmNotLower && photoRegistered && !submitting;
  const distance = kmNotLower ? Math.max(0, parsedFinalKm - initialKm) : null;
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

  async function handleConfirmClick() {
    if (!canConfirm || !photoPreview) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirmFinish({
        finalOdometer: String(Math.round(parsedFinalKm)),
        finishedAtIso: new Date().toISOString(),
        finalPhoto: photoPreview,
        observation: observation.trim(),
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar a finalização da viagem. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="trips-page finish-trip-page">
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
                <div className="finish-photo-preview"><img src={photoPreview ?? ""} alt="Foto final do odômetro" /></div>
                <div className="finish-photo-controls"><span className="finish-photo-badge">Foto registrada</span><button className="finish-retake-button" type="button" onClick={() => setPhotoPreview(null)}>Remover foto</button></div>
              </>
            ) : (
              <>
                <span className="finish-camera-placeholder"><CameraIcon /></span>
                <p className="finish-photo-copy">Registre a nova foto do painel para concluir a viagem.</p>
                <button className="finish-take-photo" type="button" onClick={() => setIsCameraOpen(true)}><CameraIcon />Tirar foto do painel</button>
                <button className="finish-file-button" type="button" onClick={() => fileInputRef.current?.click()}><ImageIcon />Usar arquivo do dispositivo</button>
              </>
            )}
            <input ref={fileInputRef} className="finish-hidden-input" type="file" accept="image/*" onChange={handlePhotoChange} aria-label="Escolher foto final do odômetro" />
          </div>
        </article>

        <article className="finish-trip-card">
          <label className="finish-note-label" htmlFor="finish-note">OBSERVAÇÃO FINAL (OPCIONAL)</label>
          <textarea
            id="finish-note"
            className="finish-note-input"
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Ex.: Sem intercorrências no trajeto."
          />
        </article>

        <div className="finish-validation" aria-live="polite">
          <p className={kmEntered ? "is-valid" : ""}>{kmEntered ? <CheckIcon /> : <AlertIcon />}<span>{kmEntered ? "Quilometragem final informada." : "Informe a quilometragem final."}</span></p>
          <p className={kmNotLower ? "is-valid" : ""}>{kmNotLower ? <CheckIcon /> : <AlertIcon />}<span>{kmNotLower ? "Quilometragem final válida." : `A quilometragem final não pode ser menor que a quilometragem inicial de ${initialKm} km.`}</span></p>
          <p className={photoRegistered ? "is-valid" : ""}>{photoRegistered ? <CheckIcon /> : <AlertIcon />}<span>{photoRegistered ? "Foto final do odômetro registrada." : "Registre uma foto final do odômetro."}</span></p>
        </div>
      </section>

      <footer className="finish-footer">
        {submitError && <p className="finish-trip-error" role="alert">{submitError}</p>}
        <button
          className="finish-confirm-button"
          type="button"
          disabled={!canConfirm}
          aria-disabled={!canConfirm}
          onClick={() => {
            void handleConfirmClick();
          }}
        >
          <CheckIcon />
          <span>{submitting ? "FINALIZANDO VIAGEM…" : "CONFIRMAR FINALIZAÇÃO"}</span>
        </button>
        <p>
          {canConfirm
            ? "Ao confirmar, a viagem será marcada como Concluída."
            : "Informe a quilometragem final e a foto do painel para concluir."}
        </p>
      </footer>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        title="Foto final do odômetro"
        instruction="Aponte para o painel do veículo e enquadre o odômetro final."
        fallbackFileName="odometro-final.jpg"
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl) => setPhotoPreview(dataUrl)}
      />
    </main>
  );
}

function StartTripScreen({
  trip,
  onBack,
  onConfirmStart,
}: {
  trip: TripListItem;
  onBack: () => void;
  onConfirmStart: (data: {
    initialOdometer: string;
    startedAtIso: string;
    initialPhoto: string;
  }) => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [odometer, setOdometer] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parsedOdometer = Number(odometer.trim().replace(",", "."));
  const hasValidOdometer =
    odometer.trim() !== "" &&
    Number.isFinite(parsedOdometer) &&
    parsedOdometer >= 0;
  const photoRegistered = photoPreview !== null;
  const canConfirm = hasValidOdometer && photoRegistered && !submitting;

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.currentTarget.files?.[0];
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
    event.currentTarget.value = "";
  }

  async function handleConfirmClick() {
    if (!canConfirm || !photoPreview) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onConfirmStart({
        initialOdometer: String(Math.round(parsedOdometer)),
        startedAtIso: new Date().toISOString(),
        initialPhoto: photoPreview,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o início da viagem. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="trips-page start-trip-page">
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
                  <img src={photoPreview ?? ""} alt="Foto do odômetro inicial" />
                </div>
                <div className="photo-registered-controls">
                  <span className="photo-registered-badge">Foto registrada</span>
                  <button
                    className="retake-photo-button"
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      setPhotoName("");
                      setIsCameraOpen(true);
                    }}
                  >
                    <span aria-hidden="true">↻</span>Tirar novamente
                  </button>
                </div>
                {photoName && <p className="photo-help">{photoName}</p>}
              </>
            ) : (
              <>
                <div className="camera-placeholder"><CameraIcon /></div>
                <p className="photo-help">A foto do painel é obrigatória para iniciar a viagem.</p>
                <button
                  className="take-photo-button"
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                >
                  <CameraIcon /><span>Tirar foto do painel</span>
                </button>
                <button
                  className="choose-file-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon /><span>Usar arquivo do dispositivo</span>
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              className="visually-hidden-input"
              type="file"
              accept="image/*"
              aria-label="Escolher arquivo de imagem do odômetro"
              onChange={handlePhotoChange}
            />
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
            {submitError && <p className="start-trip-error" role="alert">{submitError}</p>}
            <button
              className="confirm-start-button"
              type="button"
              disabled={!canConfirm}
              aria-disabled={!canConfirm}
              onClick={() => {
                void handleConfirmClick();
              }}
            >
              <CheckIcon />
              <span>{submitting ? "INICIANDO VIAGEM…" : "CONFIRMAR INÍCIO"}</span>
            </button>
            <p>
              {canConfirm
                ? "Ao confirmar, o status da viagem será alterado para Em andamento."
                : "Informe a quilometragem e registre a foto do painel para liberar o início."}
            </p>
          </div>
        </div>
      </section>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        title="Foto do odômetro"
        instruction="Aponte para o painel do veículo e enquadre o odômetro."
        fallbackFileName="odometro-inicial.jpg"
        onClose={() => setIsCameraOpen(false)}
        onCapture={(dataUrl, name) => {
          setPhotoPreview(dataUrl);
          setPhotoName(name);
        }}
      />
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
  fuelRecords,
  incidentRecords,
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
  fuelRecords: FuelRecord[];
  incidentRecords: IncidentRecord[];
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
      <header className="trips-header details-header completed-header">
        <div className="completed-toast" role="status" aria-live="polite"><CheckIcon /><span>Dados da viagem concluída.</span></div>
        <h1>Detalhes da viagem</h1>
      </header>
      <section className="trips-content details-content">
        <article className="detail-card">
          <div className="detail-title-row">
            <h2>#{trip.id}</h2>
            <span className={`completed-status ${getTripStatusBadgeClass(trip.status)}`}>{trip.status}</span>
          </div>
          <div className="detail-row"><span>Data</span><strong>{trip.date}</strong></div>
          <div className="detail-row"><span>Horário</span><strong>{trip.time}</strong></div>
          <div className="detail-row"><span>Finalidade</span><strong>{trip.purpose || "—"}</strong></div>
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
          {trip.finalObservation && (
            <div className="detail-row"><span>Observação</span><strong>{trip.finalObservation}</strong></div>
          )}
        </article>
        <article className="detail-card completed-evidence-card">
          <p className="detail-section-label">EVIDÊNCIAS</p>
          {initialPhoto || finalPhoto ? <>
            {initialPhoto && <div className="completed-evidence-row"><span className="completed-evidence-label">Foto inicial</span><img src={initialPhoto} alt="Foto do odômetro no início da viagem" /></div>}
            {finalPhoto && <div className="completed-evidence-row"><span className="completed-evidence-label">Foto final</span><img src={finalPhoto} alt="Foto do odômetro no encerramento da viagem" /></div>}
          </> : <div className="trip-list-empty">Nenhuma foto registrada.</div>}
        </article>
        <article className="detail-card">
          <p className="detail-section-label">ABASTECIMENTOS REGISTRADOS</p>
          {fuelRecords.length > 0 ? (
            <div className="completed-record-list">
              {fuelRecords.map((item) => (
                <div className="completed-record-item" key={item.id}>
                  <div className="completed-record-head">
                    <strong>{item.liters} L • R$ {item.total}</strong>
                    <span>{item.time}</span>
                  </div>
                  <p className="completed-record-meta">Odômetro: {item.odometer} km ({item.date})</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="trip-list-empty">Nenhum abastecimento registrado.</div>
          )}
        </article>
        <article className="detail-card">
          <p className="detail-section-label">OCORRÊNCIAS REGISTRADAS</p>
          {incidentRecords.length > 0 ? (
            <div className="completed-record-list">
              {incidentRecords.map((item) => (
                <div className="completed-record-item" key={item.id}>
                  <div className="completed-record-head">
                    <strong>{item.description}</strong>
                    <span>{item.time}</span>
                  </div>
                  <p className="completed-record-meta">Registrada em {item.date}</p>
                  {item.photoPreview && (
                    <img className="completed-record-thumb" src={item.photoPreview} alt="Foto da ocorrência registrada" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="trip-list-empty">Nenhuma ocorrência registrada.</div>
          )}
        </article>
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

function NotificationsScreen({
  notifications,
  onMarkAllAsRead,
  onHome,
  onTrips,
  onProfile,
  isLoading,
  loadError,
  onRetry,
}: {
  notifications: TripNotification[];
  onMarkAllAsRead: () => void;
  onHome: () => void;
  onTrips: () => void;
  onProfile: () => void;
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
}) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <main className="trips-page notifications-page">
      <header className="trips-header notifications-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1>Notificações</h1>
            <p>Avisos das suas viagens e veículos.</p>
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
      </header>
      <section className="trips-content notifications-content" aria-label="Avisos das viagens">
        <ApiLoadStatus isLoading={isLoading} error={loadError} onRetry={onRetry} />
        {!isLoading && !loadError && (notifications.length ? notifications.map((notification) => (
          <article
            className="notification-card"
            key={notification.id}
            style={{ opacity: notification.read ? 0.72 : 1 }}
          >
            <span className="notification-bell"><BellIcon /></span>
            <div className="notification-copy">
              <strong>{notification.title}</strong>
              <span className="notification-trip">#{notification.tripId}</span>
              <span className="notification-detail">{notification.detail}</span>
              <time className="notification-time">{notification.time}</time>
            </div>
          </article>
        )) : <div className="notifications-empty">Você não tem notificações no momento.</div>)}
        <p className="notifications-footer-note">Somente avisos das suas atividades de transporte.</p>
      </section>
      <BottomNavigation active="notifications" onHome={onHome} onTrips={onTrips} onNotifications={() => undefined} onProfile={onProfile} />
    </main>
  );
}

function AppContent({
  notifications,
  setNotifications,
  readNotificationIdsRef,
  onMarkAllAsRead,
}: {
  notifications: TripNotification[];
  setNotifications: (next: TripNotification[]) => void;
  readNotificationIdsRef: React.MutableRefObject<Set<string>>;
  onMarkAllAsRead: () => void;
}) {
  const [screen, setScreen] = useState<"login" | "trips" | "tripList" | "tripInfo" | "details" | "start" | "inProgress" | "fuel" | "incident" | "finish" | "completed" | "notifications" | "profile">("login");
  const [tripTab, setTripTab] = useState<"Hoje" | "Próximas" | "Concluídas">("Hoje");
  const [selectedTrip, setSelectedTrip] = useState<TripListItem | null>(null);
  const [tripListData, setTripListData] = useState<TripListItem[]>([]);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showStartSuccess, setShowStartSuccess] = useState(false);
  const [inProgressBanner, setInProgressBanner] = useState<string | null>(null);
  const [tripPhotos, setTripPhotos] = useState<Record<string, { initial?: string; final?: string }>>({});
  const [tripFuels, setTripFuels] = useState<Record<string, FuelRecord[]>>({});
  const [tripIncidents, setTripIncidents] = useState<Record<string, IncidentRecord[]>>({});

  const hasLoadedInitialDataRef = useRef(false);
  const localTripOverridesRef = useRef<Record<string, Partial<TripListItem>>>({});

  const fetchTripDetails = useCallback(async (trip: TripListItem, signal?: AbortSignal): Promise<TripListItem> => {
    const targetId = extractNumericTripId(trip);
    if (!targetId) return trip;
    const detailPayload = await getJson(getApiUrl(`/api/viagens/${targetId}`), signal);
    const parsed = isRecord(detailPayload) && "data" in detailPayload
      ? toTripListItem(detailPayload.data)
      : toTripListItem(detailPayload);
    return parsed ? mergeTripDetails(trip, parsed) : trip;
  }, []);

  const loadApiData = useCallback(async (signal?: AbortSignal) => {
    setApiLoading(true);
    setApiError(null);
    try {
      const tripsPayload = await getJson(getApiUrl(API_TRIPS_PATH), signal);
      const rawTrips = parseBackendTrips(tripsPayload);
      if (signal?.aborted) return;

      const enrichedResults = await Promise.allSettled(
        rawTrips.map(async (trip) => {
          const needsDetails =
            trip.date === "Data não informada" ||
            trip.vehicle === "—" ||
            trip.purpose === "—";
          if (!needsDetails) return trip;
          return fetchTripDetails(trip, signal);
        }),
      );
      if (signal?.aborted) return;

      const trips = enrichedResults.map((result, index) => {
        const baseTrip = result.status === "fulfilled" ? result.value : rawTrips[index];
        const override = localTripOverridesRef.current[baseTrip.id];
        return override ? { ...baseTrip, ...override } : baseTrip;
      });
      setTripListData(trips);

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
          .filter((item): item is TripNotification => item !== null)
          .map((item) => ({
            ...item,
            read: Boolean(item.read || readNotificationIdsRef.current.has(item.id)),
          }));
      }

      let driver: DriverProfile | null = null;
      if (sessionResult.status === "fulfilled") {
        if (!hasMotoristaTag(sessionResult.value)) {
          sessionStorage.removeItem("token");
          hasLoadedInitialDataRef.current = false;
          setDriverProfile(null);
          setTripListData([]);
          setSelectedTrip(null);
          setScreen("login");
          return;
        }
        driver = toDriverProfile(sessionResult.value);
      }
      if (signal?.aborted) return;
      setNotifications(nextNotifications);
      if (driver) setDriverProfile(driver);
      setSelectedTrip((current) => current ? trips.find((trip) => trip.id === current.id) ?? current : null);
    } catch (err) {
      if (signal?.aborted) return;
      console.warn("Não foi possível carregar as viagens da API:", err);
      setApiError(err instanceof Error ? err.message : "Não foi possível carregar as viagens. Verifique a conexão e tente novamente.");
    } finally {
      if (!signal?.aborted) setApiLoading(false);
    }
  }, [fetchTripDetails, readNotificationIdsRef, setNotifications]);

  useEffect(() => {
    if (screen === "login" || !getStoredToken() || hasLoadedInitialDataRef.current) {
      return;
    }
    hasLoadedInitialDataRef.current = true;
    const controller = new AbortController();
    void loadApiData(controller.signal);
    return () => controller.abort();
  }, [loadApiData, screen]);

  const hasStarted = selectedTrip?.status === "Em andamento";
  const hasFinished = selectedTrip?.status === "Concluída";
  const startedAt: Date | null = selectedTrip?.startedAtIso ? new Date(selectedTrip.startedAtIso) : null;
  const initialOdometer: string | null = selectedTrip?.initialOdometer ?? null;
  const finishedAt: Date | null = selectedTrip?.finishedAtIso ? new Date(selectedTrip.finishedAtIso) : null;
  const finalOdometer: string | null = selectedTrip?.finalOdometer ?? null;

  function openTrip(trip: TripListItem) {
    setShowStartSuccess(false);
    setInProgressBanner(null);
    setSelectedTrip(trip);
    setScreen(
      isClosedTripStatus(trip.status)
        ? "completed"
        : trip.status === "Em andamento"
          ? "inProgress"
          : "details",
    );

    void (async () => {
      try {
        const enriched = await fetchTripDetails(trip);
        const override = localTripOverridesRef.current[trip.id];
        const merged = override ? { ...mergeTripDetails(trip, enriched), ...override } : mergeTripDetails(trip, enriched);
        setSelectedTrip((current) => current?.id === trip.id ? merged : current);
        setTripListData((currentList) =>
          currentList.map((item) => (item.id === trip.id ? merged : item)),
        );
      } catch {
        // Silencioso se o detalhe específico não estiver disponível
      }
    })();
  }

  async function handleConfirmStartTrip(
    trip: TripListItem,
    payload: { initialOdometer: string; startedAtIso: string; initialPhoto: string },
  ) {
    const targetId = extractNumericTripId(trip);
    if (!targetId) {
      throw new Error("Identificador da viagem inválido para sincronização com o servidor.");
    }

    await syncTripTransition(`/api/viagens/${targetId}/iniciar`, {
      quilometragem: Number(payload.initialOdometer),
      foto: await buildEvidenciaArquivo(payload.initialPhoto, "odometro-inicial.jpg"),
    });

    const patch: Partial<TripListItem> = {
      status: "Em andamento",
      group: "Hoje",
      startedAtIso: payload.startedAtIso,
      initialOdometer: payload.initialOdometer,
    };
    localTripOverridesRef.current[trip.id] = {
      ...localTripOverridesRef.current[trip.id],
      ...patch,
    };

    const updatedTrip: TripListItem = { ...trip, ...patch };
    setTripListData((current) =>
      current.map((item) => (item.id === trip.id ? updatedTrip : item)),
    );
    setSelectedTrip(updatedTrip);
    setTripPhotos((current) => ({
      ...current,
      [trip.id]: {
        ...current[trip.id],
        initial: payload.initialPhoto,
      },
    }));
    setShowStartSuccess(true);
    setScreen("details");
  }

  async function handleSaveFuel(trip: TripListItem, record: FuelRecord) {
    const targetId = extractNumericTripId(trip);
    if (targetId) {
      await tryPostJson(`/api/viagens/${targetId}/abastecimentos`, {
        kmAtual: Number(record.odometer),
        litros: record.liters,
        valorTotal: record.total,
        fotoOdometro: record.photoPreview,
      });
    }

    setTripFuels((current) => ({
      ...current,
      [trip.id]: [...(current[trip.id] ?? []), record],
    }));
    setInProgressBanner("Abastecimento registrado com sucesso.");
    setScreen("inProgress");
  }

  async function handleSaveIncident(trip: TripListItem, record: IncidentRecord) {
    const targetId = extractNumericTripId(trip);
    if (targetId) {
      await tryPostJson(`/api/viagens/${targetId}/ocorrencias`, {
        descricao: record.description,
        foto: record.photoPreview,
      });
    }

    setTripIncidents((current) => ({
      ...current,
      [trip.id]: [...(current[trip.id] ?? []), record],
    }));
    setInProgressBanner("Ocorrência registrada com sucesso.");
    setScreen("inProgress");
  }

  async function handleConfirmFinishTrip(
    trip: TripListItem,
    payload: { finalOdometer: string; finishedAtIso: string; finalPhoto: string; observation: string },
  ) {
    const targetId = extractNumericTripId(trip);
    if (!targetId) {
      throw new Error("Identificador da viagem inválido para sincronização com o servidor.");
    }

    await syncTripTransition(`/api/viagens/${targetId}/concluir`, {
      quilometragem: Number(payload.finalOdometer),
      foto: await buildEvidenciaArquivo(payload.finalPhoto, "odometro-final.jpg"),
    });

    const patch: Partial<TripListItem> = {
      status: "Concluída",
      group: "Hoje",
      finishedAtIso: payload.finishedAtIso,
      finalOdometer: payload.finalOdometer,
      finalObservation: payload.observation || null,
    };
    localTripOverridesRef.current[trip.id] = {
      ...localTripOverridesRef.current[trip.id],
      ...patch,
    };

    const updatedTrip: TripListItem = { ...trip, ...patch };
    setTripListData((current) =>
      current.map((item) => (item.id === trip.id ? updatedTrip : item)),
    );
    setSelectedTrip(updatedTrip);
    setTripPhotos((current) => ({
      ...current,
      [trip.id]: {
        ...current[trip.id],
        final: payload.finalPhoto,
      },
    }));
    setInProgressBanner(null);
    setScreen("completed");
  }

  if (["start", "completed", "tripInfo", "finish", "fuel", "incident", "inProgress", "details"].includes(screen) && !selectedTrip) {
    return <TripsListScreen trips={tripListData} activeTab={tripTab} onTabChange={setTripTab} onSelectTrip={openTrip} onHome={() => setScreen("trips")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} isLoading={apiLoading} loadError={apiError} onRetry={() => { void loadApiData(); }} />;
  }

  if (screen === "start" && selectedTrip) {
    return (
      <StartTripScreen
        trip={selectedTrip}
        onBack={() => setScreen("details")}
        onConfirmStart={(payload) => handleConfirmStartTrip(selectedTrip, payload)}
      />
    );
  }

  if (screen === "completed" && selectedTrip) {
    return (
      <CompletedTripScreen
        trip={selectedTrip}
        startedAt={startedAt}
        finishedAt={finishedAt}
        initialOdometer={initialOdometer}
        finalOdometer={finalOdometer}
        initialPhoto={tripPhotos[selectedTrip.id]?.initial ?? null}
        finalPhoto={tripPhotos[selectedTrip.id]?.final ?? null}
        fuelRecords={tripFuels[selectedTrip.id] ?? []}
        incidentRecords={tripIncidents[selectedTrip.id] ?? []}
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
        onConfirmFinish={(payload) => handleConfirmFinishTrip(selectedTrip, payload)}
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
        onSaveFuel={(record) => handleSaveFuel(selectedTrip, record)}
      />
    );
  }

  if (screen === "incident" && selectedTrip) {
    return (
      <IncidentRegistrationScreen
        trip={selectedTrip}
        onBack={() => setScreen("inProgress")}
        onSaveIncident={(record) => handleSaveIncident(selectedTrip, record)}
      />
    );
  }

  if (screen === "inProgress" && selectedTrip) {
    return (
      <InProgressScreen
        trip={selectedTrip}
        onRecordFuel={() => {
          setInProgressBanner(null);
          setScreen("fuel");
        }}
        onReportIncident={() => {
          setInProgressBanner(null);
          setScreen("incident");
        }}
        onHome={() => {
          setInProgressBanner(null);
          setScreen("trips");
        }}
        onTrips={() => {
          setInProgressBanner(null);
          setScreen("tripList");
        }}
        onNotifications={() => {
          setInProgressBanner(null);
          setScreen("notifications");
        }}
        onProfile={() => {
          setInProgressBanner(null);
          setScreen("profile");
        }}
        onFinish={() => {
          setInProgressBanner(null);
          setScreen("finish");
        }}
        startedAt={startedAt}
        initialOdometer={initialOdometer}
        fuelCount={(tripFuels[selectedTrip.id] ?? []).length}
        incidentCount={(tripIncidents[selectedTrip.id] ?? []).length}
        statusBanner={inProgressBanner}
      />
    );
  }

  if (screen === "details" && selectedTrip) {
    return (
      <DetailsScreen
        trip={selectedTrip}
        onBack={() => {
          setShowStartSuccess(false);
          setScreen("trips");
        }}
        onHome={() => {
          setShowStartSuccess(false);
          setScreen("trips");
        }}
        onTrips={() => {
          setShowStartSuccess(false);
          setScreen("tripList");
        }}
        onNotifications={() => {
          setShowStartSuccess(false);
          setScreen("notifications");
        }}
        onProfile={() => {
          setShowStartSuccess(false);
          setScreen("profile");
        }}
        onStart={() => setScreen("start")}
        onContinue={() => {
          setShowStartSuccess(false);
          setScreen("inProgress");
        }}
        hasStarted={hasStarted}
        hasFinished={hasFinished}
        showSuccess={showStartSuccess}
        startedAt={startedAt}
        finishedAt={finishedAt}
        initialOdometer={initialOdometer}
        finalOdometer={finalOdometer}
      />
    );
  }

  if (screen === "tripInfo" && selectedTrip) return <TripInfoScreen trip={selectedTrip} onBack={() => setScreen("tripList")} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} />;
  if (screen === "notifications") {
    return (
      <NotificationsScreen
        notifications={notifications}
        onMarkAllAsRead={onMarkAllAsRead}
        onHome={() => setScreen("trips")}
        onTrips={() => setScreen("tripList")}
        onProfile={() => setScreen("profile")}
        isLoading={apiLoading}
        loadError={apiError}
        onRetry={() => { void loadApiData(); }}
      />
    );
  }
  if (screen === "profile") return <ProfileScreen onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onLogout={() => { sessionStorage.removeItem("token"); hasLoadedInitialDataRef.current = false; localTripOverridesRef.current = {}; setDriverProfile(null); setTripListData([]); setSelectedTrip(null); setScreen("login"); }} driver={driverProfile} />;
  if (screen === "tripList") return <TripsListScreen trips={tripListData} activeTab={tripTab} onTabChange={setTripTab} onSelectTrip={openTrip} onHome={() => setScreen("trips")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} isLoading={apiLoading} loadError={apiError} onRetry={() => { void loadApiData(); }} />;
  if (screen === "trips") return <HomeScreen trips={tripListData} driver={driverProfile} onViewTrip={openTrip} onHome={() => setScreen("trips")} onTrips={() => setScreen("tripList")} onNotifications={() => setScreen("notifications")} onProfile={() => setScreen("profile")} isLoading={apiLoading} loadError={apiError} onRetry={() => { void loadApiData(); }} />;
  return (
    <LoginScreen
      onLogin={async (email, senha) => {
        hasLoadedInitialDataRef.current = false;
        const profile = await loginWithBackend(email, senha);
        setDriverProfile(profile);
        setScreen("trips");
      }}
    />
  );
}

export default function App() {
  const [notifications, setNotifications] = useState<TripNotification[]>([]);
  const readNotificationIdsRef = useRef<Set<string>>(loadReadNotificationIds());

  const handleMarkAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = new Set(readNotificationIdsRef.current);
      for (const item of prev) {
        next.add(item.id);
      }
      readNotificationIdsRef.current = next;
      saveReadNotificationIds(next);
      return prev.map((item) => ({ ...item, read: true }));
    });
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <NotificationCountContext.Provider value={unreadCount}>
      <AppContent
        notifications={notifications}
        setNotifications={setNotifications}
        readNotificationIdsRef={readNotificationIdsRef}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
    </NotificationCountContext.Provider>
  );
}