import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { MatchSummary, Venue } from "@/lib/pichangas";

// Datos del panel admin de Pichangas (rutas /api/admin/pichangas/*, solo administrador).

export interface AdminOverview {
  players: number;
  activeVenues: number;
  pendingVenues: number;
  upcomingMatches: number;
  totalMatches: number;
  cancelledMatches: number;
  occupancy: number;
  waitlistTotal: number;
  estimatedRevenue: number;
  byCity: { city: string; matches: number; players: number }[];
}

export interface AdminMatch extends MatchSummary {
  waitlistCount: number;
}

export interface AdminVenue extends Venue {
  isActive: boolean;
  matchCount: number;
  creatorName: string | null;
}

export interface AdminPlayer {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  status: string | null;
  lastSeen: string | null;
  createdAt: string | null;
  joined: number;
  organized: number;
}

export const useAdminOverview = () => useQuery<AdminOverview>({ queryKey: ["/api/admin/pichangas/overview"] });
export const useAdminMatches = () => useQuery<AdminMatch[]>({ queryKey: ["/api/admin/pichangas/matches"] });
export const useAdminVenues = () => useQuery<AdminVenue[]>({ queryKey: ["/api/admin/pichangas/venues"] });
export const useAdminPlayers = () => useQuery<AdminPlayer[]>({ queryKey: ["/api/admin/pichangas/players"] });

/** Accion del admin (cancelar, aprobar, suspender): al terminar se refresca el panel y los datos publicos. */
export function useAdminAction<V = void>(run: (vars: V) => Promise<Response>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: V) => (await run(vars)).json(),
    onSuccess: () => {
      qc.invalidateQueries({
        predicate: (q) => {
          const k = String(q.queryKey[0]);
          return k.startsWith("/api/admin/pichangas") || k.startsWith("/api/matches") || k.startsWith("/api/venues") || k.startsWith("/api/pichanga-rules");
        },
      });
    },
  });
}

/** Datos del formulario de partido (crear/editar). `startsAt` es ISO. */
export interface AdminMatchInput {
  venueId: string;
  title: string;
  description: string | null;
  startsAt: string;
  durationMinutes: number;
  format: string;
  level: string;
  gender: string;
  maxPlayers: number;
  pricePerPlayer: number;
}

export const createMatchRequest = (data: AdminMatchInput) => apiRequest("POST", "/api/admin/pichangas/matches", data);
export const updateMatchRequest = ({ id, data }: { id: string; data: AdminMatchInput }) =>
  apiRequest("PATCH", `/api/admin/pichangas/matches/${id}`, data);
export const deleteMatchRequest = (id: string) => apiRequest("DELETE", `/api/admin/pichangas/matches/${id}`);
export const cancelMatchRequest = (id: string) => apiRequest("POST", `/api/admin/pichangas/matches/${id}/cancel`);
export const setVenueActiveRequest = ({ id, isActive }: { id: string; isActive: boolean }) =>
  apiRequest("PATCH", `/api/admin/pichangas/venues/${id}`, { isActive });
export interface AdminVenueInput {
  name: string;
  district: string;
  city: string;
  address: string | null;
  surface: string;
  pricePerHour: number | null;
  phone: string | null;
}
export const createVenueRequest = (data: AdminVenueInput) => apiRequest("POST", "/api/admin/pichangas/venues", data);
export const updateVenueRequest = ({ id, data }: { id: string; data: AdminVenueInput }) => apiRequest("PATCH", `/api/admin/pichangas/venues/${id}`, data);
export const deleteVenueRequest = (id: string) => apiRequest("DELETE", `/api/admin/pichangas/venues/${id}`);

export interface AdminPlayerInput { name: string; email: string; whatsapp: string | null }
export const createPlayerRequest = (data: AdminPlayerInput) => apiRequest("POST", "/api/admin/pichangas/players", data);
export const updatePlayerRequest = ({ id, data }: { id: string; data: AdminPlayerInput }) => apiRequest("PATCH", `/api/admin/pichangas/players/${id}`, data);
export const deletePlayerRequest = (id: string) => apiRequest("DELETE", `/api/admin/pichangas/players/${id}`);
export const setPlayerStatusRequest = ({ id, status }: { id: string; status: "active" | "suspended" }) =>
  apiRequest("PATCH", `/api/admin/pichangas/players/${id}/status`, { status });

// ── Reglas del encuentro ──
export interface AdminRule {
  id: string;
  title: string;
  description: string;
  icon: string;
  position: number;
  isActive: boolean;
}
export type AdminRuleInput = Pick<AdminRule, "title" | "description" | "icon" | "isActive">;

export const useAdminRules = () => useQuery<AdminRule[]>({ queryKey: ["/api/admin/pichangas/rules"] });
export const createRuleRequest = (data: AdminRuleInput) => apiRequest("POST", "/api/admin/pichangas/rules", data);
export const updateRuleRequest = ({ id, data }: { id: string; data: AdminRuleInput }) => apiRequest("PATCH", `/api/admin/pichangas/rules/${id}`, data);
export const moveRuleRequest = ({ id, direction }: { id: string; direction: "up" | "down" }) => apiRequest("POST", `/api/admin/pichangas/rules/${id}/move`, { direction });
export const deleteRuleRequest = (id: string) => apiRequest("DELETE", `/api/admin/pichangas/rules/${id}`);
