import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PLAY_ROUTES } from "@/lib/routes";
import { seatNumber } from "@/lib/squad";

// Tipos y textos de las pichangas. Los valores (futbol_7, recreativo...) son los del servidor (shared/schema.ts).

export interface Venue {
  id: string;
  name: string;
  district: string;
  city: string;
  address: string | null;
  surface: string;
  pricePerHour: string | null;
  phone?: string | null;
  /** Coordenadas (se usan para el boton GPS del pase); null = solo hay direccion. */
  latitude?: string | null;
  longitude?: string | null;
  /** Fotos de la cancha (URLs); vacio = sin foto. */
  photos?: string[] | null;
}

/** Posiciones de juego (mismos valores que el servidor: shared/schema.ts PLAYER_POSITIONS). */
export const POSITION_OPTIONS = [
  { value: "portero", label: "Portero" },
  { value: "defensa", label: "Defensa" },
  { value: "mediocampista", label: "Mediocampista" },
  { value: "delantero", label: "Delantero" },
] as const;
export type PlayerPosition = (typeof POSITION_OPTIONS)[number]["value"];
export const PLAYER_AGE_MIN = 10;
export const PLAYER_AGE_MAX = 80;

export interface PlayerProfile {
  age: number | null;
  position: PlayerPosition | null;
  /** Perfil de host: puede crear y organizar partidos. */
  isHost: boolean;
}

/** Edad y posicion del jugador (guardadas en la base, tabla player_profiles). */
export function usePlayerProfile() {
  return useQuery<PlayerProfile>({ queryKey: ["/api/player/profile"] });
}

export interface MatchSummary {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMinutes: number;
  format: string;
  level: string;
  gender: string;
  maxPlayers: number;
  pricePerPlayer: string;
  status: string;
  organizerId: string;
  organizerName: string;
  /** Foto de perfil del organizador (URL); null = sin foto, se usan las iniciales. */
  organizerAvatar?: string | null;
  /** Portadas del partido (URLs; la primera es la principal). Vacio = se usan las fotos de la cancha. */
  photos?: string[] | null;
  venue: Venue;
  confirmedCount: number;
  /** Solo en /api/matches/mine: mi estado en el partido. */
  playerStatus?: "confirmed" | "waitlist";
  /** Solo en /api/matches/mine: si ya pague mi cupo (el pase solo existe despues de pagar). */
  playerPaid?: boolean;
  /** Solo en /api/matches/mine: acompañantes que inscribi. */
  playerGuests?: number;
}

export interface MatchPlayer {
  userId: string;
  name: string;
  avatar: string | null;
  status: "confirmed" | "waitlist";
  paid: boolean | null;
  /** Acompañantes que esta persona inscribio (cada uno ocupa un cupo). */
  guests: number;
  /** Nombre de cada acompañante (mismo orden); puede venir vacio o incompleto: la plantilla usa "Acompañante de ...". */
  guestNames?: string[];
  /** Cupo reservado sin pagar: limite (ISO) para pagar antes de perderlo. null = ya pagado, suplente u organizador. */
  holdExpiresAt?: string | null;
}

export interface MatchDetail extends MatchSummary {
  players: MatchPlayer[];
}

/** Mensaje del chat del partido ("Camerino & Coordinacion"). */
export interface MatchMessage {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  body: string;
  createdAt: string;
  /** Optimista: aun no confirmado por el servidor. */
  pending?: boolean;
}

export const FORMAT_LABEL: Record<string, string> = {
  futbol_5: "Fútbol 5",
  futbol_6: "Fútbol 6",
  futbol_7: "Fútbol 7",
  futbol_8: "Fútbol 8",
  futbol_11: "Fútbol 11",
};
export const LEVEL_LABEL: Record<string, string> = {
  recreativo: "Recreativo",
  intermedio: "Intermedio",
  competitivo: "Competitivo",
};
export const GENDER_LABEL: Record<string, string> = {
  mixto: "Mixto",
  varones: "Varones",
  mujeres: "Mujeres",
};
export const SURFACE_LABEL: Record<string, string> = {
  grass_sintetico: "Grass sintético",
  grass_natural: "Grass natural",
  loza: "Loza",
  futsal: "Futsal",
};

export const FORMAT_OPTIONS = Object.entries(FORMAT_LABEL).map(([id, label]) => ({ id, label }));
export const LEVEL_OPTIONS = Object.entries(LEVEL_LABEL).map(([id, label]) => ({ id, label }));
export const GENDER_OPTIONS = Object.entries(GENDER_LABEL).map(([id, label]) => ({ id, label }));
/** "Cuando" del feed (no es un campo del partido: se filtra por el dia). */
export const WHEN_OPTIONS = [{ id: "today", label: "Hoy" }, { id: "tomorrow", label: "Mañana" }];

/** Opciones de filtro que el administrador apago. Clave "<kind>:<value>" (kind: when | format | level | gender). */
export interface FilterOptionsState { disabled: { kind: string; value: string }[] }
export function useFilterOptions() {
  return useQuery<FilterOptionsState>({ queryKey: ["/api/filter-options"], staleTime: 60_000 });
}
export function useDisabledFilters(): Set<string> {
  const { data } = useFilterOptions();
  return useMemo(() => new Set((data?.disabled ?? []).map((d) => `${d.kind}:${d.value}`)), [data]);
}

const TZ = "America/Lima";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** "Hoy", "Mañana" o el día corto ("Sáb 28"): lo que la gente dice al convocar. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const key = dayKey(d);
  if (key === today) return "Hoy";
  if (key === tomorrow) return "Mañana";
  const wd = d.toLocaleDateString("es-PE", { timeZone: TZ, weekday: "short" }).replace(".", "");
  const day = d.toLocaleDateString("es-PE", { timeZone: TZ, day: "numeric" });
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${day}`;
}

/** "8:00 p. m." -> "20:00": formato de 24 h, como se juega en Lima. */
export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-PE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

/** "8:30 PM": la hora como se dice en Lima en los avisos de partido. */
export function time12Label(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
}

/** "8:30 PM - 9:30 PM" segun la duracion del partido. */
export function timeRange12(iso: string, durationMinutes: number): string {
  const end = new Date(new Date(iso).getTime() + durationMinutes * 60_000).toISOString();
  return `${time12Label(iso)} - ${time12Label(end)}`;
}

/** "HOY, 8:30 PM - 9:30 PM" / "MAÑANA, ..." / "SÁB 28, ...": rotulo del bloque de horario de la tarjeta. */
export function whenLabel(iso: string, durationMinutes: number): string {
  return `${dayLabel(iso).toUpperCase()}, ${timeRange12(iso, durationMinutes)}`;
}

/** Porcentaje de cupos ocupados (0-100, redondeado hacia abajo: 13 de 14 = 92%). */
export function fillPercent(m: Pick<MatchSummary, "maxPlayers" | "confirmedCount">): number {
  if (m.maxPlayers <= 0) return 0;
  return Math.min(100, Math.floor((m.confirmedCount / m.maxPlayers) * 100));
}

/** Iniciales para un avatar sin foto: "Mateo Ramos" -> "MR". */
export function initialsOf(name?: string | null): string {
  return (name ?? "").trim().split(/s+/).slice(0, 2).map((w) => w.charAt(0)).join("").toUpperCase() || "?";
}

export function priceLabel(price: string | number): string {
  const n = Number(price);
  return n > 0 ? `S/ ${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}` : "Gratis";
}

/** Cupos libres (nunca negativo). */
export const spotsLeft = (m: Pick<MatchSummary, "maxPlayers" | "confirmedCount">) => Math.max(0, m.maxPlayers - m.confirmedCount);

export interface MatchFilters {
  city?: string;
  district?: string;
  format?: string;
  level?: string;
  gender?: string;
}

export function matchesUrl(f: MatchFilters): string {
  const q = new URLSearchParams();
  (Object.keys(f) as (keyof MatchFilters)[]).forEach((k) => { if (f[k]) q.set(k, f[k] as string); });
  const s = q.toString();
  return s ? `/api/matches?${s}` : "/api/matches";
}

// El queryKey es la URL completa: el queryFn por defecto (lib/queryClient.ts) hace queryKey.join("/").
export function useMatches(filters: MatchFilters) {
  return useQuery<MatchSummary[]>({ queryKey: [matchesUrl(filters)] });
}
export function useMatch(id: string | undefined) {
  return useQuery<MatchDetail>({ queryKey: [`/api/matches/${id}`], enabled: !!id });
}
export function useMyMatches(enabled = true) {
  // staleTime 0: mi inscripcion/pago define botones y pase; no servir la copia guardada (IndexedDB, 5 min) sin revalidar.
  return useQuery<MatchSummary[]>({ queryKey: ["/api/matches/mine"], enabled, staleTime: 0 });
}
export function useVenues() {
  return useQuery<Venue[]>({ queryKey: ["/api/venues"], staleTime: 10 * 60 * 1000 });
}

/** Anotarse / bajarse: tras cada accion se refresca el feed, el detalle y Mis partidos. */
export function useJoinLeave(matchId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/matches") });
  };
  const join = useMutation({
    mutationFn: async (input?: { paid?: boolean; guests?: number; guestNames?: string[] }) =>
      (await apiRequest("POST", `/api/matches/${matchId}/join`, input ?? {})).json() as Promise<{ status: "confirmed" | "waitlist"; paid: boolean }>,
    onSuccess: refresh,
  });
  const leave = useMutation({
    mutationFn: async () => (await apiRequest("DELETE", `/api/matches/${matchId}/join`)).json(),
    onSuccess: refresh,
  });
  return { join, leave };
}

/**
 * Chat del partido. Consulta cada 15 s mientras la pantalla esta abierta: los mensajes llegan sin recargar y sin
 * WebSocket (mismo criterio que el chat de la app).
 */
export function useChatMessages(path: string | undefined, enabled = true) {
  return useQuery<MatchMessage[]>({
    queryKey: [path],
    enabled: !!path && enabled,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}
/** Ultimo mensaje de un chat (vista previa en la lista de Chats). */
export interface ChatPreview { body: string; userId: string; name: string; createdAt: string }
export interface ChatPreviews { general: ChatPreview | null; matches: Record<string, ChatPreview> }
export function useChatPreviews() {
  return useQuery<ChatPreviews>({ queryKey: ["/api/chats/previews"], refetchInterval: 15_000, staleTime: 5_000 });
}
export const useMatchMessages = (matchId: string | undefined, enabled = true) =>
  useChatMessages(matchId ? `/api/matches/${matchId}/messages` : undefined, enabled);

/** Enviar al chat con UI optimista: el mensaje aparece al instante y se confirma al volver el servidor. */
export function useSendChatMessage(
  path: string,
  me: { id: string; name: string; avatar?: string | null },
) {
  const qc = useQueryClient();
  const key = [path];
  return useMutation({
    mutationFn: async (body: string) =>
      (await apiRequest("POST", path, { body })).json() as Promise<MatchMessage>,
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MatchMessage[]>(key);
      const temp: MatchMessage = {
        id: `temp-${Date.now()}`,
        userId: me.id,
        name: me.name,
        avatar: me.avatar ?? null,
        body,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      qc.setQueryData<MatchMessage[]>(key, (old = []) => [...old, temp]);
      return { prev };
    },
    onError: (_error, _body, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: (message) => {
      qc.setQueryData<MatchMessage[]>(key, (old = []) => [
        ...old.filter((m) => !m.id.startsWith("temp-")),
        message,
      ]);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["/api/chats/previews"] });
    },
  });
}

export const useSendMatchMessage = (matchId: string, me: { id: string; name: string; avatar?: string | null }) =>
  useSendChatMessage(`/api/matches/${matchId}/messages`, me);

/** Portada por defecto: ninguna pichanga queda sin portada (cancha sin foto o foto que no carga). */
export const DEFAULT_COVER = "/venues/portada-default.jpg";
/** Fotos que se muestran del partido: sus portadas o, si no tiene, las de la cancha. */
export const coverPhotos = (m: { photos?: string[] | null; venue: { photos?: string[] | null } }): string[] =>
  (m.photos?.length ? m.photos : m.venue.photos) ?? [];
export const coverOf = (venue: { photos?: string[] | null }): string => venue.photos?.find(Boolean) || DEFAULT_COVER;

export const DEFAULT_CITY = "Lima";
const CITY_KEY = "pichangas:city";

/** Ciudad elegida la ultima vez (por dispositivo). El almacenamiento puede fallar (modo privado): cae a Lima. */
export function loadCity(): string {
  try { return localStorage.getItem(CITY_KEY) || DEFAULT_CITY; } catch { return DEFAULT_CITY; }
}
export function saveCity(city: string): void {
  try { localStorage.setItem(CITY_KEY, city); } catch { /* sin almacenamiento: no se recuerda */ }
}

/** Ciudades que tienen canchas, con Lima primero y el resto en orden alfabetico. */
export function citiesOf(venues: Venue[]): string[] {
  const set = new Set(venues.map((v) => v.city));
  return Array.from(set).sort((a, b) => (a === DEFAULT_CITY ? -1 : b === DEFAULT_CITY ? 1 : a.localeCompare(b, "es")));
}

export type MatchSort = "time" | "price" | "spots";
export const SORT_OPTIONS: readonly { id: MatchSort; label: string }[] = [
  { id: "time", label: "Más próximas" },
  { id: "price", label: "Más baratas" },
  { id: "spots", label: "Más cupos libres" },
];

// ───────────── Pase digital del partido ─────────────

/** Numero de pase estable por jugador y partido ("#4829"): el mismo en cada visita, sin guardarlo en la base. */
export function passNumber(matchId: string, userId: string): string {
  let hash = 0;
  for (const ch of `${matchId}:${userId}`) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return String(1000 + (hash % 9000));
}

export { seatNumber } from "@/lib/squad";

export interface MatchTeam {
  id: "verde" | "blanco";
  label: string;
  /** Punto de color del equipo (verde electrico / blanco). */
  dotClass: string;
}

/**
 * Equipos referenciales: se reparten alternando el orden de anotacion (1 Verde, 2 Blanco...). No hay tabla de equipos:
 * en la cancha los capitanes pueden cambiarlos. Se muestra para que el jugador sepa que chaleco le toca.
 */
export function teamOf(match: MatchDetail, userId: string): MatchTeam | null {
  const seat = seatNumber(match, userId);
  if (seat === 0) return null;
  return seat % 2 === 1
    ? { id: "verde", label: "Chaleco Verde", dotClass: "bg-pitch" }
    : { id: "blanco", label: "Chaleco Blanco", dotClass: "bg-night-text" };
}

const gcalDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** "Agregar al calendario": plantilla de Google Calendar (funciona en telefono y escritorio). */
export function googleCalendarUrl(match: MatchSummary): string {
  const start = new Date(match.startsAt);
  const end = new Date(start.getTime() + match.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: match.title,
    dates: `${gcalDate(start)}/${gcalDate(end)}`,
    details: `Pichanga ${FORMAT_LABEL[match.format] ?? match.format} · ${LEVEL_LABEL[match.level] ?? match.level}. Organiza ${match.organizerName}.`,
    location: [match.venue.name, match.venue.address, match.venue.district, match.venue.city].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Link de mapas con la cancha: coordenadas si las hay; si no, nombre + direccion + distrito. */
export function mapsUrl(venue: Venue): string {
  const query = venue.latitude && venue.longitude
    ? `${venue.latitude},${venue.longitude}`
    : [venue.name, venue.address, venue.district, venue.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Texto para invitar a un pata (Web Share / copiar). Incluye el enlace al partido si hay navegador. */
export function inviteMessage(match: MatchSummary): string {
  const left = spotsLeft(match);
  const link = typeof window !== "undefined" ? `${window.location.origin}${PLAY_ROUTES.match(match)}` : "";
  const cupos = left === 0 ? "ya esta completo, entra de suplente" : left === 1 ? "queda 1 cupo" : `quedan ${left} cupos`;
  return `Anotate conmigo a "${match.title}" · ${whenLabel(match.startsAt, match.durationMinutes)} en ${match.venue.name}, ${match.venue.district}. ${cupos}.${link ? `\n${link}` : ""}`;
}

/** Regla del encuentro tal como la configura el admin (GET /api/pichanga-rules). */
export interface PichangaRule {
  id: string;
  title: string;
  description: string;
  icon: string;
}
export const usePichangaRules = () => useQuery<PichangaRule[]>({ queryKey: ["/api/pichanga-rules"], staleTime: 60_000 });
/** Texto de la regla para un partido: `{hora}` se reemplaza por la hora del pitazo. */
export const ruleText = (rule: PichangaRule, startsAt: string) => rule.description.split("{hora}").join(time12Label(startsAt));

/** Busqueda por texto (titulo, cancha, distrito, formato) y orden, sobre lo que ya trajo el servidor. */
export function searchAndSort(list: MatchSummary[], query: string, sort: MatchSort): MatchSummary[] {
  const q = query.trim().toLowerCase();
  const out = q
    ? list.filter((m) =>
        [m.title, m.venue.name, m.venue.district, FORMAT_LABEL[m.format], LEVEL_LABEL[m.level]].some((t) => (t ?? "").toLowerCase().includes(q)),
      )
    : [...list];
  if (sort === "price") out.sort((a, b) => Number(a.pricePerPlayer) - Number(b.pricePerPlayer));
  if (sort === "spots") out.sort((a, b) => spotsLeft(b) - spotsLeft(a));
  if (sort === "time") out.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return out;
}
